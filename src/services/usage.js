/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/services/fallbackDataStore.js
 * 
 * 説明:
 * フォールバックデータストアサービス。
 * データソースが利用できない場合のためのフォールバックデータを管理します。
 * 障害発生時に適切なデータを提供することで、APIの可用性を高めます。
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-11
 */
'use strict';

const cacheService = require('./cache');
const { DATA_TYPES, CACHE_TIMES } = require('../config/constants');
const logger = require('../utils/logger');

// フォールバックキャッシュのプレフィックス
const FALLBACK_PREFIX = 'fallback:';

/**
 * データ取得に失敗した記録を保存する
 * @param {string} symbol - 証券コードまたはティッカーシンボル
 * @param {string} dataType - データタイプ
 * @param {string|Error} errorInfo - エラー情報
 * @returns {Promise<boolean>} 記録成功時はtrue
 */
const recordFailedFetch = async (symbol, dataType, errorInfo) => {
  try {
    // 失敗カウントの更新などの処理があればここに実装
    const errorMessage = errorInfo instanceof Error 
      ? errorInfo.message 
      : (typeof errorInfo === 'string' ? errorInfo : 'Unknown error');
    
    logger.warn(`Data fetch failed for ${dataType}:${symbol}:`, errorMessage);
    
    return true;
  } catch (error) {
    logger.error('Error recording failed fetch:', error);
    return false;
  }
};

/**
 * 特定のシンボルのフォールバックデータを取得する
 * @param {string} symbol - 証券コードまたはティッカーシンボル
 * @param {string} dataType - データタイプ
 * @returns {Promise<Object|null>} フォールバックデータ（存在しない場合はnull）
 */
const getFallbackForSymbol = async (symbol, dataType) => {
  try {
    // キャッシュキーを構築
    const cacheKey = `${FALLBACK_PREFIX}${dataType}:${symbol}`;
    
    // キャッシュからデータを取得
    const cachedData = await cacheService.get(cacheKey);
    
    if (cachedData) {
      return {
        ...cachedData,
        source: 'Fallback Cache'
      };
    }
    
    // キャッシュになければデフォルトデータを返す
    const defaultData = getDefaultFallbackData(symbol, dataType);
    
    // デフォルトデータをキャッシュに保存
    if (defaultData) {
      const ttl = CACHE_TIMES.FALLBACK_DATA;
      await cacheService.set(cacheKey, defaultData, ttl);
    }
    
    return defaultData;
  } catch (error) {
    logger.error(`Error getting fallback data for ${dataType}:${symbol}:`, error);
    return null;
  }
};

/**
 * デフォルトのフォールバックデータを取得する
 * @param {string} symbol - 証券コードまたはティッカーシンボル
 * @param {string} dataType - データタイプ
 * @returns {Object|null} デフォルトのフォールバックデータ
 */
const getDefaultFallbackData = (symbol, dataType) => {
  const now = new Date().toISOString();
  
  // データタイプに応じてデフォルトデータを作成
  switch (dataType) {
    case DATA_TYPES.US_STOCK:
      return {
        ticker: symbol,
        price: symbol === 'AAPL' ? 180.95 : 100,
        change: 0,
        changePercent: 0,
        name: symbol,
        currency: 'USD',
        isStock: true,
        isMutualFund: false,
        source: 'Default Fallback',
        lastUpdated: now
      };
    
    case DATA_TYPES.JP_STOCK:
      return {
        ticker: symbol,
        price: symbol === '7203' ? 2500 : 2000,
        change: 0,
        changePercent: 0,
        name: `日本株 ${symbol}`,
        currency: 'JPY',
        isStock: true,
        isMutualFund: false,
        source: 'Default Fallback',
        lastUpdated: now
      };
    
    case DATA_TYPES.MUTUAL_FUND:
      return {
        ticker: `${symbol}C`,
        price: 10000,
        change: 0,
        changePercent: 0,
        name: `投資信託 ${symbol}`,
        currency: 'JPY',
        isStock: false,
        isMutualFund: true,
        priceLabel: '基準価額',
        source: 'Default Fallback',
        lastUpdated: now
      };
    
    case DATA_TYPES.EXCHANGE_RATE:
      // 通貨ペアを解析
      const [base, target] = symbol.split('-');
      return {
        pair: symbol,
        base,
        target,
        rate: base === 'USD' && target === 'JPY' ? 149.82 : 1.0,
        change: 0,
        changePercent: 0,
        source: 'Default Fallback',
        lastUpdated: now
      };
    
    default:
      return null;
  }
};

/**
 * フォールバックデータを保存する
 * @param {string} symbol - 証券コードまたはティッカーシンボル
 * @param {string} dataType - データタイプ
 * @param {Object} data - 保存するデータ
 * @returns {Promise<boolean>} 保存成功時はtrue
 */
const saveFallbackData = async (symbol, dataType, data) => {
  try {
    // キャッシュキーを構築
    const cacheKey = `${FALLBACK_PREFIX}${dataType}:${symbol}`;
    
    // フォールバックデータのTTLを設定
    const ttl = CACHE_TIMES.FALLBACK_DATA;
    
    // データをキャッシュに保存
    return await cacheService.set(cacheKey, data, ttl);
  } catch (error) {
    logger.error(`Error saving fallback data for ${dataType}:${symbol}:`, error);
    return false;
  }
};

/**
 * フォールバックデータを更新する
 * @param {string} dataType - データタイプ
 * @param {Array<Object>} dataItems - 更新するデータの配列
 * @returns {Promise<Object>} 更新結果
 */
const updateFallbackData = async (dataType, dataItems) => {
  try {
    let successCount = 0;
    let failCount = 0;
    
    // 各データアイテムを処理
    for (const item of dataItems) {
      const symbol = item.ticker || item.pair;
      if (symbol) {
        const success = await saveFallbackData(symbol, dataType, item);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }
    }
    
    return {
      success: true,
      dataType,
      updated: successCount,
      failed: failCount,
      total: dataItems.length
    };
  } catch (error) {
    logger.error(`Error updating fallback data for ${dataType}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  recordFailedFetch,
  getFallbackForSymbol,
  getDefaultFallbackData,
  saveFallbackData,
  updateFallbackData
};
