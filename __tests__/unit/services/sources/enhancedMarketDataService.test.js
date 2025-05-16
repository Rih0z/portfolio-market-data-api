// __tests__/unit/services/sources/enhancedMarketDataService.test.js
const enhancedMarketDataService = require('../../../../src/services/sources/enhancedMarketDataService');

// Fix: Properly mock all dependencies
jest.mock('../../../../src/utils/fetchDataWithFallback', () => ({
  fetchDataWithFallback: jest.fn(),
  fetchBatchDataWithFallback: jest.fn()
}));

jest.mock('../../../../src/services/sources/yahooFinance', () => ({
  getStocksData: jest.fn()
}));

// Import mocked dependencies
const { fetchDataWithFallback, fetchBatchDataWithFallback } = require('../../../../src/utils/fetchDataWithFallback');
const yahooFinance = require('../../../../src/services/sources/yahooFinance');

describe('Enhanced Market Data Service', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock implementations
    fetchDataWithFallback.mockResolvedValue({
      ticker: 'AAPL',
      price: 180.95,
      change: 2.5,
      changePercent: 1.4,
      name: 'Apple Inc.',
      currency: 'USD'
    });
    
    fetchBatchDataWithFallback.mockResolvedValue({
      'AAPL': {
        ticker: 'AAPL',
        price: 180.95,
        currency: 'USD'
      },
      'MSFT': {
        ticker: 'MSFT',
        price: 420.30,
        currency: 'USD'
      }
    });
    
    yahooFinance.getStocksData.mockResolvedValue({
      'AAPL': {
        ticker: 'AAPL',
        price: 180.95
      },
      'MSFT': {
        ticker: 'MSFT',
        price: 420.30
      },
      'GOOGL': {
        ticker: 'GOOGL',
        price: 170.50
      }
    });
  });

  describe('getUsStockData', () => {
    test('単一の米国株データを取得する', async () => {
      const usStockSymbol = 'AAPL';
      
      // テスト対象の関数を実行
      const result = await enhancedMarketDataService.getUsStockData(usStockSymbol);
      
      // fetchDataWithFallback が正しく呼び出されたか検証
      expect(fetchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: usStockSymbol,
          dataType: expect.any(String),
          fetchFunctions: expect.any(Array),
          defaultValues: expect.objectContaining({
            currency: 'USD',
            price: expect.any(Number)
          }),
          refresh: false
        })
      );
      
      // 結果の検証
      expect(result).toEqual({
        ticker: 'AAPL',
        price: 180.95,
        change: 2.5,
        changePercent: 1.4,
        name: 'Apple Inc.',
        currency: 'USD'
      });
    });
    
    test('refresh=true でキャッシュを無視する', async () => {
      const usStockSymbol = 'AAPL';
      
      // テスト対象の関数を実行
      const result = await enhancedMarketDataService.getUsStockData(usStockSymbol, true);
      
      // refresh=true で呼び出されたか検証
      expect(fetchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          refresh: true
        })
      );
      
      // 結果の検証
      expect(result).toBeDefined();
    });
  });
  
  describe('getUsStocksData', () => {
    test('複数の米国株データを取得する', async () => {
      const symbols = ['AAPL', 'MSFT', 'GOOGL'];
      
      // テスト対象の関数を実行
      const result = await enhancedMarketDataService.getUsStocksData(symbols);
      
      // Yahoo Finance API のバッチ取得が呼び出されたか検証
      expect(yahooFinance.getStocksData).toHaveBeenCalledWith(symbols);
      
      // 結果の検証
      expect(result).toHaveProperty('AAPL');
      expect(result).toHaveProperty('MSFT');
      expect(result).toHaveProperty('GOOGL');
    });
    
    test('Yahoo Finance API 失敗時に個別取得にフォールバックする', async () => {
      const symbols = ['AAPL', 'MSFT'];
      
      // Yahoo Finance APIが失敗するようにモック
      yahooFinance.getStocksData.mockRejectedValue(new Error('API error'));
      
      // テスト対象の関数を実行
      const result = await enhancedMarketDataService.getUsStocksData(symbols);
      
      // fetchBatchDataWithFallback が呼び出されたか検証
      expect(fetchBatchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          symbols,
          dataType: expect.any(String),
          fetchFunctions: expect.any(Array)
        })
      );
      
      // 結果の検証
      expect(result).toBeDefined();
    });
    
    test('バッチAPIで一部のシンボルが取得できなかった場合は個別取得で補完する', async () => {
      const symbols = ['AAPL', 'MSFT'];
      
      // 一部のシンボルだけ取得できるようにモック
      yahooFinance.getStocksData.mockResolvedValue({
        'AAPL': {
          ticker: 'AAPL',
          price: 180.95
        }
        // MSFTのデータは含まれていない
      });
      
      // テスト対象の関数を実行
      const result = await enhancedMarketDataService.getUsStocksData(symbols);
      
      // 不足している銘柄のみ fetchBatchDataWithFallback が呼び出されたか検証
      expect(fetchBatchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          symbols: ['MSFT'], // AAPLはすでに取得済みなので含まれない
          dataType: expect.any(String)
        })
      );
      
      // 結果の検証
      expect(result).toBeDefined();
    });
  });
  
  describe('getJpStockData', () => {
    test('単一の日本株データを取得する', async () => {
      const jpStockCode = '7203';
      
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
      
      // 結果の検証
      expect(result).toBeDefined();
    });
  });
  
  describe('getJpStocksData', () => {
    test('複数の日本株データを取得する', async () => {
      const codes = ['7203', '9984'];
      
      // モックを設定
      fetchBatchDataWithFallback.mockResolvedValue({
        '7203': { ticker: '7203', price: 2500, currency: 'JPY' },
        '9984': { ticker: '9984', price: 6789, currency: 'JPY' }
      });
      
      // テスト対象の関数を実行
      const result = await enhancedMarketDataService.getJpStocksData(codes);
      
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
      
      // 結果の検証
      expect(result).toHaveProperty('7203');
      expect(result).toHaveProperty('9984');
    });
  });
  
  describe('getMutualFundData', () => {
    test('単一の投資信託データを取得する', async () => {
      const mutualFundCode = '0131103C';
      
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
      
      // 結果の検証
      expect(result).toBeDefined();
    });
  });
  
  describe('getMutualFundsData', () => {
    test('複数の投資信託データを取得する', async () => {
      const codes = ['0131103C', '2931113C'];
      
      // モックを設定
      fetchBatchDataWithFallback.mockResolvedValue({
        '0131103C': { ticker: '0131103C', price: 12345, currency: 'JPY' },
        '2931113C': { ticker: '2931113C', price: 23456, currency: 'JPY' }
      });
      
      // テスト対象の関数を実行
      const result = await enhancedMarketDataService.getMutualFundsData(codes);
      
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
      
      // 結果の検証
      expect(result).toHaveProperty('0131103C');
      expect(result).toHaveProperty('2931113C');
    });
  });
  
  describe('getExchangeRateData', () => {
    test('為替レートデータを取得する', async () => {
      // テスト対象の関数を実行
      const result = await enhancedMarketDataService.getExchangeRateData('USD-JPY');
      
      // fetchDataWithFallback が正しく呼び出されたか検証
      expect(fetchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'USD-JPY',
          dataType: expect.any(String),
          fetchFunctions: expect.any(Array),
          defaultValues: expect.objectContaining({
            pair: 'USD-JPY',
            base: 'USD',
            target: 'JPY'
          }),
          refresh: false,
          cache: expect.objectContaining({
            time: expect.any(Number)
          })
        })
      );
      
      // 結果の検証
      expect(result).toBeDefined();
    });
    
    test('カスタムのキャッシュ時間が設定されている', async () => {
      // テスト対象の関数を実行
      const result = await enhancedMarketDataService.getExchangeRateData('USD-JPY');
      
      // 為替レート用の長めのキャッシュ時間が設定されているか検証
      expect(fetchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          cache: {
            time: 21600 // 6時間
          }
        })
      );
      
      // 結果の検証
      expect(result).toBeDefined();
    });
  });
});
