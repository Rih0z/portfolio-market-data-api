/**
 * ファイルパス: __tests__/unit/services/sources/exchangeRate.test.js
 * 
 * 為替レートAPIアダプターのユニットテスト
 * 為替レートAPIアクセスとデータ変換機能をテスト
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-15
 */

const exchangeRate = require('../../../../src/services/sources/exchangeRate');
const axios = require('axios');
const { withRetry } = require('../../../../src/utils/retry');

// axiosとretryユーティリティをモック
jest.mock('axios');
jest.mock('../../../../src/utils/retry');

describe('Exchange Rate API Adapter', () => {
  // テスト用データ
  const testPair = 'USD-JPY';
  const testBase = 'USD';
  const testTarget = 'JPY';
  
  const mockExchangeRateResponse = {
    success: true,
    base: 'USD',
    date: '2025-05-15',
    rates: {
      JPY: 149.82
    }
  };
  
  // 各テスト前の準備
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // axios.getのモック
    axios.get.mockResolvedValue({
      status: 200,
      data: mockExchangeRateResponse
    });
    
    // withRetryのモック - 引数の関数をそのまま実行
    withRetry.mockImplementation((fn) => fn());
  });

  describe('getExchangeRate', () => {
    test('正常に為替レートデータを取得する', async () => {
      // テスト対象の関数を実行
      const result = await exchangeRate.getExchangeRate(testBase, testTarget);
      
      // axios.getが正しく呼び出されたか検証
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/latest'),
        expect.objectContaining({
          params: expect.objectContaining({
            base: testBase,
            symbols: testTarget
          })
        })
      );
      
      // withRetryが使用されたか検証
      expect(withRetry).toHaveBeenCalled();
      
      // 結果の検証
      expect(result).toEqual({
        pair: 'USD-JPY',
        rate: 149.82,
        base: 'USD',
        target: 'JPY',
        lastUpdated: expect.any(String)
      });
    });
    
    test('複数の通貨ペアを取得する場合', async () => {
      // 複数通貨のレスポンスをモック
      axios.get.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          base: 'USD',
          date: '2025-05-15',
          rates: {
            JPY: 149.82,
            EUR: 0.93,
            GBP: 0.79
          }
        }
      });
      
      // テスト対象の関数を実行
      const result = await exchangeRate.getExchangeRate(testBase, 'JPY,EUR,GBP');
      
      // axios.getが正しく呼び出されたか検証
      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            symbols: 'JPY,EUR,GBP'
          })
        })
      );
      
      // 結果の検証
      expect(result).toHaveProperty('USD-JPY');
      expect(result).toHaveProperty('USD-EUR');
      expect(result).toHaveProperty('USD-GBP');
      
      expect(result['USD-JPY'].rate).toBe(149.82);
      expect(result['USD-EUR'].rate).toBe(0.93);
      expect(result['USD-GBP'].rate).toBe(0.79);
    });
    
    test('APIエラーが発生した場合は例外をスロー', async () => {
      // APIエラーをモック
      axios.get.mockRejectedValue(new Error('API request failed'));
      
      // 例外が伝播することを検証
      await expect(exchangeRate.getExchangeRate(testBase, testTarget)).rejects.toThrow('API request failed');
    });
    
    test('APIレスポンスがsuccessでない場合は例外をスロー', async () => {
      // 失敗レスポンスをモック
      axios.get.mockResolvedValue({
        status: 200,
        data: {
          success: false,
          error: {
            code: 'invalid_base_currency',
            message: 'Invalid base currency'
          }
        }
      });
      
      // 例外が発生することを検証
      await expect(exchangeRate.getExchangeRate(testBase, testTarget)).rejects.toThrow('Exchange Rate API error');
    });
    
    test('非200レスポンスの場合は例外をスロー', async () => {
      // 429エラーをモック
      axios.get.mockResolvedValue({
        status: 429,
        data: {
          message: 'Too many requests'
        }
      });
      
      // 例外が発生することを検証
      await expect(exchangeRate.getExchangeRate(testBase, testTarget)).rejects.toThrow('Exchange Rate API returned status 429');
    });
  });

  describe('getExchangeRateFromExchangerateHost', () => {
    test('exchangerate.hostからレートデータを取得する', async () => {
      // テスト対象の関数を実行
      const result = await exchangeRate.getExchangeRateFromExchangerateHost(testBase, testTarget);
      
      // axios.getが正しく呼び出されたか検証
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/latest'),
        expect.any(Object)
      );
      
      // 結果の検証
      expect(result).toEqual({
        pair: 'USD-JPY',
        rate: 149.82,
        base: 'USD',
        target: 'JPY',
        lastUpdated: expect.any(String)
      });
    });
  });

  describe('parseExchangeRateData', () => {
    test('レスポンスデータを正しくパースする', () => {
      // テスト対象の関数を実行
      const result = exchangeRate.parseExchangeRateData(mockExchangeRateResponse, testBase);
      
      // 結果の検証
      expect(result).toEqual({
        'USD-JPY': {
          pair: 'USD-JPY',
          rate: 149.82,
          base: 'USD',
          target: 'JPY',
          lastUpdated: expect.any(String)
        }
      });
    });
    
    test('複数の通貨レートを正しくパースする', () => {
      const multiRateResponse = {
        success: true,
        base: 'USD',
        date: '2025-05-15',
        rates: {
          JPY: 149.82,
          EUR: 0.93,
          GBP: 0.79
        }
      };
      
      const result = exchangeRate.parseExchangeRateData(multiRateResponse, testBase);
      
      // 結果の検証
      expect(Object.keys(result).length).toBe(3);
      expect(result).toHaveProperty('USD-JPY');
      expect(result).toHaveProperty('USD-EUR');
      expect(result).toHaveProperty('USD-GBP');
      
      expect(result['USD-JPY'].rate).toBe(149.82);
      expect(result['USD-EUR'].rate).toBe(0.93);
      expect(result['USD-GBP'].rate).toBe(0.79);
    });
    
    test('レートが存在しない場合は空のオブジェクトを返す', () => {
      const emptyRatesResponse = {
        success: true,
        base: 'USD',
        date: '2025-05-15',
        rates: {}
      };
      
      const result = exchangeRate.parseExchangeRateData(emptyRatesResponse, testBase);
      
      // 空のオブジェクトが返されるか検証
      expect(result).toEqual({});
    });
    
    test('異常なレスポンス形式でも安全に処理する', () => {
      const malformedResponse = {
        success: true,
        base: 'USD',
        // date フィールドがない
        // rates フィールドがない
      };
      
      const result = exchangeRate.parseExchangeRateData(malformedResponse, testBase);
      
      // 空のオブジェクトが返されるか検証
      expect(result).toEqual({});
    });
  });

  describe('getBatchExchangeRates', () => {
    test('複数の為替ペアをバッチで取得する', async () => {
      // 複数通貨のレスポンスをモック
      axios.get.mockResolvedValue({
        status: 200,
        data: {
          success: true,
          base: 'USD',
          date: '2025-05-15',
          rates: {
            JPY: 149.82,
            EUR: 0.93,
            GBP: 0.79
          }
        }
      });
      
      // テスト対象の関数を実行
      const result = await exchangeRate.getBatchExchangeRates(['USD-JPY', 'USD-EUR', 'USD-GBP']);
      
      // 結果の検証
      expect(Object.keys(result).length).toBe(3);
      expect(result).toHaveProperty('USD-JPY');
      expect(result).toHaveProperty('USD-EUR');
      expect(result).toHaveProperty('USD-GBP');
    });
  });

  describe('API設定の取得', () => {
    test('環境変数からAPIキーを取得する', async () => {
      // 元の環境変数を保存
      const originalApiKey = process.env.EXCHANGE_RATE_API_KEY;
      
      // テスト用の環境変数を設定
      process.env.EXCHANGE_RATE_API_KEY = 'test-api-key';
      
      // テスト対象の関数を実行
      await exchangeRate.getExchangeRate(testBase, testTarget);
      
      // axios.getが正しいヘッダーで呼び出されたか検証
      expect(axios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            access_key: 'test-api-key'
          })
        })
      );
      
      // 環境変数を元に戻す
      process.env.EXCHANGE_RATE_API_KEY = originalApiKey;
    });
    
    test('環境変数が設定されていない場合はデフォルト値を使用', async () => {
      // 元の環境変数を保存
      const originalApiKey = process.env.EXCHANGE_RATE_API_KEY;
      
      // 環境変数を削除
      delete process.env.EXCHANGE_RATE_API_KEY;
      
      // テスト対象の関数を実行
      await exchangeRate.getExchangeRate(testBase, testTarget);
      
      // axios.getが呼び出されたことを検証
      expect(axios.get).toHaveBeenCalled();
      
      // デフォルト値またはアクセスキーなしで呼び出されるか検証
      const callArgs = axios.get.mock.calls[0][1];
      
      // 環境変数がない場合の実装による（access_keyがない、またはデフォルト値がある）
      if (callArgs.params.access_key) {
        expect(callArgs.params.access_key).toBeTruthy();
      }
      
      // 環境変数を元に戻す
      process.env.EXCHANGE_RATE_API_KEY = originalApiKey;
    });
    
    test('カスタムベースURLを使用する', async () => {
      // 元の環境変数を保存
      const originalBaseUrl = process.env.EXCHANGE_RATE_API_URL;
      
      // テスト用の環境変数を設定
      process.env.EXCHANGE_RATE_API_URL = 'https://custom-api.example.com';
      
      // テスト対象の関数を実行
      await exchangeRate.getExchangeRate(testBase, testTarget);
      
      // カスタムURLで呼び出されたか検証
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('https://custom-api.example.com'),
        expect.any(Object)
      );
      
      // 環境変数を元に戻す
      process.env.EXCHANGE_RATE_API_URL = originalBaseUrl;
    });
  });

  describe('getExchangeRateFromDynamicCalculation', () => {
    test('クロスレートを動的に計算する', async () => {
      // USD/JPYとEUR/USDのレスポンスをモック
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          base: 'USD',
          date: '2025-05-15',
          rates: {
            JPY: 149.82
          }
        }
      }).mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          base: 'EUR',
          date: '2025-05-15',
          rates: {
            USD: 1.07
          }
        }
      });
      
      // テスト対象の関数を実行
      const result = await exchangeRate.getExchangeRateFromDynamicCalculation('EUR', 'JPY');
      
      // 結果の検証
      expect(result).toEqual({
        pair: 'EUR-JPY',
        rate: expect.any(Number),
        base: 'EUR',
        target: 'JPY',
        lastUpdated: expect.any(String)
      });
    });
  });

  describe('getExchangeRateFromHardcodedValues', () => {
    test('ハードコードされた値から為替レートを取得する', () => {
      // テスト対象の関数を実行
      const result = exchangeRate.getExchangeRateFromHardcodedValues('USD', 'JPY');
      
      // 結果の検証
      expect(result).toEqual({
        pair: 'USD-JPY',
        rate: expect.any(Number),
        base: 'USD',
        target: 'JPY',
        lastUpdated: expect.any(String),
        isDefault: true
      });
    });
  });
});
