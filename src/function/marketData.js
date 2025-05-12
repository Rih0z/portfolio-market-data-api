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
 * @updated 2025-05-14
 */
'use strict';

const yahooFinanceService = require('../services/sources/yahooFinance');
const scrapingService = require('../services/sources/scraping');
const exchangeRateService = require('../services/sources/exchangeRate');
const cacheService = require('../services/cache');
const usageService = require('../services/usage');
const alertService = require('../services/alerts');
const { DATA_TYPES, CACHE_TIMES, ERROR_CODES, RESPONSE_FORMATS } = require('../config/constants');

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
 * レスポンス形式を整形する
 * @param {Object} data - レスポンスデータ
 * @param {Object} options - オプション
 * @returns {Object} 整形されたレスポンス
 */
const formatResponse = (data, options = {}) => {
  const { processingTime, usage, source = 'API', lastUpdated = new Date().toISOString() } = options;

  return {
    success: true,
    data,
    source,
    lastUpdated,
    processingTime,
    usage
  };
};

/**
 * エラーレスポンス形式を整形する
 * @param {string} message - エラーメッセージ
 * @param {string} code - エラーコード
 * @param {Object} details - 詳細情報（オプション）
 * @returns {Object} 整形されたエラーレスポンス
 */
const formatErrorResponse = (message, code = ERROR_CODES.SERVER_ERROR, details = null) => {
  const response = {
    ...RESPONSE_FORMATS.ERROR,
    error: {
      code,
      message
    }
  };

  if (details && process.env.NODE_ENV !== 'production') {
    response.error.details = details;
  }

  return response;
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
      return {
        statusCode: 400,
        body: JSON.stringify(formatErrorResponse(
          `Invalid request parameters: ${validation.errors.join(', ')}`,
          ERROR_CODES.INVALID_PARAMS
        ))
      };
    }
    
    // 使用量制限のチェック
    const usageCheck = await usageService.checkAndUpdateUsage({
      dataType: type,
      ip: userIp,
      userAgent,
      sessionId
    });
    
    if (!usageCheck.allowed) {
      return {
        statusCode: 429,
        body: JSON.stringify(formatErrorResponse(
          `API usage limit exceeded. Daily limit: ${usageCheck.usage.daily.limit}, Monthly limit: ${usageCheck.usage.monthly.limit}`,
          ERROR_CODES.LIMIT_EXCEEDED,
          usageCheck.usage
        ))
      };
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
    
    const response = formatResponse(data, {
      processingTime,
      usage: {
        daily: usageCheck.usage.daily,
        monthly: usageCheck.usage.monthly
      },
      source: dataSource,
      lastUpdated
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify(response)
    };
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

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify(formatErrorResponse(
        'An error occurred while processing your request',
        ERROR_CODES.SERVER_ERROR,
        error.message
      ))
    };
  }
};

/**
 * 米国株データを取得する
 * @param {Array<string>} symbols - ティッカーシンボルの配列
 * @param {boolean} refresh - キャッシュを無視するかどうか
 * @returns {Promise<Object>} 株価データ
 */
const getUsStockData = async (symbols, refresh = false) => {
  const result = {};
  const cacheMisses = [];
  
  // シンボルごとにキャッシュをチェック
  for (const symbol of symbols) {
    const cacheKey = `${DATA_TYPES.US_STOCK}:${symbol}`;
    
    if (!refresh) {
      const cachedData = await cacheService.get(cacheKey);
      
      if (cachedData) {
        result[symbol] = cachedData;
        continue;
      }
    }
    
    cacheMisses.push(symbol);
  }
  
  // キャッシュにないデータを取得
  if (cacheMisses.length > 0) {
    console.log(`Fetching US stock data for ${cacheMisses.length} symbols:`, cacheMisses);
    
    // APIから一括取得（可能なら）
    try {
      const batchData = await yahooFinanceService.getStocksData(cacheMisses);
      
      // 結果を個別にキャッシュに保存し、結果に追加
      for (const symbol in batchData) {
        const stockData = batchData[symbol];
        
        if (stockData) {
          const cacheKey = `${DATA_TYPES.US_STOCK}:${symbol}`;
          await cacheService.set(cacheKey, stockData, CACHE_TIMES.US_STOCK);
          result[symbol] = stockData;
        }
      }
    } catch (error) {
      console.error('Error fetching batch US stock data:', error);
      
      // バッチ取得に失敗した場合は個別に取得を試みる
      for (const symbol of cacheMisses) {
        try {
          const stockData = await yahooFinanceService.getStockData(symbol);
          
          if (stockData) {
            const cacheKey = `${DATA_TYPES.US_STOCK}:${symbol}`;
            await cacheService.set(cacheKey, stockData, CACHE_TIMES.US_STOCK);
            result[symbol] = stockData;
          }
        } catch (symbolError) {
          console.error(`Error fetching US stock data for ${symbol}:`, symbolError);
          
          // エラーでも何か返せるようにフォールバック値を設定
          result[symbol] = {
            ticker: symbol,
            price: null,
            change: null,
            changePercent: null,
            name: symbol,
            currency: 'USD',
            lastUpdated: new Date().toISOString(),
            source: 'API Error',
            isStock: true,
            isMutualFund: false,
            error: symbolError.message
          };
        }
      }
    }
  }
  
  return result;
};

/**
 * 日本株データを取得する
 * @param {Array<string>} codes - 証券コードの配列
 * @param {boolean} refresh - キャッシュを無視するかどうか
 * @returns {Promise<Object>} 株価データ
 */
const getJpStockData = async (codes, refresh = false) => {
  const result = {};
  const cacheMisses = [];
  
  // コードごとにキャッシュをチェック
  for (const code of codes) {
    const cacheKey = `${DATA_TYPES.JP_STOCK}:${code}`;
    
    if (!refresh) {
      const cachedData = await cacheService.get(cacheKey);
      
      if (cachedData) {
        result[code] = cachedData;
        continue;
      }
    }
    
    cacheMisses.push(code);
  }
  
  // キャッシュにないデータを取得
  if (cacheMisses.length > 0) {
    console.log(`Fetching JP stock data for ${cacheMisses.length} codes:`, cacheMisses);
    
    // スクレイピングで一括取得
    try {
      const batchData = await scrapingService.scrapeJpStocksParallel(cacheMisses);
      
      // 結果を個別にキャッシュに保存し、結果に追加
      for (const code in batchData) {
        const stockData = batchData[code];
        
        if (stockData) {
          const cacheKey = `${DATA_TYPES.JP_STOCK}:${code}`;
          await cacheService.set(cacheKey, stockData, CACHE_TIMES.JP_STOCK);
          result[code] = stockData;
        }
      }
    } catch (error) {
      console.error('Error scraping batch JP stock data:', error);
      
      // バッチ取得に失敗した場合は個別に取得を試みる
      for (const code of cacheMisses) {
        try {
          const stockData = await scrapingService.scrapeJpStock(code);
          
          if (stockData) {
            const cacheKey = `${DATA_TYPES.JP_STOCK}:${code}`;
            await cacheService.set(cacheKey, stockData, CACHE_TIMES.JP_STOCK);
            result[code] = stockData;
          }
        } catch (codeError) {
          console.error(`Error scraping JP stock data for ${code}:`, codeError);
          
          // エラーでも何か返せるようにフォールバック値を設定
          result[code] = {
            ticker: code,
            price: null,
            change: null,
            changePercent: null,
            name: `日本株 ${code}`,
            currency: 'JPY',
            lastUpdated: new Date().toISOString(),
            source: 'API Error',
            isStock: true,
            isMutualFund: false,
            error: codeError.message
          };
        }
      }
    }
  }
  
  return result;
};

/**
 * 投資信託データを取得する（CSVダウンロード方式に変更）
 * @param {Array<string>} codes - ファンドコードの配列
 * @param {boolean} refresh - キャッシュを無視するかどうか
 * @returns {Promise<Object>} 投資信託データ
 */
const getMutualFundData = async (codes, refresh = false) => {
  const result = {};
  const cacheMisses = [];
  
  // コードごとにキャッシュをチェック
  for (const code of codes) {
    const cacheKey = `${DATA_TYPES.MUTUAL_FUND}:${code}`;
    
    if (!refresh) {
      const cachedData = await cacheService.get(cacheKey);
      
      if (cachedData) {
        result[code] = cachedData;
        continue;
      }
    }
    
    cacheMisses.push(code);
  }
  
  // キャッシュにないデータを取得
  if (cacheMisses.length > 0) {
    console.log(`Fetching mutual fund data for ${cacheMisses.length} codes:`, cacheMisses);
    
    // スクレイピングで一括取得（CSVダウンロード方式を使用）
    try {
      const batchData = await scrapingService.scrapeMutualFundsParallel(cacheMisses);
      
      // 結果をそのまま追加（キャッシュはscrapeMutualFundsParallel内部で行われる）
      for (const code in batchData) {
        const fundData = batchData[code];
        
        if (fundData) {
          result[code] = fundData;
        }
      }
    } catch (error) {
      console.error('Error fetching batch mutual fund data:', error);
      
      // バッチ取得に失敗した場合は個別に取得を試みる
      for (const code of cacheMisses) {
        try {
          const fundData = await scrapingService.scrapeMutualFund(code);
          
          if (fundData) {
            result[code] = fundData;
          }
        } catch (codeError) {
          console.error(`Error fetching mutual fund data for ${code}:`, codeError);
          
          // エラーでも何か返せるようにフォールバック値を設定
          result[code] = {
            ticker: `${code}C`,
            price: null,
            change: null,
            changePercent: null,
            name: `投資信託 ${code}C`,
            currency: 'JPY',
            lastUpdated: new Date().toISOString(),
            source: 'API Error',
            isStock: false,
            isMutualFund: true,
            priceLabel: '基準価額',
            error: codeError.message
          };
        }
      }
    }
  }
  
  return result;
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
