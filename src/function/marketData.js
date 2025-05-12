/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/function/marketData.js
 * 
 * 説明: 
 * マーケットデータAPIのLambdaハンドラー関数。
 * API Gatewayからのリクエストを受け取り、様々なデータソースから
 * 株式・投資信託・為替レートのデータを取得して返却します。
 * フォールバックデータとギットハブからの情報を統合しています。
 * 
 * @author Portfolio Manager Team
 * @updated 2025-05-20
 */
'use strict';

const enhancedMarketDataService = require('../services/sources/enhancedMarketDataService');
const fallbackDataStore = require('../services/fallbackDataStore');
const cacheService = require('../services/cache');
const usageService = require('../services/usage');
const alertService = require('../services/alerts');
const { DATA_TYPES, CACHE_TIMES, ERROR_CODES, RESPONSE_FORMATS } = require('../config/constants');
const { isBudgetCritical, getBudgetWarningMessage } = require('../utils/budgetCheck');
const { formatResponse, formatErrorResponse } = require('../utils/responseUtils');
const logger = require('../utils/logger');

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
    logger.info('Received market data request:', JSON.stringify({ 
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
    logger.error('Error processing market data request:', error);

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
 * 複数銘柄の米国株データを取得する
 * @param {Array<string>} symbols - ティッカーシンボルの配列
 * @param {boolean} refresh - キャッシュを無視するかどうか
 * @returns {Promise<Object>} データオブジェクト
 */
const getUsStockData = async (symbols, refresh = false) => {
  logger.info(`Getting US stock data for ${symbols.length} symbols. Refresh: ${refresh}`);
  
  try {
    // 強化版サービスで取得
    const result = await enhancedMarketDataService.getUsStocksData(symbols, refresh);
    
    // フォールバックデータの記録と検証
    for (const symbol of symbols) {
      if (!result[symbol] || result[symbol].error) {
        // データが取得できなかった銘柄を記録
        await fallbackDataStore.recordFailedFetch(
          symbol,
          DATA_TYPES.US_STOCK,
          result[symbol]?.error || 'No data returned'
        );
      }
    }
    
    return result;
  } catch (error) {
    logger.error(`Error getting US stock data: ${error.message}`);
    
    // エラー時はフォールバックデータを試みる
    const fallbackResults = {};
    
    for (const symbol of symbols) {
      try {
        const fallbackData = await fallbackDataStore.getFallbackForSymbol(symbol, DATA_TYPES.US_STOCK);
        
        if (fallbackData) {
          fallbackResults[symbol] = {
            ...fallbackData,
            source: 'Fallback Data',
            timestamp: new Date().toISOString()
          };
        } else {
          fallbackResults[symbol] = {
            ticker: symbol,
            price: null,
            change: null,
            changePercent: null,
            name: symbol,
            currency: 'USD',
            isStock: true,
            isMutualFund: false,
            error: 'Data retrieval failed',
            source: 'Error',
            lastUpdated: new Date().toISOString()
          };
        }
      } catch (fallbackError) {
        logger.error(`Error getting fallback data for ${symbol}: ${fallbackError.message}`);
        
        fallbackResults[symbol] = {
          ticker: symbol,
          price: null,
          change: null,
          changePercent: null,
          name: symbol,
          currency: 'USD',
          isStock: true,
          isMutualFund: false,
          error: 'Data retrieval failed',
          source: 'Error',
          lastUpdated: new Date().toISOString()
        };
      }
    }
    
    return fallbackResults;
  }
};

/**
 * 複数銘柄の日本株データを取得する
 * @param {Array<string>} codes - 証券コードの配列
 * @param {boolean} refresh - キャッシュを無視するかどうか
 * @returns {Promise<Object>} データオブジェクト
 */
const getJpStockData = async (codes, refresh = false) => {
  logger.info(`Getting JP stock data for ${codes.length} codes. Refresh: ${refresh}`);
  
  try {
    // 強化版サービスで取得
    const result = await enhancedMarketDataService.getJpStocksData(codes, refresh);
    
    // フォールバックデータの記録と検証
    for (const code of codes) {
      if (!result[code] || result[code].error) {
        // データが取得できなかった銘柄を記録
        await fallbackDataStore.recordFailedFetch(
          code,
          DATA_TYPES.JP_STOCK,
          result[code]?.error || 'No data returned'
        );
      }
    }
    
    return result;
  } catch (error) {
    logger.error(`Error getting JP stock data: ${error.message}`);
    
    // エラー時はフォールバックデータを試みる
    const fallbackResults = {};
    
    for (const code of codes) {
      try {
        const fallbackData = await fallbackDataStore.getFallbackForSymbol(code, DATA_TYPES.JP_STOCK);
        
        if (fallbackData) {
          fallbackResults[code] = {
            ...fallbackData,
            source: 'Fallback Data',
            timestamp: new Date().toISOString()
          };
        } else {
          fallbackResults[code] = {
            ticker: code,
            price: null,
            change: null,
            changePercent: null,
            name: `日本株 ${code}`,
            currency: 'JPY',
            isStock: true,
            isMutualFund: false,
            error: 'Data retrieval failed',
            source: 'Error',
            lastUpdated: new Date().toISOString()
          };
        }
      } catch (fallbackError) {
        logger.error(`Error getting fallback data for ${code}: ${fallbackError.message}`);
        
        fallbackResults[code] = {
          ticker: code,
          price: null,
          change: null,
          changePercent: null,
          name: `日本株 ${code}`,
          currency: 'JPY',
          isStock: true,
          isMutualFund: false,
          error: 'Data retrieval failed',
          source: 'Error',
          lastUpdated: new Date().toISOString()
        };
      }
    }
    
    return fallbackResults;
  }
};

/**
 * 複数銘柄の投資信託データを取得する
 * @param {Array<string>} codes - ファンドコードの配列
 * @param {boolean} refresh - キャッシュを無視するかどうか
 * @returns {Promise<Object>} データオブジェクト
 */
const getMutualFundData = async (codes, refresh = false) => {
  logger.info(`Getting mutual fund data for ${codes.length} codes. Refresh: ${refresh}`);
  
  try {
    // 強化版サービスで取得
    const result = await enhancedMarketDataService.getMutualFundsData(codes, refresh);
    
    // フォールバックデータの記録と検証
    for (const code of codes) {
      if (!result[code] || result[code].error) {
        // データが取得できなかった銘柄を記録
        await fallbackDataStore.recordFailedFetch(
          code,
          DATA_TYPES.MUTUAL_FUND,
          result[code]?.error || 'No data returned'
        );
      }
    }
    
    return result;
  } catch (error) {
    logger.error(`Error getting mutual fund data: ${error.message}`);
    
    // エラー時はフォールバックデータを試みる
    const fallbackResults = {};
    
    for (const code of codes) {
      try {
        const fallbackData = await fallbackDataStore.getFallbackForSymbol(code, DATA_TYPES.MUTUAL_FUND);
        
        if (fallbackData) {
          fallbackResults[code] = {
            ...fallbackData,
            source: 'Fallback Data',
            timestamp: new Date().toISOString()
          };
        } else {
          fallbackResults[code] = {
            ticker: code,
            price: null,
            change: null,
            changePercent: null,
            name: `投資信託 ${code}`,
            currency: 'JPY',
            isStock: false,
            isMutualFund: true,
            priceLabel: '基準価額',
            error: 'Data retrieval failed',
            source: 'Error',
            lastUpdated: new Date().toISOString()
          };
        }
      } catch (fallbackError) {
        logger.error(`Error getting fallback data for ${code}: ${fallbackError.message}`);
        
        fallbackResults[code] = {
          ticker: code,
          price: null,
          change: null,
          changePercent: null,
          name: `投資信託 ${code}`,
          currency: 'JPY',
          isStock: false,
          isMutualFund: true,
          priceLabel: '基準価額',
          error: 'Data retrieval failed',
          source: 'Error',
          lastUpdated: new Date().toISOString()
        };
      }
    }
    
    return fallbackResults;
  }
};

/**
 * 為替レートデータを取得する
 * @param {string} base - ベース通貨
 * @param {string} target - 対象通貨
 * @param {boolean} refresh - キャッシュを無視するかどうか
 * @returns {Promise<Object>} 為替レートデータ
 */
const getExchangeRateData = async (base, target, refresh = false) => {
  logger.info(`Getting exchange rate data for ${base}/${target}. Refresh: ${refresh}`);
  
  const pair = `${base}-${target}`;
  
  try {
    // 強化版サービスで取得
    const result = await enhancedMarketDataService.getExchangeRateData(base, target, refresh);
    
    // データが取得できない場合はフォールバックデータを記録
    if (!result || result.error) {
      await fallbackDataStore.recordFailedFetch(
        pair,
        DATA_TYPES.EXCHANGE_RATE,
        result?.error || 'No data returned'
      );
    }
    
    return { [pair]: result };
  } catch (error) {
    logger.error(`Error getting exchange rate data: ${error.message}`);
    
    // エラー時はフォールバックデータを試みる
    try {
      const fallbackData = await fallbackDataStore.getFallbackForSymbol(pair, DATA_TYPES.EXCHANGE_RATE);
      
      if (fallbackData) {
        return {
          [pair]: {
            ...fallbackData,
            source: 'Fallback Data',
            timestamp: new Date().toISOString()
          }
        };
      } else {
        return {
          [pair]: {
            pair,
            base,
            target,
            rate: base === 'USD' && target === 'JPY' ? 148.5 : 1.0,
            change: 0,
            changePercent: 0,
            lastUpdated: new Date().toISOString(),
            source: 'Default Fallback',
            error: 'Data retrieval failed'
          }
        };
      }
    } catch (fallbackError) {
      logger.error(`Error getting fallback data for ${pair}: ${fallbackError.message}`);
      
      return {
        [pair]: {
          pair,
          base,
          target,
          rate: base === 'USD' && target === 'JPY' ? 148.5 : 1.0,
          change: 0,
          changePercent: 0,
          lastUpdated: new Date().toISOString(),
          source: 'Default Fallback',
          error: 'Data retrieval failed'
        }
      };
    }
  }
};
