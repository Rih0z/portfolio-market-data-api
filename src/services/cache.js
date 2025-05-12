/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/services/cache.js
 * 
 * 説明: 
 * キャッシュ機能を提供するサービス。
 * DynamoDBまたはRedisを使用してデータをキャッシュします。
 * 
 * @author Portfolio Manager Team
 * @updated 2025-05-14
 */
'use strict';

const { getDynamoDb } = require('../utils/awsConfig');
const { CACHE_VOLATILITY_FACTORS } = require('../config/constants');

// 環境変数からの設定
const CACHE_TABLE = process.env.CACHE_TABLE || `${process.env.DYNAMODB_TABLE_PREFIX || 'portfolio-market-data-'}-cache`;
const DEFAULT_TTL = parseInt(process.env.DEFAULT_CACHE_TTL || '3600', 10); // デフォルト1時間

// 差分キャッシュのためのメタデータキープレフィックス
const METADATA_PREFIX = 'meta:';

/**
 * キャッシュからデータを取得する
 * @param {string} key - キャッシュキー
 * @returns {Promise<Object|null>} キャッシュデータと残りのTTL、存在しない場合はnull
 */
const get = async (key) => {
  try {
    const dynamoDb = getDynamoDb();
    
    const params = {
      TableName: CACHE_TABLE,
      Key: { key }
    };
    
    const result = await dynamoDb.get(params).promise();
    
    if (!result.Item) {
      return null;
    }
    
    // TTLチェック
    const now = Math.floor(Date.now() / 1000);
    const ttl = result.Item.ttl || 0;
    
    if (ttl < now) {
      // TTL切れの場合は削除して、nullを返す
      await remove(key);
      return null;
    }
    
    // 残りのTTLを計算
    const remainingTtl = ttl - now;
    
    // 差分キャッシュの場合は基準データと結合
    if (result.Item.isDifferential && result.Item.baseDataKey) {
      const baseData = await getBaseData(result.Item.baseDataKey);
      if (baseData) {
        return {
          data: mergeDifferentialData(baseData, result.Item.data),
          ttl: remainingTtl,
          createdAt: result.Item.createdAt,
          lastModified: result.Item.lastModified
        };
      }
    }
    
    return {
      data: result.Item.data,
      ttl: remainingTtl,
      createdAt: result.Item.createdAt,
      lastModified: result.Item.lastModified || result.Item.createdAt
    };
  } catch (error) {
    console.error(`Error retrieving cache for key ${key}:`, error);
    return null;
  }
};

/**
 * 基準データを取得する（差分キャッシュ用）
 * @param {string} baseDataKey - 基準データのキー
 * @returns {Promise<Object|null>} 基準データ
 */
const getBaseData = async (baseDataKey) => {
  try {
    const metaKey = `${METADATA_PREFIX}${baseDataKey}`;
    const dynamoDb = getDynamoDb();
    
    const params = {
      TableName: CACHE_TABLE,
      Key: { key: metaKey }
    };
    
    const result = await dynamoDb.get(params).promise();
    
    if (!result.Item || !result.Item.baseData) {
      return null;
    }
    
    return result.Item.baseData;
  } catch (error) {
    console.error(`Error retrieving base data for key ${baseDataKey}:`, error);
    return null;
  }
};

/**
 * 基準データと差分データを結合する
 * @param {Object} baseData - 基準データ
 * @param {Object} diffData - 差分データ
 * @returns {Object} 結合されたデータ
 */
const mergeDifferentialData = (baseData, diffData) => {
  // シンプルなケース: 差分が単一レベルのオブジェクトの場合
  return { ...baseData, ...diffData };
};

/**
 * データをキャッシュに保存する
 * @param {string} key - キャッシュキー
 * @param {Object} data - 保存するデータ
 * @param {number} ttl - TTL（秒）、デフォルトは1時間
 * @param {Object} options - 追加オプション
 * @returns {Promise<boolean>} 成功ならtrue
 */
const set = async (key, data, ttl = DEFAULT_TTL, options = {}) => {
  try {
    const { 
      volatility = 'MEDIUM',  // 'HIGH', 'MEDIUM', 'LOW'
      useDifferential = false,
      baseDataKey = null,
      symbol = null,
      dataType = null 
    } = options;
    
    const dynamoDb = getDynamoDb();
    
    // ボラティリティに基づいてTTLを調整
    const volatilityFactor = CACHE_VOLATILITY_FACTORS[volatility] || 1.0;
    const adjustedTtl = Math.floor(ttl * volatilityFactor);
    
    const now = Date.now();
    const ttlTimestamp = Math.floor(now / 1000) + adjustedTtl;
    
    // キャッシュアイテムを構築
    const cacheItem = {
      key,
      data,
      ttl: ttlTimestamp,
      createdAt: new Date(now).toISOString(),
      lastModified: new Date(now).toISOString(),
      size: JSON.stringify(data).length,
      volatility
    };
    
    // シンボルやデータタイプの情報があれば追加
    if (symbol) cacheItem.symbol = symbol;
    if (dataType) cacheItem.dataType = dataType;
    
    // 差分キャッシュを使用する場合
    if (useDifferential && baseDataKey) {
      // 差分データを計算して保存
      await setDifferentialData(key, data, baseDataKey, ttlTimestamp, cacheItem);
      return true;
    }
    
    // 通常のキャッシュ保存
    const params = {
      TableName: CACHE_TABLE,
      Item: cacheItem
    };
    
    await dynamoDb.put(params).promise();
    
    return true;
  } catch (error) {
    console.error(`Error setting cache for key ${key}:`, error);
    return false;
  }
};

/**
 * 差分データをキャッシュに保存する
 * @param {string} key - キャッシュキー
 * @param {Object} data - 完全なデータ
 * @param {string} baseDataKey - 基準データキー
 * @param {number} ttlTimestamp - TTLタイムスタンプ
 * @param {Object} cacheItem - キャッシュアイテムのベース
 * @returns {Promise<boolean>} 成功ならtrue
 */
const setDifferentialData = async (key, data, baseDataKey, ttlTimestamp, cacheItem) => {
  try {
    const dynamoDb = getDynamoDb();
    const metaKey = `${METADATA_PREFIX}${baseDataKey}`;
    
    // 基準データが存在するか確認
    let baseData = await getBaseData(baseDataKey);
    
    // 基準データがない場合は作成
    if (!baseData) {
      baseData = data;
      
      // 基準データをメタデータとして保存
      await dynamoDb.put({
        TableName: CACHE_TABLE,
        Item: {
          key: metaKey,
          baseData: baseData,
          ttl: ttlTimestamp + 86400, // 基準データは通常より1日長く保存
          createdAt: cacheItem.createdAt
        }
      }).promise();
      
      // 差分なしで通常保存（最初のデータ）
      await dynamoDb.put({
        TableName: CACHE_TABLE,
        Item: cacheItem
      }).promise();
      
      return true;
    }
    
    // データの差分部分のみを抽出
    const diffData = extractDifferentialData(baseData, data);
    
    // 差分を保存
    const diffCacheItem = {
      ...cacheItem,
      data: diffData,
      isDifferential: true,
      baseDataKey: baseDataKey,
      originalSize: JSON.stringify(data).length
    };
    
    await dynamoDb.put({
      TableName: CACHE_TABLE,
      Item: diffCacheItem
    }).promise();
    
    return true;
  } catch (error) {
    console.error(`Error setting differential cache for key ${key}:`, error);
    // エラー時は通常の方式でフォールバック
    const params = {
      TableName: CACHE_TABLE,
      Item: cacheItem
    };
    
    await dynamoDb.put(params).promise();
    return true;
  }
};

/**
 * 2つのオブジェクト間の差分を抽出する
 * @param {Object} baseData - 基準データ
 * @param {Object} newData - 新しいデータ
 * @returns {Object} 差分データ
 */
const extractDifferentialData = (baseData, newData) => {
  // シンプルな実装: 値が変わったプロパティのみを含める
  const diff = {};
  
  Object.keys(newData).forEach(key => {
    if (JSON.stringify(baseData[key]) !== JSON.stringify(newData[key])) {
      diff[key] = newData[key];
    }
  });
  
  return diff;
};

/**
 * 動的TTLを計算する
 * @param {string} symbol - 銘柄シンボル
 * @param {string} dataType - データタイプ
 * @param {Object} data - 銘柄データ
 * @param {number} baseTtl - ベースTTL値（秒）
 * @returns {Object} TTLと揮発性レベル
 */
const calculateDynamicTtl = (symbol, dataType, data, baseTtl) => {
  // デフォルト値
  let volatility = 'MEDIUM';
  let ttl = baseTtl;
  
  // 前日比の変動率を確認
  if (data && data.changePercent !== undefined) {
    const absChangePercent = Math.abs(data.changePercent);
    
    // 変動率に基づいて揮発性を判定
    if (absChangePercent > 5.0) {
      // 5%以上の変動は高揮発性
      volatility = 'HIGH';
    } else if (absChangePercent < 1.0) {
      // 1%未満の変動は低揮発性
      volatility = 'LOW';
    }
  }
  
  // 市場時間外は長めのキャッシュ
  if (!isMarketHours(dataType)) {
    volatility = volatility === 'HIGH' ? 'MEDIUM' : 'LOW';
  }
  
  return { ttl, volatility };
};

/**
 * 現在が市場時間内かどうかを判定する
 * @param {string} dataType - データタイプ
 * @returns {boolean} 市場時間内ならtrue
 */
const isMarketHours = (dataType) => {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay(); // 0: 日曜, 1-5: 月-金, 6: 土曜
  
  // 日本株
  if (dataType === 'jp-stock') {
    // 土日はfalse
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    // 日本時間 9:00-15:00 (UTC 0:00-6:00)
    return utcHour >= 0 && utcHour < 6;
  }
  
  // 米国株
  if (dataType === 'us-stock') {
    // 土日はfalse
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    // 米国東部時間 9:30-16:00 (UTC 14:30-21:00)
    return utcHour >= 14 && utcHour < 21;
  }
  
  // デフォルトは営業時間内とみなす
  return true;
};

/**
 * キャッシュからデータを削除する
 * @param {string} key - キャッシュキー
 * @returns {Promise<boolean>} 成功ならtrue
 */
const remove = async (key) => {
  try {
    const dynamoDb = getDynamoDb();
    
    const params = {
      TableName: CACHE_TABLE,
      Key: { key }
    };
    
    await dynamoDb.delete(params).promise();
    
    return true;
  } catch (error) {
    console.error(`Error removing cache for key ${key}:`, error);
    return false;
  }
};

/**
 * 期限切れのキャッシュを削除する
 * @returns {Promise<Object>} クリーンアップ結果
 */
const cleanup = async () => {
  try {
    const dynamoDb = getDynamoDb();
    
    // 現在の時刻（UNIX時間）
    const now = Math.floor(Date.now() / 1000);
    
    // 期限切れのアイテムを検索
    const scanParams = {
      TableName: CACHE_TABLE,
      FilterExpression: 'ttl < :now',
      ExpressionAttributeValues: {
        ':now': now
      }
    };
    
    const result = await dynamoDb.scan(scanParams).promise();
    const expiredItems = result.Items || [];
    
    // TTLによる自動削除が実装されている場合でも確実に削除
    const deletePromises = expiredItems.map(item => {
      const deleteParams = {
        TableName: CACHE_TABLE,
        Key: { key: item.key }
      };
      
      return dynamoDb.delete(deleteParams).promise();
    });
    
    await Promise.all(deletePromises);
    
    return {
      success: true,
      cleanedItems: expiredItems.length
    };
  } catch (error) {
    console.error('Error cleaning up cache:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * キャッシュの統計情報を取得する
 * @returns {Promise<Object>} 統計情報
 */
const getStats = async () => {
  try {
    const dynamoDb = getDynamoDb();
    
    const scanParams = {
      TableName: CACHE_TABLE
    };
    
    const result = await dynamoDb.scan(scanParams).promise();
    const items = result.Items || [];
    
    // 現在時刻
    const now = Math.floor(Date.now() / 1000);
    
    // 有効なアイテム数とサイズを計算
    const validItems = items.filter(item => (item.ttl || 0) > now);
    const totalSize = validItems.reduce((sum, item) => sum + (item.size || 0), 0);
    
    // 差分キャッシュの統計
    const diffItems = validItems.filter(item => item.isDifferential === true);
    const diffOriginalSize = diffItems.reduce((sum, item) => sum + (item.originalSize || 0), 0);
    const diffActualSize = diffItems.reduce((sum, item) => sum + (item.size || 0), 0);
    const diffSavings = diffOriginalSize > 0 ? diffOriginalSize - diffActualSize : 0;
    
    return {
      total: items.length,
      valid: validItems.length,
      expired: items.length - validItems.length,
      totalSizeBytes: totalSize,
      totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
      differential: {
        count: diffItems.length,
        originalSizeBytes: diffOriginalSize,
        actualSizeBytes: diffActualSize,
        savingsBytes: diffSavings,
        savingsPercent: diffOriginalSize > 0 ? Math.round((diffSavings / diffOriginalSize) * 100) : 0
      }
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return {
      error: error.message
    };
  }
};

module.exports = {
  get,
  set,
  remove,
  cleanup,
  getStats,
  calculateDynamicTtl,
  isMarketHours
};
