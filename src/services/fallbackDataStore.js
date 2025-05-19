/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/services/fallbackDataStore.js
 * 
 * 説明: 
 * データ取得失敗時のフォールバックデータを管理するサービス。
 * 1. GitHubからフォールバックデータを取得・更新
 * 2. 取得失敗したデータの記録と統計
 * 3. 管理者向けAPIのサポート
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-20
 */
'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getDynamoDb } = require('../utils/awsConfig');
const cacheService = require('./cache');
const alertService = require('./alerts');
const { withRetry, isRetryableApiError } = require('../utils/retry');
const { ENV } = require('../config/envConfig');
const logger = require('../utils/logger');

// 設定値
const FALLBACK_TABLE = process.env.FALLBACK_DATA_TABLE || `${process.env.DYNAMODB_TABLE_PREFIX || 'portfolio-market-data-'}-fallback-data`;
const FALLBACK_DATA_REFRESH_INTERVAL = parseInt(process.env.FALLBACK_DATA_REFRESH_INTERVAL || '3600000', 10); // 1時間
const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'portfolio-manager-team';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'market-data-fallbacks';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// キャッシュ
let fallbackDataCache = {
  lastFetched: 0,
  data: {
    stocks: {},
    etfs: {},
    mutualFunds: {},
    exchangeRates: {}
  }
};

/**
 * GitHubからフォールバックデータを取得する
 * @param {boolean} forceRefresh - キャッシュを無視して強制的に更新するかどうか
 * @returns {Promise<Object>} フォールバックデータ
 */
const getFallbackData = async (forceRefresh = false) => {
  const now = Date.now();
  
  // キャッシュが有効かつ強制更新でない場合はキャッシュから取得
  if (!forceRefresh && 
      fallbackDataCache.lastFetched > 0 && 
      (now - fallbackDataCache.lastFetched < FALLBACK_DATA_REFRESH_INTERVAL)) {
    logger.debug('Using cached fallback data');
    return fallbackDataCache.data;
  }
  
  try {
    logger.info('Fetching fallback data from GitHub');
    
    // GitHub APIを使用してJSONファイルを取得
    const stocksUrl = `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/main/fallback-stocks.json`;
    const etfsUrl = `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/main/fallback-etfs.json`;
    const fundsUrl = `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/main/fallback-funds.json`;
    const ratesUrl = `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/main/fallback-rates.json`;
    
    // 並列でデータを取得
    const [stocksResponse, etfsResponse, fundsResponse, ratesResponse] = await Promise.allSettled([
      axios.get(stocksUrl),
      axios.get(etfsUrl),
      axios.get(fundsUrl),
      axios.get(ratesUrl)
    ]);
    
    // 結果の処理
    const data = {
      stocks: stocksResponse.status === 'fulfilled' ? stocksResponse.value.data : {},
      etfs: etfsResponse.status === 'fulfilled' ? etfsResponse.value.data : {},
      mutualFunds: fundsResponse.status === 'fulfilled' ? fundsResponse.value.data : {},
      exchangeRates: ratesResponse.status === 'fulfilled' ? ratesResponse.value.data : {}
    };
    
    // キャッシュを更新
    fallbackDataCache = {
      lastFetched: now,
      data
    };
    
    logger.info('Fallback data updated from GitHub');
    return data;
  } catch (error) {
    logger.error('Error fetching fallback data from GitHub:', error);
    
    // エラー時はキャッシュが有効なら使用、なければローカルから読み込み
    if (fallbackDataCache.lastFetched > 0) {
      logger.warn('Using stale fallback data from cache');
      return fallbackDataCache.data;
    }
    
    // ローカルファイルから読み込み（開発環境用）
    if (ENV.NODE_ENV === 'development') {
      try {
        const stocksData = require('../../data/fallback-stocks.json');
        const etfsData = require('../../data/fallback-etfs.json');
        const fundsData = require('../../data/fallback-funds.json');
        const ratesData = require('../../data/fallback-rates.json');
        
        const localData = {
          stocks: stocksData,
          etfs: etfsData,
          mutualFunds: fundsData,
          exchangeRates: ratesData
        };
        
        fallbackDataCache = {
          lastFetched: now,
          data: localData
        };
        
        logger.info('Using local fallback data files');
        return localData;
      } catch (localError) {
        logger.error('Error loading local fallback data:', localError);
      }
    }
    
    // すべての取得方法が失敗した場合は空のデータを返す
    return {
      stocks: {},
      etfs: {},
      mutualFunds: {},
      exchangeRates: {}
    };
  }
};

/**
 * 特定の銘柄のフォールバックデータを取得する
 * @param {string} symbol - 銘柄コード
 * @param {string} type - データタイプ（stock, etf, mutualFund, exchangeRate）
 * @returns {Promise<Object|null>} フォールバックデータ
 */
const getFallbackForSymbol = async (symbol, type) => {
  const fallbackData = await getFallbackData();
  
  let dataCategory;
  switch (type) {
    case 'jp-stock':
    case 'us-stock':
      dataCategory = 'stocks';
      break;
    case 'etf':
      dataCategory = 'etfs';
      break;
    case 'mutual-fund':
      dataCategory = 'mutualFunds';
      break;
    case 'exchange-rate':
      dataCategory = 'exchangeRates';
      break;
    default:
      dataCategory = 'stocks';
  }
  
  // シンボルのデータを取得
  const symbolData = fallbackData[dataCategory][symbol];
  
  if (!symbolData) {
    return null;
  }
  
  // 必要な場合はtickerプロパティを追加
  if (!symbolData.ticker) {
    symbolData.ticker = symbol;
  }
  
  // 最終更新日時を設定
  if (!symbolData.lastUpdated) {
    symbolData.lastUpdated = new Date().toISOString();
  }
  
  // ソースを設定
  if (!symbolData.source) {
    symbolData.source = 'GitHub Fallback';
  }
  
  return symbolData;
};

/**
 * データ取得失敗を記録する
 * @param {string} symbol - 銘柄コード
 * @param {string} type - データタイプ
 * @param {Error|string} errorInfo - 失敗理由
 * @returns {Promise<boolean>} 成功したかどうか
 */
const recordFailedFetch = async (symbol, type, errorInfo) => {
  try {
    const dynamoDb = getDynamoDb();
    
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // エラー情報の処理
    let reason = errorInfo;
    if (errorInfo instanceof Error) {
      reason = errorInfo.message;
    }
    
    // データ取得失敗の記録
    const params = {
      TableName: FALLBACK_TABLE,
      Item: {
        id: `failure:${symbol}:${type}`,
        symbol,
        type,
        reason,
        timestamp: now.toISOString(),
        dateKey
      }
    };
    
    await dynamoDb.put(params).promise();
    
    // 集計カウンターの更新
    const countKey = `count:${dateKey}:${type}`;
    const countParams = {
      TableName: FALLBACK_TABLE,
      Key: { id: countKey },
      UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :one, #symbols = list_append(if_not_exists(#symbols, :empty_list), :new_symbol)',
      ExpressionAttributeNames: {
        '#count': 'count',
        '#symbols': 'symbols'
      },
      ExpressionAttributeValues: {
        ':zero': 0,
        ':one': 1,
        ':empty_list': [],
        ':new_symbol': [symbol]
      }
    };
    
    await dynamoDb.update(countParams).promise();
    
    return true;
  } catch (error) {
    logger.error(`Error recording failed fetch for ${symbol}:`, error);
    return false;
  }
};

/**
 * 失敗した銘柄の一覧を取得する
 * @param {string} [dateKey] - 日付キー（YYYY-MM-DD、指定なしは当日）
 * @param {string} [type] - データタイプ（指定なしは全て）
 * @returns {Promise<Array>} 失敗した銘柄の一覧
 */
const getFailedSymbols = async (dateKey, type) => {
  try {
    const dynamoDb = getDynamoDb();
    
    // 日付キーのデフォルト値は当日
    if (!dateKey) {
      dateKey = new Date().toISOString().split('T')[0];
    }
    
    // タイプが指定されている場合
    if (type) {
      const countKey = `count:${dateKey}:${type}`;
      const params = {
        TableName: FALLBACK_TABLE,
        Key: { id: countKey }
      };
      
      const result = await dynamoDb.get(params).promise();
      return result.Item?.symbols || [];
    }
    
    // タイプが指定されていない場合は全てのタイプを検索
    const queryParams = {
      TableName: FALLBACK_TABLE,
      KeyConditionExpression: 'begins_with(id, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': `count:${dateKey}`
      }
    };
    
    const result = await dynamoDb.query(queryParams).promise();
    
    // 結果を集約
    const symbols = [];
    result.Items.forEach(item => {
      if (item.symbols && Array.isArray(item.symbols)) {
        symbols.push(...item.symbols);
      }
    });
    
    // 重複を削除
    return [...new Set(symbols)];
  } catch (error) {
    logger.error(`Error getting failed symbols for ${dateKey}:`, error);
    return [];
  }
};

/**
 * 管理者用：現在のフォールバックデータをGitHubに書き出す
 * @returns {Promise<boolean>} 成功したかどうか
 */
const exportCurrentFallbacksToGitHub = async () => {
  if (!GITHUB_TOKEN) {
    logger.error('GitHub token not provided');
    return false;
  }
  
  try {
    // DynamoDBからフォールバックデータを取得
    const dynamoDb = getDynamoDb();
    
    // 最近失敗した銘柄を取得（過去7日間）
    const failedSymbols = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      
      const symbols = await getFailedSymbols(dateKey);
      failedSymbols.push(...symbols);
    }
    
    // 重複を削除
    const uniqueSymbols = [...new Set(failedSymbols)];
    
    // 各シンボルのデータを分類
    const stocks = {};
    const etfs = {};
    const mutualFunds = {};
    const exchangeRates = {};
    
    for (const symbol of uniqueSymbols) {
      // DynamoDBから最新の失敗記録を取得
      const queryParams = {
        TableName: FALLBACK_TABLE,
        KeyConditionExpression: 'begins_with(id, :id)',
        ExpressionAttributeValues: {
          ':id': `failure:${symbol}:`
        },
        ScanIndexForward: false, // 降順（最新のものから）
        Limit: 1
      };
      
      const result = await dynamoDb.query(queryParams).promise();
      
      if (result.Items.length === 0) continue;
      
      const item = result.Items[0];
      const type = item.type;
      
      // キャッシュから現在の値を取得（フォールバック値も含む）
      const cachedData = await cacheService.get(`${type}:${symbol}`);
      
      if (!cachedData) continue;
      
      // データを分類
      switch (type) {
        case 'jp-stock':
        case 'us-stock':
          stocks[symbol] = {
            ticker: symbol,
            price: cachedData.price,
            change: cachedData.change,
            changePercent: cachedData.changePercent,
            name: cachedData.name,
            currency: cachedData.currency,
            lastUpdated: cachedData.lastUpdated
          };
          break;
        case 'etf':
          etfs[symbol] = {
            ticker: symbol,
            price: cachedData.price,
            change: cachedData.change,
            changePercent: cachedData.changePercent,
            name: cachedData.name,
            currency: cachedData.currency,
            lastUpdated: cachedData.lastUpdated
          };
          break;
        case 'mutual-fund':
          mutualFunds[symbol] = {
            ticker: symbol,
            price: cachedData.price,
            change: cachedData.change,
            changePercent: cachedData.changePercent,
            name: cachedData.name,
            currency: cachedData.currency,
            lastUpdated: cachedData.lastUpdated
          };
          break;
        case 'exchange-rate':
          exchangeRates[symbol] = {
            ticker: symbol,
            base: cachedData.base,
            target: cachedData.target,
            rate: cachedData.rate,
            change: cachedData.change,
            changePercent: cachedData.changePercent,
            lastUpdated: cachedData.lastUpdated
          };
          break;
      }
    }
    
    // 現在のGitHubのデータと統合
    const currentFallbacks = await getFallbackData(true);
    
    const updatedStocks = { ...currentFallbacks.stocks, ...stocks };
    const updatedEtfs = { ...currentFallbacks.etfs, ...etfs };
    const updatedFunds = { ...currentFallbacks.mutualFunds, ...mutualFunds };
    const updatedRates = { ...currentFallbacks.exchangeRates, ...exchangeRates };
    
    // GitHub APIを使用してファイルを更新
    const updateFile = async (fileName, content) => {
      // 現在のファイルの情報を取得
      const fileInfoUrl = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${fileName}`;
      
      try {
        const fileInfoResponse = await axios.get(fileInfoUrl, {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        const sha = fileInfoResponse.data.sha;
        
        // ファイルを更新
        await axios.put(fileInfoUrl, {
          message: `Update ${fileName} - ${new Date().toISOString()}`,
          content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
          sha
        }, {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        return true;
      } catch (error) {
        logger.error(`Error updating ${fileName}:`, error);
        return false;
      }
    };
    
    // 並列でファイルを更新
    const [stocksResult, etfsResult, fundsResult, ratesResult] = await Promise.allSettled([
      updateFile('fallback-stocks.json', updatedStocks),
      updateFile('fallback-etfs.json', updatedEtfs),
      updateFile('fallback-funds.json', updatedFunds),
      updateFile('fallback-rates.json', updatedRates)
    ]);
    
    // 結果を集計
    const results = {
      stocks: stocksResult.status === 'fulfilled' && stocksResult.value,
      etfs: etfsResult.status === 'fulfilled' && etfsResult.value,
      mutualFunds: fundsResult.status === 'fulfilled' && fundsResult.value,
      exchangeRates: ratesResult.status === 'fulfilled' && ratesResult.value
    };
    
    // 少なくとも一つのファイルが更新されていれば成功
    const success = Object.values(results).some(result => result === true);
    
    if (success) {
      logger.info('Successfully updated fallback data on GitHub');
    } else {
      logger.error('Failed to update any fallback data files on GitHub');
    }
    
    return success;
  } catch (error) {
    logger.error('Error exporting fallbacks to GitHub:', error);
    return false;
  }
};

/**
 * 管理者用：失敗記録の統計を取得する
 * @param {number} [days=7] - 取得する日数
 * @returns {Promise<Object>} 統計情報
 */
const getFailureStatistics = async (days = 7) => {
  try {
    const dynamoDb = getDynamoDb();
    const statistics = {
      totalFailures: 0,
      byDate: {},
      byType: {},
      bySymbol: {},
      mostFailedSymbols: []
    };
    
    // 指定日数分の日付を生成
    const dateKeys = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      dateKeys.push(date.toISOString().split('T')[0]);
    }
    
    // 各日付ごとの集計データを取得
    for (const dateKey of dateKeys) {
      statistics.byDate[dateKey] = {
        total: 0,
        byType: {}
      };
      
      // 各タイプの集計を取得
      const queryParams = {
        TableName: FALLBACK_TABLE,
        KeyConditionExpression: 'begins_with(id, :prefix)',
        ExpressionAttributeValues: {
          ':prefix': `count:${dateKey}`
        }
      };
      
      const result = await dynamoDb.query(queryParams).promise();
      
      for (const item of result.Items) {
        const typePart = item.id.split(':')[2];
        const count = item.count || 0;
        
        statistics.byDate[dateKey].total += count;
        statistics.byDate[dateKey].byType[typePart] = count;
        
        // 全体集計も更新
        statistics.totalFailures += count;
        statistics.byType[typePart] = (statistics.byType[typePart] || 0) + count;
        
        // シンボル別の集計
        if (item.symbols && Array.isArray(item.symbols)) {
          for (const symbol of item.symbols) {
            statistics.bySymbol[symbol] = (statistics.bySymbol[symbol] || 0) + 1;
          }
        }
      }
    }
    
    // 最も失敗の多いシンボルを抽出
    statistics.mostFailedSymbols = Object.entries(statistics.bySymbol)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([symbol, count]) => ({ symbol, count }));
    
    return statistics;
  } catch (error) {
    logger.error('Error getting failure statistics:', error);
    return {
      error: error.message,
      totalFailures: 0
    };
  }
};

// テスト用にキャッシュをエクスポート
module.exports = {
  getFallbackData,
  getFallbackForSymbol,
  recordFailedFetch,
  getFailedSymbols,
  exportCurrentFallbacksToGitHub,
  getFailureStatistics,
  fallbackDataCache
};
