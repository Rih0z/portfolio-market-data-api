/**
 * ファイルパス: __tests__/unit/services/sources/enhancedMarketDataService.test.js
 * 
 * 強化版マーケットデータサービスのユニットテスト
 * フォールバック機能とキャッシュ対応を含む各種市場データ取得機能をテスト
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-15
 */

const enhancedMarketDataService = require('../../../../src/services/sources/enhancedMarketDataService');
const yahooFinanceService = require('../../../../src/services/sources/yahooFinance');
const scrapingService = require('../../../../src/services/sources/marketDataProviders');
const exchangeRateService = require('../../../../src/services/sources/exchangeRate');
const fundDataService = require('../../../../src/services/sources/fundDataService');
const { fetchDataWithFallback, fetchBatchDataWithFallback } = require('../../../../src/utils/dataFetchWithFallback');

// 依存モジュールをモック化
jest.mock('../../../../src/services/sources/yahooFinance');
jest.mock('../../../../src/services/sources/marketDataProviders');
jest.mock('../../../../src/services/sources/exchangeRate');
jest.mock('../../../../src/services/sources/fundDataService');
jest.mock('../../../../src/utils/dataFetchWithFallback');

describe('Enhanced Market Data Service', () => {
  // テスト用データ
  const usStockSymbol = 'AAPL';
  const jpStockCode = '7203';
  const mutualFundCode = '0131103C';
  const exchangeRateBase = 'USD';
  const exchangeRateTarget = 'JPY';
  
  const mockStockData = {
    symbol: usStockSymbol,
    price: 180.95,
    change: 2.5,
    changePercent: 1.4,
    currency: 'USD'
  };
  
  const mockJpStockData = {
    symbol: jpStockCode,
    price: 2500,
    change: 50,
    changePercent: 2.0,
    currency: 'JPY'
  };
  
  const mockMutualFundData = {
    symbol: mutualFundCode,
    price: 12345,
    change: 25,
    changePercent: 0.2,
    currency: 'JPY',
    isMutualFund: true
  };
  
  const mockExchangeRateData = {
    pair: 'USD-JPY',
    rate: 149.82,
    change: 0.32,
    changePercent: 0.21,
    base: exchangeRateBase,
    target: exchangeRateTarget
  };
  
  // 各テスト前の準備
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // モック実装を設定
    yahooFinanceService.getStockData.mockResolvedValue({ 
      [usStockSymbol]: mockStockData 
    });
    
    yahooFinanceService.getStocksData.mockResolvedValue({
      'AAPL': mockStockData,
      'MSFT': {
        symbol: 'MSFT',
        price: 310.5,
        change: 5.2,
        changePercent: 1.7,
        currency: 'USD'
      }
    });
    
    scrapingService.getUsStockData.mockResolvedValue(mockStockData);
    scrapingService.getJpStockData.mockResolvedValue(mockJpStockData);
    
    fundDataService.getMutualFundData.mockResolvedValue(mockMutualFundData);
    
    exchangeRateService.getExchangeRate.mockResolvedValue({
      'USD-JPY': mockExchangeRateData
    });
    
    // fetchDataWithFallback のモック
    fetchDataWithFallback.mockImplementation(({ symbol, defaultValues }) => {
      if (symbol === usStockSymbol) {
        return { [usStockSymbol]: mockStockData };
      }
      if (symbol === jpStockCode) {
        return { [jpStockCode]: mockJpStockData };
      }
      if (symbol === mutualFundCode) {
        return { [mutualFundCode]: mockMutualFundData };
      }
      if (symbol === 'USD-JPY') {
        return mockExchangeRateData;
      }
      return { [symbol]: { ...defaultValues, symbol } };
    });
    
    // fetchBatchDataWithFallback のモック
    fetchBatchDataWithFallback.mockImplementation(({ symbols, defaultValues }) => {
      const result = {};
      symbols.forEach(symbol => {
        if (symbol === usStockSymbol) {
          result[symbol] = mockStockData;
        } else if (symbol === jpStockCode) {
          result[symbol] = mockJpStockData;
        } else if (symbol === mutualFundCode) {
          result[symbol] = mockMutualFundData;
        } else {
          result[symbol] = { ...defaultValues, symbol };
        }
      });
      return result;
    });
  });
  
  describe('getUsStockData', () => {
    test('単一の米国株データを取得する', async () => {
      // テスト対象の関数を実行
      const result = await enhancedMarketDataService.getUsStockData(usStockSymbol);
      
      // fetchDataWithFallback が正しく呼び出されたか検証
      expect(fetchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: usStockSymbol,
          dataType: expect.any(String),
          fetchFunctions: expect.any(Array),
          defaultValues: expect.objectContaining({
            price: expect.any(Number),
            currency: 'USD'
          }),
          refresh: false
        })
      );
      
      // 結果が正しいことを検証
      expect(result).toEqual({ [usStockSymbol]: mockStockData });
    });
    
    test('refresh=true でキャッシュを無視する', async () => {
      // テスト対象の関数を実行
      await enhancedMarketDataService.getUsStockData(usStockSymbol, true);
      
      // refresh=true で呼び出されたか検証
      expect(fetchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          refresh: true
        })
      );
    });
  });
  
  describe('getUsStocksData', () => {
    test('複数の米国株データを取得する', async () => {
      const symbols = ['AAPL', 'MSFT', 'GOOGL'];
      
      // テスト対象の関数を実行
      const result = await enhancedMarketDataService.getUsStocksData(symbols);
      
      // Yahoo Finance API のバッチ取得が呼び出されたか検証
      expect(yahooFinanceService.getStocksData).toHaveBeenCalledWith(symbols);
      
      // 結果が正しいことを検証
      expect(result).toHaveProperty('AAPL');
      expect(result).toHaveProperty('MSFT');
    });
    
    test('Yahoo Finance API 失敗時に個別取得にフォールバックする', async () => {
      // バッチAPIの失敗をシミュレート
      yahooFinanceService.getStocksData.mockRejectedValue(
        new Error('Batch API failed')
      );
      
      const symbols = ['AAPL', 'MSFT'];
      
      // テスト対象の関数を実行
      await enhancedMarketDataService.getUsStocksData(symbols);
      
      // fetchBatchDataWithFallback が呼び出されたか検証
      expect(fetchBatchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          symbols,
          dataType: expect.any(String),
          fetchFunctions: expect.any(Array)
        })
      );
    });
    
    test('バッチAPIで一部のシンボルが取得できなかった場合は個別取得で補完する', async () => {
      // 一部の銘柄だけ返すようにモック
      yahooFinanceService.getStocksData.mockResolvedValue({
        'AAPL': mockStockData
        // MSFT は含まれていない
      });
      
      const symbols = ['AAPL', 'MSFT'];
      
      // テスト対象の関数を実行
      await enhancedMarketDataService.getUsStocksData(symbols);
      
      // 不足している銘柄のみ fetchBatchDataWithFallback が呼び出されたか検証
      expect(fetchBatchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          symbols: ['MSFT'], // AAPLはすでに取得済みなので含まれない
          dataType: expect.any(String)
        })
      );
    });
  });
  
  describe('getJpStockData', () => {
    test('単一の日本株データを取得する', async () => {
      // テスト対象の関数を実行
      const result = await enhancedMarketDataService.getJpStockData(jpStockCode);
      
      // fetchDataWithFallback が正しく呼び出されたか検証
      expect(fetchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: jpStockCode,
          dataType: expect.any(String),
          fetchFunctions: expect.any(Array),
          defaultValues: expect.objectContaining({
            currency: 'JPY'
          }),
          refresh: false
        })
      );
      
      // 結果が正しいことを検証
      expect(result).toEqual({ [jpStockCode]: mockJpStockData });
    });
  });
  
  describe('getJpStocksData', () => {
    test('複数の日本株データを取得する', async () => {
      const codes = [jpStockCode, '9984'];
      
      // テスト対象の関数を実行
      await enhancedMarketDataService.getJpStocksData(codes);
      
      // fetchBatchDataWithFallback が正しく呼び出されたか検証
      expect(fetchBatchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          symbols: codes,
          dataType: expect.any(String),
          fetchFunctions: expect.any(Array),
          defaultValues: expect.objectContaining({
            currency: 'JPY'
          })
        })
      );
    });
  });
  
  describe('getMutualFundData', () => {
    test('単一の投資信託データを取得する', async () => {
      // テスト対象の関数を実行
      const result = await enhancedMarketDataService.getMutualFundData(mutualFundCode);
      
      // fetchDataWithFallback が正しく呼び出されたか検証
      expect(fetchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: mutualFundCode,
          dataType: expect.any(String),
          fetchFunctions: expect.any(Array),
          defaultValues: expect.objectContaining({
            currency: 'JPY',
            isMutualFund: true
          }),
          refresh: false
        })
      );
      
      // 結果が正しいことを検証
      expect(result).toEqual({ [mutualFundCode]: mockMutualFundData });
    });
  });
  
  describe('getMutualFundsData', () => {
    test('複数の投資信託データを取得する', async () => {
      const codes = [mutualFundCode, '2931113C'];
      
      // テスト対象の関数を実行
      await enhancedMarketDataService.getMutualFundsData(codes);
      
      // fetchBatchDataWithFallback が正しく呼び出されたか検証
      expect(fetchBatchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          symbols: codes,
          dataType: expect.any(String),
          fetchFunctions: expect.any(Array),
          defaultValues: expect.objectContaining({
            currency: 'JPY',
            isMutualFund: true
          })
        })
      );
    });
  });
  
  describe('getExchangeRateData', () => {
    test('為替レートデータを取得する', async () => {
      // テスト対象の関数を実行
      const result = await enhancedMarketDataService.getExchangeRateData(
        exchangeRateBase, 
        exchangeRateTarget
      );
      
      // fetchDataWithFallback が正しく呼び出されたか検証
      expect(fetchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'USD-JPY',
          dataType: expect.any(String),
          fetchFunctions: expect.any(Array),
          defaultValues: expect.objectContaining({
            pair: 'USD-JPY',
            base: exchangeRateBase,
            target: exchangeRateTarget
          }),
          refresh: false,
          cache: expect.objectContaining({
            time: expect.any(Number)
          })
        })
      );
      
      // 結果が正しいことを検証
      expect(result).toEqual(mockExchangeRateData);
    });
    
    test('カスタムのキャッシュ時間が設定されている', async () => {
      // テスト対象の関数を実行
      await enhancedMarketDataService.getExchangeRateData(
        exchangeRateBase, 
        exchangeRateTarget
      );
      
      // 為替レート用の長めのキャッシュ時間が設定されているか検証
      expect(fetchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          cache: {
            time: 21600 // 6時間
          }
        })
      );
    });
  });
});
