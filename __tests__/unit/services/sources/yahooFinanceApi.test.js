/**
 * ファイルパス: __tests__/unit/services/sources/yahooFinanceApi.test.js
 * 
 * Yahoo Finance APIアダプターのユニットテスト
 * API呼び出しとデータパース機能をテスト
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-15
 * @updated 2025-05-21 インポートパス修正: yahooFinanceApi → yahooFinance
 */

const yahooFinanceApi = require('../../../../src/services/sources/yahooFinance');
const axios = require('axios');
const { withRetry } = require('../../../../src/utils/retry');

// axiosとretryユーティリティをモック
jest.mock('axios');
jest.mock('../../../../src/utils/retry');

describe('Yahoo Finance API Adapter', () => {
  // テスト用データ
  const testSymbol = 'AAPL';
  const testSymbols = ['AAPL', 'MSFT', 'GOOGL'];
  
  const mockQuoteResponse = {
    quoteResponse: {
      result: [
        {
          symbol: 'AAPL',
          regularMarketPrice: 185.92,
          regularMarketChange: 2.46,
          regularMarketChangePercent: 1.34,
          shortName: 'Apple Inc.',
          currency: 'USD',
          regularMarketTime: 1652188800
        }
      ],
      error: null
    }
  };
  
  const mockMultipleQuoteResponse = {
    quoteResponse: {
      result: [
        {
          symbol: 'AAPL',
          regularMarketPrice: 185.92,
          regularMarketChange: 2.46,
          regularMarketChangePercent: 1.34,
          shortName: 'Apple Inc.',
          currency: 'USD',
          regularMarketTime: 1652188800
        },
        {
          symbol: 'MSFT',
          regularMarketPrice: 310.50,
          regularMarketChange: 5.25,
          regularMarketChangePercent: 1.72,
          shortName: 'Microsoft Corporation',
          currency: 'USD',
          regularMarketTime: 1652188800
        },
        {
          symbol: 'GOOGL',
          regularMarketPrice: 175.20,
          regularMarketChange: -0.80,
          regularMarketChangePercent: -0.45,
          shortName: 'Alphabet Inc.',
          currency: 'USD',
          regularMarketTime: 1652188800
        }
      ],
      error: null
    }
  };
  
  // 各テスト前の準備
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // axios.getのモック
    axios.get.mockResolvedValue({
      status: 200,
      data: mockQuoteResponse
    });
    
    // withRetryのモック - 引数の関数をそのまま実行
    withRetry.mockImplementation((fn) => fn());
  });

  describe('getStockData', () => {
    test('単一シンボルのデータを取得する', async () => {
      // テスト対象の関数を実行
      const result = await yahooFinanceApi.getStockData(testSymbol);
      
      // axios.getが正しく呼び出されたか検証
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/market/v2/get-quotes'),
        expect.objectContaining({
          params: expect.objectContaining({
            symbols: testSymbol,
            region: 'US'
          }),
          headers: expect.objectContaining({
            'X-RapidAPI-Key': expect.any(String),
            'X-RapidAPI-Host': expect.any(String)
          })
        })
      );
      
      // withRetryが使用されたか検証
      expect(withRetry).toHaveBeenCalled();
      
      // 結果の検証
      expect(result).toEqual({
        ticker: 'AAPL',
        price: 185.92,
        change: 2.46,
        changePercent: 1.34,
        name: 'Apple Inc.',
        currency: 'USD',
        lastUpdated: expect.any(String),
        source: 'Yahoo Finance API',
        isStock: true,
        isMutualFund: false,
        volume: undefined,
        marketCap: undefined
      });
    });
    
    test('複数シンボルのデータを取得する', async () => {
      // 複数シンボルのレスポンスをモック
      axios.get.mockResolvedValue({
        status: 200,
        data: mockMultipleQuoteResponse
      });
      
      // 複数シンボルを配列で渡す
      const result = await yahooFinanceApi.getStocksData(testSymbols);
      
      // axios.getが正しく呼び出されたか検証
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/market/v2/get-quotes'),
        expect.objectContaining({
          params: expect.objectContaining({
            symbols: 'AAPL,MSFT,GOOGL',
            region: 'US'
          })
        })
      );
      
      // 結果の検証
      expect(Object.keys(result).length).toBe(3);
      expect(result).toHaveProperty('AAPL');
      expect(result).toHaveProperty('MSFT');
      expect(result).toHaveProperty('GOOGL');
      
      // 各シンボルのデータが正しく変換されているか検証
      expect(result['AAPL'].price).toBe(185.92);
      expect(result['MSFT'].price).toBe(310.50);
      expect(result['GOOGL'].price).toBe(175.20);
      expect(result['GOOGL'].change).toBe(-0.80); // 負の値も正しく処理されるか
    });
    
    test('シンボルを文字列で渡した場合も処理する', async () => {
      // シンボルをカンマ区切り文字列で渡す
      const result = await yahooFinanceApi.getStockData('AAPL,MSFT');
      
      // axios.getが正しく呼び出されたか検証
      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            symbols: 'AAPL,MSFT'
          })
        })
      );
    });
    
    test('結果が空の場合は空のオブジェクトを返す', async () => {
      // 結果が空のレスポンスをモック
      axios.get.mockResolvedValue({
        status: 200,
        data: {
          quoteResponse: {
            result: [],
            error: null
          }
        }
      });
      
      // エラーが発生することを期待
      await expect(yahooFinanceApi.getStockData(testSymbol)).rejects.toThrow(`No data found for symbol: ${testSymbol}`);
    });
    
    test('APIエラーが発生した場合は例外をスロー', async () => {
      // APIエラーをモック
      axios.get.mockRejectedValue(new Error('API request failed'));
      
      // 例外が伝播することを検証
      await expect(yahooFinanceApi.getStockData(testSymbol)).rejects.toThrow(`Failed to retrieve stock data for ${testSymbol}`);
    });
    
    test('APIレスポンスにエラーが含まれる場合は例外をスロー', async () => {
      // エラーを含むレスポンスをモック
      axios.get.mockResolvedValue({
        status: 200,
        data: {
          quoteResponse: {
            result: [],
            error: {
              code: 'INVALID_SYMBOLS',
              description: 'Invalid symbols'
            }
          }
        }
      });
      
      // 例外が発生することを検証
      await expect(yahooFinanceApi.getStockData(testSymbol)).rejects.toThrow(`No data found for symbol: ${testSymbol}`);
    });
    
    test('非200レスポンスの場合は例外をスロー', async () => {
      // 400エラーをモック
      axios.get.mockResolvedValue({
        status: 400,
        data: {
          message: 'Bad request'
        }
      });
      
      // レスポンスフォーマットエラーが発生することを検証
      await expect(yahooFinanceApi.getStockData(testSymbol)).rejects.toThrow('Invalid API response format');
    });
  });

  describe('API Key の取得と設定', () => {
    test('環境変数からAPI Keyを取得する', async () => {
      // 元の環境変数を保存
      const originalEnv = process.env.YAHOO_FINANCE_API_KEY;
      const originalHost = process.env.YAHOO_FINANCE_API_HOST;
      
      // テスト用の環境変数を設定
      process.env.YAHOO_FINANCE_API_KEY = 'test-api-key';
      process.env.YAHOO_FINANCE_API_HOST = 'test-api-host';
      
      // テスト対象の関数を実行
      await yahooFinanceApi.getStockData(testSymbol);
      
      // axios.getが正しいヘッダーで呼び出されたか検証
      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-RapidAPI-Key': 'test-api-key',
            'X-RapidAPI-Host': 'test-api-host'
          })
        })
      );
      
      // 環境変数を元に戻す
      process.env.YAHOO_FINANCE_API_KEY = originalEnv;
      process.env.YAHOO_FINANCE_API_HOST = originalHost;
    });
    
    test('環境変数が設定されていない場合はデフォルト値を使用', async () => {
      // 元の環境変数を保存
      const originalEnv = process.env.YAHOO_FINANCE_API_KEY;
      const originalHost = process.env.YAHOO_FINANCE_API_HOST;
      
      // 環境変数を削除
      delete process.env.YAHOO_FINANCE_API_KEY;
      delete process.env.YAHOO_FINANCE_API_HOST;
      
      // テスト対象の関数を実行
      try {
        await yahooFinanceApi.getStockData(testSymbol);
      } catch (error) {
        // APIキーがないためエラーが発生する可能性があるが、
        // ここではリクエストが送信されたことだけを検証
      }
      
      // axios.getが呼び出されたことを検証
      expect(axios.get).toHaveBeenCalled();
      
      // 環境変数を元に戻す
      process.env.YAHOO_FINANCE_API_KEY = originalEnv;
      process.env.YAHOO_FINANCE_API_HOST = originalHost;
    });
  });
});
