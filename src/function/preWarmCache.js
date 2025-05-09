/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/functions/preWarmCache.js
 * 
 * 説明: 
 * 人気銘柄のキャッシュを定期的に予熱するためのLambda関数。
 * CloudWatch Eventsによって1時間ごとに実行され、人気銘柄のデータを
 * 事前にAPIから取得してキャッシュに保存します。
 */
const cacheService = require('../services/cache');
const yahooFinanceService = require('../services/sources/yahooFinance');
const exchangeRateService = require('../services/sources/exchangeRate');
const scrapingService = require('../services/sources/scraping');
const alertService = require('../services/alerts');
const { PREWARM_SYMBOLS, CACHE_TIMES, DATA_TYPES } = require('../config/constants');

/**
 * キャッシュ予熱ハンドラー
 * 人気銘柄のデータを事前に取得してキャッシュに保存する
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
    
    // 1. 米国株の予熱
    console.log('Pre-warming US stock data');
    for (const symbol of PREWARM_SYMBOLS.US_STOCK) {
      results.usStock.total++;
      try {
        // 米国株データの取得
        const stockData = await yahooFinanceService.getStockData(symbol);
        
        // キャッシュに保存
        const cacheKey = `${DATA_TYPES.US_STOCK}:${symbol}`;
        await cacheService.set(cacheKey, stockData, CACHE_TIMES.US_STOCK);
        
        console.log(`Successfully pre-warmed US stock ${symbol}`);
        results.usStock.success++;
      } catch (error) {
        console.error(`Failed to pre-warm US stock ${symbol}:`, error.message);
        results.usStock.fail++;
      }
      
      // 少し間隔を開けてAPI制限に引っかからないようにする
      await sleep(500);
    }
    
    // 2. 日本株の予熱
    console.log('Pre-warming Japanese stock data');
    for (const symbol of PREWARM_SYMBOLS.JP_STOCK) {
      results.jpStock.total++;
      try {
        // 日本株データの取得
        const stockData = await scrapingService.scrapeJpStock(symbol);
        
        // キャッシュに保存
        const cacheKey = `${DATA_TYPES.JP_STOCK}:${symbol}`;
        await cacheService.set(cacheKey, stockData, CACHE_TIMES.JP_STOCK);
        
        console.log(`Successfully pre-warmed JP stock ${symbol}`);
        results.jpStock.success++;
      } catch (error) {
        console.error(`Failed to pre-warm JP stock ${symbol}:`, error.message);
        results.jpStock.fail++;
      }
      
      // 少し間隔を開けてAPI制限に引っかからないようにする
      await sleep(500);
    }
    
    // 3. 投資信託の予熱
    console.log('Pre-warming mutual fund data');
    for (const symbol of PREWARM_SYMBOLS.MUTUAL_FUND) {
      results.mutualFund.total++;
      try {
        // 投資信託の基準価額データを取得
        // シンボル形式を正規化（末尾のCを取り除く）
        const fundCode = symbol.replace(/C$/i, '');
        const fundData = await scrapingService.scrapeMutualFund(fundCode);
        
        // キャッシュに保存
        const cacheKey = `${DATA_TYPES.MUTUAL_FUND}:${fundCode}`;
        await cacheService.set(cacheKey, fundData, CACHE_TIMES.MUTUAL_FUND);
        
        console.log(`Successfully pre-warmed mutual fund ${fundCode}`);
        results.mutualFund.success++;
      } catch (error) {
        console.error(`Failed to pre-warm mutual fund ${symbol}:`, error.message);
        results.mutualFund.fail++;
      }
      
      // 少し間隔を開けてAPI制限に引っかからないようにする
      await sleep(500);
    }
    
    // 4. 為替レートの予熱
    console.log('Pre-warming exchange rate data');
    results.exchangeRate.total++;
    try {
      // USD/JPYの為替レートを取得
      const exchangeRate = await exchangeRateService.getExchangeRate('USD', 'JPY');
      
      // キャッシュに保存
      const cacheKey = `${DATA_TYPES.EXCHANGE_RATE}:USD-JPY`;
      await cacheService.set(cacheKey, exchangeRate, CACHE_TIMES.EXCHANGE_RATE);
      
      console.log('Successfully pre-warmed USD/JPY exchange rate');
      results.exchangeRate.success++;
    } catch (error) {
      console.error('Failed to pre-warm exchange rate:', error.message);
      results.exchangeRate.fail++;
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
      detail: error.message
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
 * 指定したミリ秒だけ処理を一時停止する
 * @param {number} ms - 待機するミリ秒数
 * @returns {Promise<void>} 待機が完了したら解決するPromise
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
