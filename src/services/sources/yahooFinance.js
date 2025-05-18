/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/services/sources/yahooFinance.js
 * 
 * 説明: 
 * Yahoo Finance APIを使用して米国株式のデータを取得するサービス。
 * 単一銘柄および複数銘柄の一括取得に対応しています。
 * Rapid APIのYahoo Finance APIを使用しています。
 * 
 * @author Portfolio Manager Team
 * @updated 2025-05-14
 */
'use strict';

const axios = require('axios');
const { withRetry, isRetryableApiError } = require('../../utils/retry');
const alertService = require('../alerts');

// API_TIMEOUTはテスト環境による更新が少ないので定数定義のままにする
const API_TIMEOUT = parseInt(process.env.YAHOO_FINANCE_API_TIMEOUT || '5000', 10);

/**
 * Yahoo Finance APIのエンドポイントを構築
 * @param {string} path - APIパス
 * @returns {string} 完全なAPIエンドポイントURL
 */
const buildApiUrl = (path) => {
  // 関数呼び出し時に毎回環境変数を読み込む
  const API_HOST = process.env.YAHOO_FINANCE_API_HOST || 'yh-finance.p.rapidapi.com';
  return `https://${API_HOST}${path}`;
};

/**
 * 単一銘柄の株価データを取得する
 * @param {string} symbol - ティッカーシンボル
 * @returns {Promise<Object>} 株価データ
 */
const getStockData = async (symbol) => {
  try {
    if (!symbol) {
      throw new Error('Symbol is required');
    }

    // 関数呼び出し時に毎回環境変数を読み込む
    const API_HOST = process.env.YAHOO_FINANCE_API_HOST || 'yh-finance.p.rapidapi.com';
    const API_KEY = process.env.YAHOO_FINANCE_API_KEY;

    // APIからデータを取得
    const response = await withRetry(
      () => axios.get(buildApiUrl(`/market/v2/get-quotes`), {
        params: {
          region: 'US',
          symbols: symbol
        },
        headers: {
          'X-RapidAPI-Key': API_KEY,
          'X-RapidAPI-Host': API_HOST
        },
        timeout: API_TIMEOUT
      }),
      {
        maxRetries: 3,
        baseDelay: 500,
        shouldRetry: isRetryableApiError
      }
    );

    // レスポンスを検証
    if (!response.data || !response.data.quoteResponse) {
      throw new Error('Invalid API response format');
    }

    // エラーチェック（APIレスポンスにエラーが含まれる場合は例外をスロー）
    if (response.data.quoteResponse.error) {
      throw new Error('Invalid API response format');
    }

    // 結果配列の検証
    if (!response.data.quoteResponse.result) {
      throw new Error('Invalid API response format');
    }

    const quotes = response.data.quoteResponse.result;
    if (quotes.length === 0) {
      // 空のデータセットを返す（エラーにしない）
      return {};
    }

    const stockData = quotes[0];

    // レスポンスデータを整形
    return {
      ticker: stockData.symbol,
      price: stockData.regularMarketPrice,
      change: stockData.regularMarketChange,
      changePercent: stockData.regularMarketChangePercent,
      name: stockData.shortName || stockData.longName || stockData.symbol,
      currency: stockData.currency || 'USD',
      lastUpdated: new Date(stockData.regularMarketTime * 1000).toISOString(),
      source: 'Yahoo Finance API',
      isStock: true,
      isMutualFund: false,
      volume: stockData.regularMarketVolume,
      marketCap: stockData.marketCap
    };
  } catch (error) {
    console.error(`Error fetching stock data for ${symbol}:`, error);

    // APIキーエラーの場合はアラート通知
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      await alertService.notifyError(
        'Yahoo Finance API Key Error',
        new Error(`API key validation failed: ${error.response.status}`),
        { symbol }
      );
    }

    throw new Error(`Failed to retrieve stock data for ${symbol}: ${error.message}`);
  }
};

/**
 * 複数銘柄の株価データを一括取得する
 * @param {Array<string>|string} symbols - ティッカーシンボルの配列またはカンマ区切りの文字列
 * @returns {Promise<Object>} シンボルをキーとする株価データのオブジェクト
 */
const getStocksData = async (symbols) => {
  try {
    // symbolsが文字列の場合は配列に変換
    const symbolsArray = Array.isArray(symbols) ? symbols : [symbols];
    
    if (!symbolsArray || symbolsArray.length === 0) {
      throw new Error('Symbols array is required');
    }

    // 関数呼び出し時に毎回環境変数を読み込む
    const API_HOST = process.env.YAHOO_FINANCE_API_HOST || 'yh-finance.p.rapidapi.com';
    const API_KEY = process.env.YAHOO_FINANCE_API_KEY;

    // 一度に処理する銘柄数の上限（APIの制限に合わせる）
    const BATCH_SIZE = 20;
    let results = {};

    // 複数の銘柄をバッチ処理
    for (let i = 0; i < symbolsArray.length; i += BATCH_SIZE) {
      const batchSymbols = symbolsArray.slice(i, i + BATCH_SIZE);
      const symbolsString = batchSymbols.join(',');

      // APIからデータを取得
      const response = await withRetry(
        () => axios.get(buildApiUrl(`/market/v2/get-quotes`), {
          params: {
            region: 'US',
            symbols: symbolsString
          },
          headers: {
            'X-RapidAPI-Key': API_KEY,
            'X-RapidAPI-Host': API_HOST
          },
          timeout: API_TIMEOUT
        }),
        {
          maxRetries: 3,
          baseDelay: 500,
          shouldRetry: isRetryableApiError
        }
      );

      // レスポンスを検証
      if (!response.data || !response.data.quoteResponse) {
        throw new Error('Invalid API response format');
      }

      // エラーチェック（APIレスポンスにエラーが含まれる場合は例外をスロー）
      if (response.data.quoteResponse.error) {
        throw new Error('Invalid API response format');
      }

      // 結果配列の検証
      if (!response.data.quoteResponse.result) {
        throw new Error('Invalid API response format');
      }

      const quotes = response.data.quoteResponse.result;

      // 各銘柄のデータを整形して結果に追加
      quotes.forEach(stockData => {
        results[stockData.symbol] = {
          ticker: stockData.symbol,
          price: stockData.regularMarketPrice,
          change: stockData.regularMarketChange,
          changePercent: stockData.regularMarketChangePercent,
          name: stockData.shortName || stockData.longName || stockData.symbol,
          currency: stockData.currency || 'USD',
          lastUpdated: new Date(stockData.regularMarketTime * 1000).toISOString(),
          source: 'Yahoo Finance API',
          isStock: true,
          isMutualFund: false,
          volume: stockData.regularMarketVolume,
          marketCap: stockData.marketCap
        };
      });

      // バッチ間の遅延を入れてAPI制限を回避
      if (i + BATCH_SIZE < symbolsArray.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // 取得できなかった銘柄を確認
    const missingSymbols = symbolsArray.filter(symbol => !results[symbol]);
    if (missingSymbols.length > 0) {
      console.warn(`No data found for symbols: ${missingSymbols.join(', ')}`);
    }

    return results;
  } catch (error) {
    console.error(`Error fetching stocks data:`, error);

    // APIキーエラーの場合はアラート通知
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      await alertService.notifyError(
        'Yahoo Finance API Key Error',
        new Error(`API key validation failed: ${error.response.status}`),
        { symbols: Array.isArray(symbols) ? symbols.join(',') : symbols }
      );
    }

    throw new Error(`Failed to retrieve stocks data: ${error.message}`);
  }
};

module.exports = {
  getStockData,
  getStocksData
};
