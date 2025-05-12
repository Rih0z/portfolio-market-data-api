/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/utils/dataFetchWithFallback.js
 * 
 * 説明: 
 * データ取得に失敗した場合のフォールバック処理を強化した共通ユーティリティ。
 * 複数のソースを試行し、失敗した場合はGitHubのフォールバックデータを使用します。
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-20
 */
'use strict';

const fallbackDataStore = require('../services/fallbackDataStore');
const { withRetry, isRetryableApiError, sleep } = require('./retry');
const blacklist = require('./scrapingBlacklist');
const { getRandomUserAgent } = require('./dataFetchUtils');
const logger = require('./logger');
const cacheService = require('../services/cache');
const { CACHE_TIMES, DATA_TYPES } = require('../config/constants');

/**
 * 強化されたフォールバック処理付きデータ取得関数
 * @param {Object} options - オプション
 * @param {string} options.symbol - 銘柄コード
 * @param {string} options.dataType - データタイプ
 * @param {Array<Function>} options.fetchFunctions - データ取得関数の配列
 * @param {Object} options.defaultValues - デフォルト値
 * @param {boolean} [options.useCache=true] - キャッシュを使用するかどうか
 * @param {boolean} [options.refresh=false] - キャッシュを無視するかどうか
 * @param {Object} [options.cache] - キャッシュオプション
 * @returns {Promise<Object>} 取得したデータ
 */
const fetchDataWithFallback = async (options) => {
  const { 
    symbol, 
    dataType, 
    fetchFunctions, 
    defaultValues,
    useCache = true,
    refresh = false,
    cache = {}
  } = options;
  
  const cacheKey = `${dataType}:${symbol}`;
  const cacheTime = cache.time || CACHE_TIMES[dataType.split('-')[0].toUpperCase()] || 3600;
  
  // 1. キャッシュをチェック（リフレッシュでない場合）
  if (useCache && !refresh) {
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      logger.info(`Using cached data for ${symbol} (${dataType})`);
      return {
        ...cachedData,
        fromCache: true
      };
    }
  }
  
  // 2. ブラックリストをチェック
  const isBlackListed = await blacklist.isBlacklisted(symbol, dataType);
  if (isBlackListed) {
    logger.info(`Symbol ${symbol} is blacklisted. Using fallback data.`);
    
    // 2.1 GitHubフォールバックデータを取得
    const fallbackData = await fallbackDataStore.getFallbackForSymbol(symbol, dataType);
    
    if (fallbackData) {
      // フォールバックをキャッシュに保存（TTLを短く設定）
      if (useCache) {
        await cacheService.set(cacheKey, {
          ...fallbackData,
          isBlacklisted: true,
          source: 'GitHub Fallback'
        }, 600); // 10分間
      }
      
      return {
        ...fallbackData,
        isBlacklisted: true,
        source: 'GitHub Fallback'
      };
    }
    
    // 2.2 GitHubからも取得できない場合はデフォルト値を使用
    const defaultData = {
      ...defaultValues,
      ticker: symbol,
      lastUpdated: new Date().toISOString(),
      isBlacklisted: true,
      source: 'Default Fallback'
    };
    
    // デフォルト値をキャッシュに保存（TTLを短く設定）
    if (useCache) {
      await cacheService.set(cacheKey, defaultData, 600); // 10分間
    }
    
    return defaultData;
  }
  
  // 3. 各データ取得関数を順番に試行
  for (let i = 0; i < fetchFunctions.length; i++) {
    const fetchFunction = fetchFunctions[i];
    const functionName = fetchFunction.name || `source${i+1}`;
    
    try {
      logger.info(`Trying data fetch function ${functionName} for ${symbol} (${dataType})`);
      
      // データ取得を試行（再試行ロジック付き）
      const data = await withRetry(
        () => fetchFunction(symbol),
        {
          maxRetries: 2,
          baseDelay: 300,
          shouldRetry: isRetryableApiError
        }
      );
      
      if (data && data.price !== undefined) {
        logger.info(`Successfully fetched data with ${functionName} for ${symbol} (${dataType})`);
        
        // 成功を記録
        await blacklist.recordSuccess(symbol);
        
        // 結果データを構築
        const resultData = {
          ...data,
          ticker: symbol,
          lastUpdated: data.lastUpdated || new Date().toISOString(),
          source: data.source || functionName
        };
        
        // データをキャッシュに保存
        if (useCache) {
          await cacheService.set(cacheKey, resultData, cacheTime);
        }
        
        return resultData;
      }
      
      logger.warn(`Function ${functionName} returned invalid data for ${symbol} (${dataType})`);
    } catch (error) {
      logger.error(`Error with function ${functionName} for ${symbol}:`, error.message);
      
      // 失敗を記録
      await blacklist.recordFailure(
        symbol, 
        dataType, 
        `${functionName}: ${error.message}`
      );
      
      // データ取得失敗を記録
      await fallbackDataStore.recordFailedFetch(
        symbol,
        dataType,
        `${functionName}: ${error.message}`
      );
    }
    
    // 次のソースを試す前に少し遅延
    if (i < fetchFunctions.length - 1) {
      await sleep(200);
    }
  }
  
  // 4. すべてのソースが失敗した場合のフォールバック処理
  logger.warn(`All data sources failed for ${symbol} (${dataType}). Trying GitHub fallback.`);
  
  // 4.1 GitHubフォールバックデータを取得
  const fallbackData = await fallbackDataStore.getFallbackForSymbol(symbol, dataType);
  
  if (fallbackData) {
    logger.info(`Using GitHub fallback data for ${symbol} (${dataType})`);
    
    // フォールバックをキャッシュに保存（TTLを短く設定）
    if (useCache) {
      await cacheService.set(cacheKey, {
        ...fallbackData,
        source: 'GitHub Fallback'
      }, 1800); // 30分間
    }
    
    return {
      ...fallbackData,
      source: 'GitHub Fallback'
    };
  }
  
  // 5. 最後の手段：デフォルト値を使用
  logger.warn(`No GitHub fallback data for ${symbol} (${dataType}). Using default values.`);
  
  const defaultData = {
    ...defaultValues,
    ticker: symbol,
    lastUpdated: new Date().toISOString(),
    source: 'Default Fallback'
  };
  
  // デフォルト値をキャッシュに保存（TTLを短く設定）
  if (useCache) {
    await cacheService.set(cacheKey, defaultData, 900); // 15分間
  }
  
  // 失敗を記録
  await fallbackDataStore.recordFailedFetch(
    symbol,
    dataType,
    'All sources failed, used default values'
  );
  
  return defaultData;
};

/**
 * 複数銘柄の一括取得（バッチ）
 * @param {Object} options - オプション
 * @param {Array<string>} options.symbols - 銘柄コードの配列
 * @param {string} options.dataType - データタイプ
 * @param {Array<Function>} options.fetchFunctions - データ取得関数の配列
 * @param {Object} options.defaultValues - デフォルト値
 * @param {boolean} [options.useCache=true] - キャッシュを使用するかどうか
 * @param {boolean} [options.refresh=false] - キャッシュを無視するかどうか
 * @param {Object} [options.cache] - キャッシュオプション
 * @param {number} [options.batchSize=10] - バッチサイズ
 * @param {number} [options.delayBetweenBatches=500] - バッチ間の遅延（ミリ秒）
 * @returns {Promise<Object>} 銘柄をキーとするデータオブジェクト
 */
const fetchBatchDataWithFallback = async (options) => {
  const { 
    symbols, 
    dataType, 
    fetchFunctions, 
    defaultValues,
    useCache = true,
    refresh = false,
    cache = {},
    batchSize = 10,
    delayBetweenBatches = 500
  } = options;
  
  if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
    throw new Error('Invalid symbols array');
  }
  
  logger.info(`Preparing to batch fetch ${symbols.length} symbols of type ${dataType}`);
  
  // 結果オブジェクト初期化
  const results = {};
  
  // バッチ処理のために配列を分割
  const batches = [];
  for (let i = 0; i < symbols.length; i += batchSize) {
    batches.push(symbols.slice(i, i + batchSize));
  }
  
  // 各バッチを処理
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
    // 並列処理
    const batchResults = await Promise.all(
      batch.map(symbol => 
        fetchDataWithFallback({
          symbol,
          dataType,
          fetchFunctions,
          defaultValues,
          useCache,
          refresh,
          cache
        })
      )
    );
    
    // 結果を統合
    batch.forEach((symbol, index) => {
      results[symbol] = batchResults[index];
    });
    
    // バッチ間に遅延を入れる（最後のバッチを除く）
    if (batchIndex < batches.length - 1) {
      await sleep(delayBetweenBatches);
    }
  }
  
  return results;
};

module.exports = {
  fetchDataWithFallback,
  fetchBatchDataWithFallback
};
