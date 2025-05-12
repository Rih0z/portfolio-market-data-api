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
 * @updated 2025-05-14
 */
'use strict';

const cacheService = require('../services/cache');
const yahooFinanceService = require('../services/sources/yahooFinance');
const exchangeRateService = require('../services/sources/exchangeRate');
const scrapingService = require('../services/sources/scraping');
const fundDataService = require('../services/sources/fundDataService'); // 新しいCSVデータソース
const alertService = require('../services/alerts');
const { PREWARM_SYMBOLS, CACHE_TIMES, DATA_TYPES } = require('../config/constants');
const { withRetry, isRetryableApiError, sleep } = require('../utils/retry');

/**
 * キャッシュ予熱ハンドラー - 人気銘柄のデータを事前に取得してキャッシュに保存する
 * @param {Object} event - Lambda イベントオブジェクト
 * @param {Object} context - Lambda コンテキスト
 * @returns {Object} キャッシュ予熱結果
 */
exports.handler = async (event, context) => {
  console.log('Starting cache pre-warm process');
  const startTime = Date.now();
  
  // リクエストのheader内に認証シークレットがない場合は警告
  const requestSecret = event.headers?.['x-cron-secret'] || '';
  if (requestSecret && process.env.CRON_SECRET && requestSecret !== process.env.CRON_SECRET) {
    console.warn('Invalid cron secret provided');
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
    
    // 1. 米国株の予熱（並列処理）
    console.log('Pre-warming US stock data');
    results.usStock.total = PREWARM_SYMBOLS.US_STOCK.length;
    
    const usStockResults = await Promise.allSettled(
      PREWARM_SYMBOLS.US_STOCK.map(async (symbol, index) => {
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
          
          console.log(`Successfully pre-warmed US stock ${symbol}`);
          return { symbol, success: true };
        } catch (error) {
          console.error(`Failed to pre-warm US stock ${symbol}:`, error.message);
          return { symbol, success: false, error: error.message };
        }
      })
    );
    
    // 結果を集計
    usStockResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value.success) {
        results.usStock.success++;
      } else {
        results.usStock.fail++;
      }
    });
    
    // 2. 日本株の予熱（並列処理）
    console.log('Pre-warming Japanese stock data');
    results.jpStock.total = PREWARM_SYMBOLS.JP_STOCK.length;
    
    const jpStockResults = await Promise.allSettled(
      PREWARM_SYMBOLS.JP_STOCK.map(async (symbol, index) => {
        try {
          // API制限を避けるために少し遅延を入れる
          const delay = index * 200; // 各リクエストを200msずつずらす
          if (delay > 0) {
            await sleep(delay);
          }
          
          // 日本株データの取得（再試行ロジック付き）
          const stockData = await withRetry(
            () => scrapingService.scrapeJpStock(symbol),
            {
              maxRetries: 3,
              baseDelay: 500,
              shouldRetry: isRetryableApiError
            }
          );
          
          // キャッシュに保存
          const cacheKey = `${DATA_TYPES.JP_STOCK}:${symbol}`;
          await cacheService.set(cacheKey, stockData, CACHE_TIMES.JP_STOCK);
          
          console.log(`Successfully pre-warmed JP stock ${symbol}`);
          return { symbol, success: true };
        } catch (error) {
          console.error(`Failed to pre-warm JP stock ${symbol}:`, error.message);
          return { symbol, success: false, error: error.message };
        }
      })
    );
    
    // 結果を集計
    jpStockResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value.success) {
        results.jpStock.success++;
      } else {
        results.jpStock.fail++;
      }
    });
    
    // 3. 投資信託の予熱（並列処理） - CSVダウンロード方式に変更
    console.log('Pre-warming mutual fund data');
    results.mutualFund.total = PREWARM_SYMBOLS.MUTUAL_FUND.length;
    
    const mutualFundResults = await Promise.allSettled(
      PREWARM_SYMBOLS.MUTUAL_FUND.map(async (symbol, index) => {
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
          
          // キャッシュは内部で行われているので、ここでは省略
          console.log(`Successfully pre-warmed mutual fund ${fundCode}`);
          return { symbol: fundCode, success: true };
        } catch (error) {
          console.error(`Failed to pre-warm mutual fund ${symbol}:`, error.message);
          return { symbol, success: false, error: error.message };
        }
      })
    );
    
    // 結果を集計
    mutualFundResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value.success) {
        results.mutualFund.success++;
      } else {
        results.mutualFund.fail++;
      }
    });
    
    // 4. 為替レートの予熱
    console.log('Pre-warming exchange rate data');
    results.exchangeRate.total = 1;
    
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
      
      console.log('Successfully pre-warmed USD/JPY exchange rate');
      results.exchangeRate.success = 1;
    } catch (error) {
      console.error('Failed to pre-warm exchange rate:', error.message);
      results.exchangeRate.fail = 1;
    }
    
    // 5. 期限切れのキャッシュをクリーンアップ
    console.log('Cleaning up expired cache entries');
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
    if (totalFailed > 0) {
      const failRate = totalFailed / (results.usStock.total + results.jpStock.total + results.mutualFund.total + results.exchangeRate.total);
      
      // 20%以上の失敗率の場合は警告
      if (failRate >= 0.2) {
        await alertService.sendAlert({
          subject: 'Cache Pre-warm Warning: High Failure Rate',
          message: `Cache pre-warming process completed with ${totalFailed} failures (${Math.round(failRate * 100)}% failure rate)`,
          detail: summary
        });
      }
    }
    
    console.log('Cache pre-warm completed successfully', summary);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Cache pre-warm completed successfully',
        summary
      })
    };
  } catch (error) {
    console.error('Error during cache pre-warm:', error);
    
    // 重大なエラーが発生した場合はアラート通知
    await alertService.sendAlert({
      subject: 'Cache Pre-warm Failed',
      message: 'The scheduled cache pre-warm process failed',
      detail: error.message,
      critical: true
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
