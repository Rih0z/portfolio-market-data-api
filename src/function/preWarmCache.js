/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/functions/preWarmCache.js
 * 
 * 説明: 
 * 人気銘柄のキャッシュを定期的に予熱するためのLambda関数。
 * CloudWatch Eventsによって1時間ごとに実行され、人気銘柄のデータを
 * 事前にAPIから取得してキャッシュに保存します。
 * 投資信託データはスクレイピングではなくCSVダウンロードから取得。
 * 
 * @author Portfolio Manager Team
 * @updated 2025-05-17
 */
'use strict';

const cacheService = require('../services/cache');
const yahooFinanceService = require('../services/sources/yahooFinance');
const exchangeRateService = require('../services/sources/exchangeRate');
const scrapingService = require('../services/sources/scraping');
const fundDataService = require('../services/sources/fundDataService');
const alertService = require('../services/alerts');
const { PREWARM_SYMBOLS, CACHE_TIMES, DATA_TYPES } = require('../config/constants');
const { ENV } = require('../config/envConfig');
const { withRetry, isRetryableApiError, sleep } = require('../utils/retry');
const logger = require('../utils/logger');
const { handleError, errorTypes } = require('../utils/errorHandler');

/**
 * キャッシュ予熱ハンドラー - 人気銘柄のデータを事前に取得してキャッシュに保存する
 * @param {Object} event - Lambda イベントオブジェクト
 * @param {Object} context - Lambda コンテキスト
 * @returns {Object} キャッシュ予熱結果
 */
exports.handler = async (event, context) => {
  logger.info('Starting cache pre-warm process');
  const startTime = Date.now();
  
  // リクエストのheader内に認証シークレットがない場合は警告
  const requestSecret = event.headers?.['x-cron-secret'] || '';
  if (requestSecret && ENV.CRON_SECRET && requestSecret !== ENV.CRON_SECRET) {
    logger.warn('Invalid cron secret provided');
    await alertService.sendAlert({
      subject: 'Invalid Cron Secret',
      message: 'An invalid cron secret was provided for the cache pre-warm function',
      detail: `Secret: ${requestSecret.substring(0, 4)}...`
    });
  }

  try {
    // 結果の初期化
    const results = {
      usStock: { success: 0, fail: 0, total: 0 },
      jpStock: { success: 0, fail: 0, total: 0 },
      mutualFund: { success: 0, fail: 0, total: 0 },
      exchangeRate: { success: 0, fail: 0, total: 0 }
    };
    
    // 1. 並列処理で全種別のキャッシュ予熱を開始
    const [usStockResults, jpStockResults, mutualFundResults, exchangeRateResult] = await Promise.allSettled([
      preWarmUsStocks(),
      preWarmJpStocks(),
      preWarmMutualFunds(),
      preWarmExchangeRates()
    ]);
    
    // 結果を集計
    if (usStockResults.status === 'fulfilled') {
      results.usStock = usStockResults.value;
    } else {
      logger.error('US stock pre-warm failed:', usStockResults.reason);
      results.usStock = { success: 0, fail: PREWARM_SYMBOLS.US_STOCK.length, total: PREWARM_SYMBOLS.US_STOCK.length, error: usStockResults.reason.message };
    }
    
    if (jpStockResults.status === 'fulfilled') {
      results.jpStock = jpStockResults.value;
    } else {
      logger.error('JP stock pre-warm failed:', jpStockResults.reason);
      results.jpStock = { success: 0, fail: PREWARM_SYMBOLS.JP_STOCK.length, total: PREWARM_SYMBOLS.JP_STOCK.length, error: jpStockResults.reason.message };
    }
    
    if (mutualFundResults.status === 'fulfilled') {
      results.mutualFund = mutualFundResults.value;
    } else {
      logger.error('Mutual fund pre-warm failed:', mutualFundResults.reason);
      results.mutualFund = { success: 0, fail: PREWARM_SYMBOLS.MUTUAL_FUND.length, total: PREWARM_SYMBOLS.MUTUAL_FUND.length, error: mutualFundResults.reason.message };
    }
    
    if (exchangeRateResult.status === 'fulfilled') {
      results.exchangeRate = exchangeRateResult.value;
    } else {
      logger.error('Exchange rate pre-warm failed:', exchangeRateResult.reason);
      results.exchangeRate = { success: 0, fail: 1, total: 1, error: exchangeRateResult.reason.message };
    }
    
    // 5. 期限切れのキャッシュをクリーンアップ
    logger.info('Cleaning up expired cache entries');
    const cleanupResult = await cacheService.cleanup();
    
    // 処理完了時間の計算
    const processingTime = Date.now() - startTime;
    
    // 結果をまとめる
    const summary = {
      usStock: results.usStock,
      jpStock: results.jpStock,
      mutualFund: results.mutualFund,
      exchangeRate: results.exchangeRate,
      cleanup: cleanupResult,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
    };
    
    // 失敗したアイテムがある場合はアラートを送信
    const totalFailed = results.usStock.fail + results.jpStock.fail + results.mutualFund.fail + results.exchangeRate.fail;
    const totalItems = results.usStock.total + results.jpStock.total + results.mutualFund.total + results.exchangeRate.total;
    
    if (totalFailed > 0) {
      const failRate = totalItems > 0 ? totalFailed / totalItems : 0;
      
      // 20%以上の失敗率の場合は警告
      if (failRate >= 0.2) {
        await alertService.sendAlert({
          subject: 'Cache Pre-warm Warning: High Failure Rate',
          message: `Cache pre-warming process completed with ${totalFailed} failures (${Math.round(failRate * 100)}% failure rate)`,
          detail: JSON.stringify(summary, null, 2)
        });
      }
    }
    
    logger.info('Cache pre-warm completed successfully', summary);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Cache pre-warm completed successfully',
        summary
      })
    };
  } catch (error) {
    logger.error('Error during cache pre-warm:', error);
    
    // 重大なエラーが発生した場合はアラート通知とエラーハンドリング
    await handleError(error, errorTypes.CRITICAL_ERROR, {
      process: 'cachePreWarm',
      alert: true
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Cache pre-warm failed',
        error: error.message
      })
    };
  }
};

/**
 * 米国株のキャッシュを予熱する
 * @returns {Promise<Object>} 予熱結果
 */
const preWarmUsStocks = async () => {
  const symbols = PREWARM_SYMBOLS.US_STOCK;
  logger.info(`Pre-warming ${symbols.length} US stock symbols`);
  
  const results = {
    success: 0,
    fail: 0, 
    total: symbols.length
  };
  
  try {
    // Yahoo FinanceのバッチAPIを使用して一括取得
    const batchData = await yahooFinanceService.getStocksData(symbols);
    
    // 取得に成功した銘柄をキャッシュに保存
    const cachePromises = [];
    
    for (const symbol of symbols) {
      if (batchData[symbol]) {
        const cacheKey = `${DATA_TYPES.US_STOCK}:${symbol}`;
        cachePromises.push(
          cacheService.set(cacheKey, batchData[symbol], CACHE_TIMES.US_STOCK)
            .then(() => {
              results.success++;
              return true;
            })
            .catch((error) => {
              logger.error(`Failed to cache US stock ${symbol}:`, error);
              results.fail++;
              return false;
            })
        );
      } else {
        results.fail++;
        logger.warn(`No data returned for US stock ${symbol}`);
      }
    }
    
    // 全てのキャッシュ保存を待機
    await Promise.all(cachePromises);
    
    return results;
  } catch (error) {
    logger.error('Error pre-warming US stocks:', error);
    
    // バッチ処理に失敗した場合は個別取得を試行
    return await preWarmUsStocksIndividually();
  }
};

/**
 * 米国株を個別に取得して予熱する（バッチ処理失敗時のフォールバック）
 * @returns {Promise<Object>} 予熱結果
 */
const preWarmUsStocksIndividually = async () => {
  const symbols = PREWARM_SYMBOLS.US_STOCK;
  logger.warn(`Falling back to individual pre-warming for ${symbols.length} US stocks`);
  
  const results = {
    success: 0,
    fail: 0, 
    total: symbols.length
  };
  
  const stockResults = await Promise.allSettled(
    symbols.map(async (symbol, index) => {
      try {
        // API制限を避けるために少し遅延を入れる
        const delay = index * 100; // 各リクエストを100msずつずらす
        if (delay > 0) {
          await sleep(delay);
        }
        
        // 米国株データの取得（再試行ロジック付き）
        const stockData = await withRetry(
          () => yahooFinanceService.getStockData(symbol),
          {
            maxRetries: 3,
            baseDelay: 300,
            shouldRetry: isRetryableApiError
          }
        );
        
        // キャッシュに保存
        const cacheKey = `${DATA_TYPES.US_STOCK}:${symbol}`;
        await cacheService.set(cacheKey, stockData, CACHE_TIMES.US_STOCK);
        
        logger.info(`Successfully pre-warmed US stock ${symbol}`);
        return { symbol, success: true };
      } catch (error) {
        logger.error(`Failed to pre-warm US stock ${symbol}:`, error.message);
        return { symbol, success: false, error: error.message };
      }
    })
  );
  
  // 結果を集計
  stockResults.forEach(result => {
    if (result.status === 'fulfilled' && result.value.success) {
      results.success++;
    } else {
      results.fail++;
    }
  });
  
  return results;
};

/**
 * 日本株のキャッシュを予熱する
 * @returns {Promise<Object>} 予熱結果
 */
const preWarmJpStocks = async () => {
  const codes = PREWARM_SYMBOLS.JP_STOCK;
  logger.info(`Pre-warming ${codes.length} Japanese stock codes`);
  
  const results = {
    success: 0,
    fail: 0, 
    total: codes.length
  };
  
  const stockResults = await Promise.allSettled(
    codes.map(async (code, index) => {
      try {
        // API制限を避けるために少し遅延を入れる
        const delay = index * 200; // 各リクエストを200msずつずらす
        if (delay > 0) {
          await sleep(delay);
        }
        
        // 日本株データの取得（再試行ロジック付き）
        const stockData = await withRetry(
          () => scrapingService.scrapeJpStock(code),
          {
            maxRetries: 3,
            baseDelay: 500,
            shouldRetry: isRetryableApiError
          }
        );
        
        // キャッシュに保存
        const cacheKey = `${DATA_TYPES.JP_STOCK}:${code}`;
        await cacheService.set(cacheKey, stockData, CACHE_TIMES.JP_STOCK);
        
        logger.info(`Successfully pre-warmed JP stock ${code}`);
        return { code, success: true };
      } catch (error) {
        logger.error(`Failed to pre-warm JP stock ${code}:`, error.message);
        return { code, success: false, error: error.message };
      }
    })
  );
  
  // 結果を集計
  stockResults.forEach(result => {
    if (result.status === 'fulfilled' && result.value.success) {
      results.success++;
    } else {
      results.fail++;
    }
  });
  
  return results;
};

/**
 * 投資信託のキャッシュを予熱する
 * @returns {Promise<Object>} 予熱結果
 */
const preWarmMutualFunds = async () => {
  const codes = PREWARM_SYMBOLS.MUTUAL_FUND;
  logger.info(`Pre-warming ${codes.length} mutual fund codes`);
  
  const results = {
    success: 0,
    fail: 0, 
    total: codes.length
  };
  
  const fundResults = await Promise.allSettled(
    codes.map(async (symbol, index) => {
      try {
        // API制限を避けるために少し遅延を入れる
        const delay = index * 200; // 各リクエストを200msずつずらす
        if (delay > 0) {
          await sleep(delay);
        }
        
        // シンボル形式を正規化（末尾のCを取り除く）
        const fundCode = symbol.replace(/C$/i, '');
        
        // 投資信託データの取得（CSV方式、再試行ロジック付き）
        const fundData = await withRetry(
          () => fundDataService.getMutualFundData(fundCode),
          {
            maxRetries: 3,
            baseDelay: 500,
            shouldRetry: isRetryableApiError
          }
        );
        
        // fundDataService内部でキャッシュされているので追加のキャッシュ操作は不要
        logger.info(`Successfully pre-warmed mutual fund ${fundCode}`);
        return { symbol: fundCode, success: true };
      } catch (error) {
        logger.error(`Failed to pre-warm mutual fund ${symbol}:`, error.message);
        return { symbol, success: false, error: error.message };
      }
    })
  );
  
  // 結果を集計
  fundResults.forEach(result => {
    if (result.status === 'fulfilled' && result.value.success) {
      results.success++;
    } else {
      results.fail++;
    }
  });
  
  return results;
};

/**
 * 為替レートのキャッシュを予熱する
 * @returns {Promise<Object>} 予熱結果
 */
const preWarmExchangeRates = async () => {
  logger.info('Pre-warming exchange rate data');
  
  const results = {
    success: 0,
    fail: 0, 
    total: 1
  };
  
  try {
    // USD/JPYの為替レートを取得（再試行ロジック付き）
    const exchangeRate = await withRetry(
      () => exchangeRateService.getExchangeRate('USD', 'JPY'),
      {
        maxRetries: 3,
        baseDelay: 300,
        shouldRetry: isRetryableApiError
      }
    );
    
    // キャッシュに保存
    const cacheKey = `${DATA_TYPES.EXCHANGE_RATE}:USD-JPY`;
    await cacheService.set(cacheKey, exchangeRate, CACHE_TIMES.EXCHANGE_RATE);
    
    logger.info('Successfully pre-warmed USD/JPY exchange rate');
    results.success = 1;
  } catch (error) {
    logger.error('Failed to pre-warm exchange rate:', error.message);
    results.fail = 1;
    
    // エラーハンドリング
    await handleError(error, errorTypes.DATA_SOURCE_ERROR, {
      dataType: 'exchange_rate',
      pair: 'USD/JPY'
    });
  }
  
  return results;
};
