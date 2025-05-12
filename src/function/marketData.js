/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/function/marketData.js
 * 
 * 説明: 
 * マーケットデータAPIのLambdaハンドラー関数。
 * API Gatewayからのリクエストを受け取り、様々なデータソースから
 * 株式・投資信託・為替レートのデータを取得して返却します。
 * キャッシュ機能と使用量制限も管理します。
 * 
 * @author Portfolio Manager Team
 * @updated 2025-05-16
 */
'use strict';

const yahooFinanceService = require('../services/sources/yahooFinance');
const scrapingService = require('../services/sources/scraping');
const exchangeRateService = require('../services/sources/exchangeRate');
const cacheService = require('../services/cache');
const usageService = require('../services/usage');
const alertService = require('../services/alerts');
const { DATA_TYPES, CACHE_TIMES, ERROR_CODES, RESPONSE_FORMATS } = require('../config/constants');
const { isBudgetCritical, getBudgetWarningMessage } = require('../utils/budgetCheck');
const { formatResponse, formatErrorResponse } = require('../utils/responseUtils');

/**
 * リクエストパラメータを検証する
 * @param {Object} params - リクエストパラメータ
 * @returns {Object} 検証結果
 */
const validateParams = (params) => {
  const result = {
    isValid: true,
    errors: []
  };

  // タイプパラメータのチェック
  if (!params.type) {
    result.isValid = false;
    result.errors.push('Missing required parameter: type');
  } else if (!Object.values(DATA_TYPES).includes(params.type)) {
    result.isValid = false;
    result.errors.push(`Invalid type: ${params.type}. Allowed values: ${Object.values(DATA_TYPES).join(', ')}`);
  }

  // シンボルパラメータのチェック
  if (!params.symbols) {
    result.isValid = false;
    result.errors.push('Missing required parameter: symbols');
  } else {
    const symbolsArray = params.symbols.split(',');
    if (symbolsArray.length === 0) {
      result.isValid = false;
      result.errors.push('symbols parameter cannot be empty');
    } else if (symbolsArray.length > 50) {
      result.isValid = false;
      result.errors.push('Too many symbols. Maximum 50 symbols allowed');
    }
  }

  // 為替レート特有のパラメータのチェック
  if (params.type === DATA_TYPES.EXCHANGE_RATE) {
    if (!params.base) {
      result.isValid = false;
      result.errors.push('Missing required parameter for exchange rate: base');
    }
    if (!params.target) {
      result.isValid = false;
      result.errors.push('Missing required parameter for exchange rate: target');
    }
  }

  return result;
};

/**
 * マーケットデータAPIのLambdaハンドラー関数
 * @param {Object} event - Lambda イベントオブジェクト
 * @param {Object} context - Lambda コンテキスト
 * @returns {Promise<Object>} APIレスポンス
 */
exports.handler = async (event, context) => {
  const startTime = Date.now();
  
  try {
    console.log('Received market data request:', JSON.stringify({ 
      path: event.path,
      queryParams: event.queryStringParameters,
      headers: { 
        'User-Agent': event.headers?.['User-Agent'],
        'X-Forwarded-For': event.headers?.['X-Forwarded-For']
      }
    }));
    
    // パラメータの取得と初期化
    const params = event.queryStringParameters || {};
    const type = params.type;
    const symbols = params.symbols ? params.symbols.split(',') : [];
    const refresh = params.refresh === 'true';
    const userIp = event.headers?.['X-Forwarded-For'] || 'unknown';
    const userAgent = event.headers?.['User-Agent'] || 'unknown';
    const sessionId = event.headers?.['Cookie']?.match(/session=([^;]+)/)?.[1];
    
    // パラメータの検証
    const validation = validateParams(params);
    if (!validation.isValid) {
      return await formatErrorResponse({
        statusCode: 400,
        code: ERROR_CODES.INVALID_PARAMS,
        message: `Invalid request parameters: ${validation.errors.join(', ')}`
      });
    }
    
    // 予算使用状況をチェック
    const budgetCritical = await isBudgetCritical();

    // 予算が臨界値に達していて、リフレッシュのリクエストの場合は拒否
    if (budgetCritical && refresh) {
      const warningMessage = await getBudgetWarningMessage();
      return await formatErrorResponse({
        statusCode: 403,
        code: ERROR_CODES.LIMIT_EXCEEDED,
        message: warningMessage || 'Free Tier budget usage is at critical level. Cache refresh is temporarily disabled to prevent additional charges.',
        headers: { 'X-Budget-Warning': 'CRITICAL' },
        details: { budgetCritical: true }
      });
    }
    
    // 使用量制限のチェック
    const usageCheck = await usageService.checkAndUpdateUsage({
      dataType: type,
      ip: userIp,
      userAgent,
      sessionId
    });
    
    if (!usageCheck.allowed) {
      return await formatErrorResponse({
        statusCode: 429,
        code: ERROR_CODES.LIMIT_EXCEEDED,
        message: `API usage limit exceeded. Daily limit: ${usageCheck.usage.daily.limit}, Monthly limit: ${usageCheck.usage.monthly.limit}`,
        usage: usageCheck.usage
      });
    }

    // データ取得処理
    let data = {};
    let dataSource = 'API';
    let lastUpdated = new Date().toISOString();
    
    // データタイプに応じた処理
    switch (type) {
      case DATA_TYPES.US_STOCK:
        data = await getUsStockData(symbols, refresh);
        break;
      
      case DATA_TYPES.JP_STOCK:
        data = await getJpStockData(symbols, refresh);
        break;
      
      case DATA_TYPES.MUTUAL_FUND:
        data = await getMutualFundData(symbols, refresh);
        break;
      
      case DATA_TYPES.EXCHANGE_RATE:
        const base = params.base || 'USD';
        const target = params.target || 'JPY';
        data = await getExchangeRateData(base, target, refresh);
        break;
      
      default:
        throw new Error(`Unsupported data type: ${type}`);
    }
    
    // レスポンスの構築
    const processingTime = `${Date.now() - startTime}ms`;
    
    return await formatResponse({
      data,
      source: dataSource,
      lastUpdated,
      processingTime,
      usage: {
        daily: usageCheck.usage.daily,
        monthly: usageCheck.usage.monthly
      }
    });
  } catch (error) {
    console.error('Error processing market data request:', error);

    // 重大エラーの場合はアラート通知
    await alertService.notifyError(
      'Market Data API Error',
      error,
      {
        path: event.path,
        params: event.queryStringParameters,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    );

    return await formatErrorResponse({
      statusCode: 500,
      code: ERROR_CODES.SERVER_ERROR,
      message: 'An error occurred while processing your request',
      details: error.message
    });
  }
};

/**
 * 複数銘柄のデータを取得する共通関数
 * @param {Array<string>} symbols - ティッカーシンボルの配列
 * @param {boolean} refresh - キャッシュを無視するかどうか
 * @param {Object} options - オプション 
 * @returns {Promise<Object>} データオブジェクト
 */
const getMarketData = async (symbols, refresh, options) => {
  const { 
    dataType, 
    cacheTime, 
    fetchFunction, 
    defaultValue = {} 
  } = options;

  const result = {};
  
  // キャッシュチェックを並列で実行
  const cacheChecks = await Promise.all(
    symbols.map(async (symbol) => {
      const cacheKey = `${dataType}:${symbol}`;
      if (!refresh) {
        const cachedData = await cacheService.get(cacheKey);
        return { symbol, cachedData, cacheKey };
      }
      return { symbol, cachedData: null, cacheKey };
    })
  );
  
  // キャッシュヒットとミスを分類
  const cacheMisses = [];
  cacheChecks.forEach(({ symbol, cachedData, cacheKey }) => {
    if (cachedData) {
      result[symbol] = cachedData;
    } else {
      cacheMisses.push({ symbol, cacheKey });
    }
  });
  
  // キャッシュにないデータを取得
  if (cacheMisses.length > 0) {
    console.log(`Fetching ${dataType} data for ${cacheMisses.length} symbols`);
    
    try {
      // バッチ取得または個別取得は実装によって異なる
      const fetchedData = await fetchFunction(cacheMisses.map(item => item.symbol));
      
      // 結果を処理
      for (const { symbol, cacheKey } of cacheMisses) {
        if (fetchedData[symbol]) {
          await cacheService.set(cacheKey, fetchedData[symbol], cacheTime);
          result[symbol] = fetchedData[symbol];
        } else {
          // デフォルト値を適用
          result[symbol] = {
            ...defaultValue,
            ticker: symbol,
            lastUpdated: new Date().toISOString(),
            source: 'API Error',
            error: 'Data not available'
          };
        }
      }
    } catch (error) {
      console.error(`Error fetching ${dataType} data:`, error);
      
      // エラー時は全てのミスにデフォルト値を設定
      for (const { symbol } of cacheMisses) {
        result[symbol] = {
          ...defaultValue,
          ticker: symbol,
          lastUpdated: new Date().toISOString(),
          source: 'API Error',
          error: error.message
        };
      }
    }
  }
  
  return result;
};

/**
 * 米国株データを取得する
 * @param {Array<string>} symbols - ティッカーシンボルの配列
 * @param {boolean} refresh - キャッシュを無視するかどうか
 * @returns {Promise<Object>} 株価データ
 */
const getUsStockData = async (symbols, refresh = false) => {
  return await getMarketData(symbols, refresh, {
    dataType: DATA_TYPES.US_STOCK,
    cacheTime: CACHE_TIMES.US_STOCK,
    fetchFunction: async (symbolsList) => {
      try {
        // まずバッチ取得を試みる
        return await yahooFinanceService.getStocksData(symbolsList);
      } catch (error) {
        console.error('Error in batch fetch, falling back to individual fetch:', error);
        
        // バッチ取得失敗時は個別取得
        const result = {};
        await Promise.allSettled(
          symbolsList.map(async (symbol) => {
            try {
              const data = await yahooFinanceService.getStockData(symbol);
              if (data) result[symbol] = data;
            } catch (err) {
              console.error(`Individual fetch failed for ${symbol}:`, err);
            }
          })
        );
        return result;
      }
    },
    defaultValue: {
      price: null,
      change: null,
      changePercent: null,
      currency: 'USD',
      isStock: true,
      isMutualFund: false
    }
  });
};

/**
 * 日本株データを取得する
 * @param {Array<string>} codes - 証券コードの配列
 * @param {boolean} refresh - キャッシュを無視するかどうか
 * @returns {Promise<Object>} 株価データ
 */
const getJpStockData = async (codes, refresh = false) => {
  return await getMarketData(codes, refresh, {
    dataType: DATA_TYPES.JP_STOCK,
    cacheTime: CACHE_TIMES.JP_STOCK,
    fetchFunction: async (codesList) => {
      try {
        return await scrapingService.scrapeJpStocksParallel(codesList);
      } catch (error) {
        console.error('Error in batch scraping, falling back to individual fetch:', error);
        
        // バッチ取得失敗時は個別取得
        const result = {};
        await Promise.allSettled(
          codesList.map(async (code) => {
            try {
              const data = await scrapingService.scrapeJpStock(code);
              if (data) result[code] = data;
            } catch (err) {
              console.error(`Individual scrape failed for ${code}:`, err);
            }
          })
        );
        return result;
      }
    },
    defaultValue: {
      price: null,
      change: null,
      changePercent: null,
      name: (code) => `日本株 ${code}`,
      currency: 'JPY',
      isStock: true,
      isMutualFund: false
    }
  });
};

/**
 * 投資信託データを取得する
 * @param {Array<string>} codes - ファンドコードの配列
 * @param {boolean} refresh - キャッシュを無視するかどうか
 * @returns {Promise<Object>} 投資信託データ
 */
const getMutualFundData = async (codes, refresh = false) => {
  return await getMarketData(codes, refresh, {
    dataType: DATA_TYPES.MUTUAL_FUND,
    cacheTime: CACHE_TIMES.MUTUAL_FUND,
    fetchFunction: async (codesList) => {
      return await scrapingService.scrapeMutualFundsParallel(codesList);
    },
    defaultValue: {
      price: null,
      change: null,
      changePercent: null,
      name: (code) => `投資信託 ${code}C`,
      currency: 'JPY',
      isStock: false,
      isMutualFund: true,
      priceLabel: '基準価額'
    }
  });
};

/**
 * 為替レートデータを取得する
 * @param {string} base - ベース通貨
 * @param {string} target - 対象通貨
 * @param {boolean} refresh - キャッシュを無視するかどうか
 * @returns {Promise<Object>} 為替レートデータ
 */
const getExchangeRateData = async (base, target, refresh = false) => {
  const pair = `${base}-${target}`;
  const cacheKey = `${DATA_TYPES.EXCHANGE_RATE}:${pair}`;
  
  // キャッシュをチェック
  if (!refresh) {
    const cachedData = await cacheService.get(cacheKey);
    
    if (cachedData) {
      return { [pair]: cachedData };
    }
  }
  
  // キャッシュにないデータを取得
  try {
    const exchangeRate = await exchangeRateService.getExchangeRate(base, target);
    
    if (exchangeRate) {
      // キャッシュに保存
      await cacheService.set(cacheKey, exchangeRate, CACHE_TIMES.EXCHANGE_RATE);
      return { [pair]: exchangeRate };
    }
  } catch (error) {
    console.error(`Error fetching exchange rate data for ${pair}:`, error);
    
    // エラーでも何か返せるようにフォールバック値を設定
    return {
      [pair]: {
        pair,
        base,
        target,
        rate: null,
        change: null,
        changePercent: null,
        lastUpdated: new Date().toISOString(),
        source: 'API Error',
        error: error.message
      }
    };
  }
  
  return {};
};
