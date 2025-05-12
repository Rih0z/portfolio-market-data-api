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

// 環境変数からの設定
const CACHE_TABLE = process.env.CACHE_TABLE || `${process.env.DYNAMODB_TABLE_PREFIX || 'portfolio-market-data-'}-cache`;
const DEFAULT_TTL = parseInt(process.env.DEFAULT_CACHE_TTL || '3600', 10); // デフォルト1時間

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
    
    return {
      data: result.Item.data,
      ttl: remainingTtl,
      createdAt: result.Item.createdAt
    };
  } catch (error) {
    console.error(`Error retrieving cache for key ${key}:`, error);
    return null;
  }
};

/**
 * データをキャッシュに保存する
 * @param {string} key - キャッシュキー
 * @param {Object} data - 保存するデータ
 * @param {number} ttl - TTL（秒）、デフォルトは1時間
 * @returns {Promise<boolean>} 成功ならtrue
 */
const set = async (key, data, ttl = DEFAULT_TTL) => {
  try {
    const dynamoDb = getDynamoDb();
    
    const now = Date.now();
    const ttlTimestamp = Math.floor(now / 1000) + ttl;
    
    const params = {
      TableName: CACHE_TABLE,
      Item: {
        key,
        data,
        ttl: ttlTimestamp,
        createdAt: new Date(now).toISOString(),
        size: JSON.stringify(data).length
      }
    };
    
    await dynamoDb.put(params).promise();
    
    return true;
  } catch (error) {
    console.error(`Error setting cache for key ${key}:`, error);
    return false;
  }
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
    
    return {
      total: items.length,
      valid: validItems.length,
      expired: items.length - validItems.length,
      totalSizeBytes: totalSize,
      totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
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
  getStats
};

