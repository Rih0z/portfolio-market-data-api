/**
 * ファイルパス: __tests__/testUtils/failureSimulator.js
 * 
 * データソースの障害をシミュレートするユーティリティ関数を提供します。
 * 特定のデータソースの故障や遅延、不定期なエラーをシミュレートします。
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-15
 * @updated 2025-05-18
 */

'use strict';

const yahooFinanceService = require('../../src/services/sources/yahooFinance');
const marketDataProviders = require('../../src/services/sources/marketDataProviders');
const exchangeRateService = require('../../src/services/sources/exchangeRate');
const fundDataService = require('../../src/services/sources/fundDataService');

// 元のメソッドを保持するオブジェクト
const originalImplementations = {
  'yahoo-finance-api': {
    getStockData: null,
    getStocksData: null
  },
  'market-data-providers': {
    getUsStockData: null,
    getJpStockData: null,
    getUsStocksParallel: null,
    getJpStocksParallel: null
  },
  'exchange-rate-api': {
    getExchangeRate: null,
    getBatchExchangeRates: null
  },
  'fund-data-service': {
    getMutualFundData: null,
    getMutualFundsParallel: null
  }
};

/**
 * 特定のデータソースで障害をシミュレートする
 * @param {string} sourceType - ソースタイプ ('yahoo-finance-api', 'market-data-providers', 'exchange-rate-api', 'fund-data-service')
 * @param {Object} [options={}] - シミュレーションオプション
 * @param {string} [options.errorType='complete-failure'] - エラータイプ ('complete-failure', 'timeout', 'partial-failure')
 * @param {number} [options.errorRate=1.0] - エラー発生率 (0.0～1.0)
 * @param {string} [options.errorMessage='Simulated service failure'] - エラーメッセージ
 * @returns {Promise<void>}
 */
const simulateDataSourceFailure = async (sourceType, options = {}) => {
  const {
    errorType = 'complete-failure',
    errorRate = 1.0,
    errorMessage = 'Simulated service failure'
  } = options;
  
  console.log(`Simulating ${errorType} for ${sourceType} with ${errorRate * 100}% error rate`);
  
  // 元の実装をバックアップ
  backupOriginalImplementations(sourceType);
  
  // ソースタイプに応じたシミュレーション実施
  switch (sourceType) {
    case 'yahoo-finance-api':
      simulateYahooFinanceFailure(errorType, errorRate, errorMessage);
      break;
    case 'market-data-providers':
      simulateMarketDataProvidersFailure(errorType, errorRate, errorMessage);
      break;
    case 'exchange-rate-api':
      simulateExchangeRateFailure(errorType, errorRate, errorMessage);
      break;
    case 'fund-data-service':
      simulateFundDataServiceFailure(errorType, errorRate, errorMessage);
      break;
    default:
      throw new Error(`Unknown data source type: ${sourceType}`);
  }
  
  console.log(`Failure simulation for ${sourceType} activated`);
};

/**
 * すべてのデータソースを元の状態に戻す
 * @returns {Promise<void>}
 */
const resetDataSources = async () => {
  console.log('Resetting all data sources to original implementation');
  
  // 各ソースタイプを元に戻す
  restoreOriginalImplementations('yahoo-finance-api');
  restoreOriginalImplementations('market-data-providers');
  restoreOriginalImplementations('exchange-rate-api');
  restoreOriginalImplementations('fund-data-service');
  
  console.log('All data sources reset complete');
};

/**
 * 元の実装をバックアップする
 * @param {string} sourceType - ソースタイプ
 */
const backupOriginalImplementations = (sourceType) => {
  switch (sourceType) {
    case 'yahoo-finance-api':
      originalImplementations[sourceType].getStockData = yahooFinanceService.getStockData;
      originalImplementations[sourceType].getStocksData = yahooFinanceService.getStocksData;
      break;
    case 'market-data-providers':
      originalImplementations[sourceType].getUsStockData = marketDataProviders.getUsStockData;
      originalImplementations[sourceType].getJpStockData = marketDataProviders.getJpStockData;
      originalImplementations[sourceType].getUsStocksParallel = marketDataProviders.getUsStocksParallel;
      originalImplementations[sourceType].getJpStocksParallel = marketDataProviders.getJpStocksParallel;
      break;
    case 'exchange-rate-api':
      originalImplementations[sourceType].getExchangeRate = exchangeRateService.getExchangeRate;
      originalImplementations[sourceType].getBatchExchangeRates = exchangeRateService.getBatchExchangeRates;
      break;
    case 'fund-data-service':
      originalImplementations[sourceType].getMutualFundData = fundDataService.getMutualFundData;
      originalImplementations[sourceType].getMutualFundsParallel = fundDataService.getMutualFundsParallel;
      break;
  }
};

/**
 * 元の実装を復元する
 * @param {string} sourceType - ソースタイプ
 */
const restoreOriginalImplementations = (sourceType) => {
  switch (sourceType) {
    case 'yahoo-finance-api':
      if (originalImplementations[sourceType].getStockData) {
        yahooFinanceService.getStockData = originalImplementations[sourceType].getStockData;
      }
      if (originalImplementations[sourceType].getStocksData) {
        yahooFinanceService.getStocksData = originalImplementations[sourceType].getStocksData;
      }
      break;
    case 'market-data-providers':
      if (originalImplementations[sourceType].getUsStockData) {
        marketDataProviders.getUsStockData = originalImplementations[sourceType].getUsStockData;
      }
      if (originalImplementations[sourceType].getJpStockData) {
        marketDataProviders.getJpStockData = originalImplementations[sourceType].getJpStockData;
      }
      if (originalImplementations[sourceType].getUsStocksParallel) {
        marketDataProviders.getUsStocksParallel = originalImplementations[sourceType].getUsStocksParallel;
      }
      if (originalImplementations[sourceType].getJpStocksParallel) {
        marketDataProviders.getJpStocksParallel = originalImplementations[sourceType].getJpStocksParallel;
      }
      break;
    case 'exchange-rate-api':
      if (originalImplementations[sourceType].getExchangeRate) {
        exchangeRateService.getExchangeRate = originalImplementations[sourceType].getExchangeRate;
      }
      if (originalImplementations[sourceType].getBatchExchangeRates) {
        exchangeRateService.getBatchExchangeRates = originalImplementations[sourceType].getBatchExchangeRates;
      }
      break;
    case 'fund-data-service':
      if (originalImplementations[sourceType].getMutualFundData) {
        fundDataService.getMutualFundData = originalImplementations[sourceType].getMutualFundData;
      }
      if (originalImplementations[sourceType].getMutualFundsParallel) {
        fundDataService.getMutualFundsParallel = originalImplementations[sourceType].getMutualFundsParallel;
      }
      break;
  }
};

/**
 * エラーがランダムに発生すべきかを決定する
 * @param {number} errorRate - エラー発生率 (0.0～1.0)
 * @returns {boolean} - エラーを発生させるかどうか
 */
const shouldFail = (errorRate) => {
  return Math.random() < errorRate;
};

/**
 * Yahoo Finance APIの障害をシミュレート
 * @param {string} errorType - エラータイプ
 * @param {number} errorRate - エラー発生率
 * @param {string} errorMessage - エラーメッセージ
 */
const simulateYahooFinanceFailure = (errorType, errorRate, errorMessage) => {
  // getStockData メソッドの障害シミュレーション
  yahooFinanceService.getStockData = jest.fn().mockImplementation(async (symbol) => {
    console.log(`Simulated Yahoo Finance API getStockData called for ${symbol}`);
    
    if (shouldFail(errorRate)) {
      console.log(`Simulating failure for ${symbol}`);
      
      if (errorType === 'timeout') {
        // タイムアウトをシミュレート
        await new Promise(resolve => setTimeout(resolve, 5000));
        throw new Error(`Timeout: ${errorMessage}`);
      } else {
        throw new Error(errorMessage);
      }
    }
    
    // 元の実装を呼び出す
    return originalImplementations['yahoo-finance-api'].getStockData(symbol);
  });
  
  // getStocksData メソッドの障害シミュレーション
  yahooFinanceService.getStocksData = jest.fn().mockImplementation(async (symbols) => {
    console.log(`Simulated Yahoo Finance API getStocksData called for ${symbols}`);
    
    if (shouldFail(errorRate)) {
      console.log(`Simulating failure for batch request`);
      
      if (errorType === 'timeout') {
        // タイムアウトをシミュレート
        await new Promise(resolve => setTimeout(resolve, 5000));
        throw new Error(`Timeout: ${errorMessage}`);
      } else if (errorType === 'partial-failure' && Array.isArray(symbols)) {
        // 部分的な失敗をシミュレート - 一部のシンボルだけを返す
        const result = {};
        const halfLength = Math.floor(symbols.length / 2);
        
        for (let i = 0; i < halfLength; i++) {
          const symbol = symbols[i];
          const data = await originalImplementations['yahoo-finance-api'].getStockData(symbol);
          result[symbol] = data;
        }
        
        return result;
      } else {
        throw new Error(errorMessage);
      }
    }
    
    // 元の実装を呼び出す
    return originalImplementations['yahoo-finance-api'].getStocksData(symbols);
  });
};

/**
 * MarketDataProvidersの障害をシミュレート
 * @param {string} errorType - エラータイプ
 * @param {number} errorRate - エラー発生率
 * @param {string} errorMessage - エラーメッセージ
 */
const simulateMarketDataProvidersFailure = (errorType, errorRate, errorMessage) => {
  // getUsStockData メソッドの障害シミュレーション
  marketDataProviders.getUsStockData = jest.fn().mockImplementation(async (symbol) => {
    console.log(`Simulated Market Data Providers getUsStockData called for ${symbol}`);
    
    if (shouldFail(errorRate)) {
      console.log(`Simulating failure for ${symbol}`);
      
      if (errorType === 'timeout') {
        // タイムアウトをシミュレート
        await new Promise(resolve => setTimeout(resolve, 5000));
        throw new Error(`Timeout: ${errorMessage}`);
      } else {
        throw new Error(errorMessage);
      }
    }
    
    // 元の実装を呼び出す
    return originalImplementations['market-data-providers'].getUsStockData(symbol);
  });
  
  // getJpStockData メソッドの障害シミュレーション
  marketDataProviders.getJpStockData = jest.fn().mockImplementation(async (code) => {
    console.log(`Simulated Market Data Providers getJpStockData called for ${code}`);
    
    if (shouldFail(errorRate)) {
      console.log(`Simulating failure for ${code}`);
      
      if (errorType === 'timeout') {
        // タイムアウトをシミュレート
        await new Promise(resolve => setTimeout(resolve, 5000));
        throw new Error(`Timeout: ${errorMessage}`);
      } else {
        throw new Error(errorMessage);
      }
    }
    
    // 元の実装を呼び出す
    return originalImplementations['market-data-providers'].getJpStockData(code);
  });
  
  // 他のメソッドも同様にシミュレーション...
};

/**
 * 為替レートAPIの障害をシミュレート
 * @param {string} errorType - エラータイプ
 * @param {number} errorRate - エラー発生率
 * @param {string} errorMessage - エラーメッセージ
 */
const simulateExchangeRateFailure = (errorType, errorRate, errorMessage) => {
  // getExchangeRate メソッドの障害シミュレーション
  exchangeRateService.getExchangeRate = jest.fn().mockImplementation(async (base, target) => {
    console.log(`Simulated Exchange Rate API getExchangeRate called for ${base}/${target}`);
    
    if (shouldFail(errorRate)) {
      console.log(`Simulating failure for ${base}/${target}`);
      
      if (errorType === 'timeout') {
        // タイムアウトをシミュレート
        await new Promise(resolve => setTimeout(resolve, 5000));
        throw new Error(`Timeout: ${errorMessage}`);
      } else {
        throw new Error(errorMessage);
      }
    }
    
    // 元の実装を呼び出す
    return originalImplementations['exchange-rate-api'].getExchangeRate(base, target);
  });
  
  // getBatchExchangeRates メソッドの障害シミュレーション
  // 同様に実装...
};

/**
 * FundDataServiceの障害をシミュレート
 * @param {string} errorType - エラータイプ
 * @param {number} errorRate - エラー発生率
 * @param {string} errorMessage - エラーメッセージ
 */
const simulateFundDataServiceFailure = (errorType, errorRate, errorMessage) => {
  // getMutualFundData メソッドの障害シミュレーション
  fundDataService.getMutualFundData = jest.fn().mockImplementation(async (code) => {
    console.log(`Simulated Fund Data Service getMutualFundData called for ${code}`);
    
    if (shouldFail(errorRate)) {
      console.log(`Simulating failure for ${code}`);
      
      if (errorType === 'timeout') {
        // タイムアウトをシミュレート
        await new Promise(resolve => setTimeout(resolve, 5000));
        throw new Error(`Timeout: ${errorMessage}`);
      } else {
        throw new Error(errorMessage);
      }
    }
    
    // 元の実装を呼び出す
    return originalImplementations['fund-data-service'].getMutualFundData(code);
  });
  
  // getMutualFundsParallel メソッドの障害シミュレーション
  // 同様に実装...
};

module.exports = {
  simulateDataSourceFailure,
  resetDataSources
};
