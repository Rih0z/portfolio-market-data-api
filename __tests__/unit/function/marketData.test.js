/**
 * ファイルパス: __tests__/unit/function/marketData.test.js
 * 
 * マーケットデータAPIハンドラーのユニットテスト
 * 株価・為替・投資信託データの取得機能をテスト
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-15
 * @updated 2025-05-15 バグ修正: 正しいサービスインポートパスに修正
 */

const { handler } = require('../../../src/function/marketData');
const enhancedMarketDataService = require('../../../src/services/sources/enhancedMarketDataService');
const cacheService = require('../../../src/services/cache');
const fallbackDataStore = require('../../../src/services/fallbackDataStore');
const usageService = require('../../../src/services/usage');
const alertService = require('../../../src/services/alerts');
const responseUtils = require('../../../src/utils/responseUtils');
const { mockExternalApis } = require('../../testUtils/apiMocks');

// モジュールのモック化
jest.mock('../../../src/services/sources/enhancedMarketDataService');
jest.mock('../../../src/services/cache');
jest.mock('../../../src/services/fallbackDataStore');
jest.mock('../../../src/services/usage');
jest.mock('../../../src/services/alerts');
jest.mock('../../../src/utils/responseUtils');
jest.mock('../../../src/utils/budgetCheck', () => ({
  isBudgetCritical: jest.fn().mockResolvedValue(false),
  getBudgetWarningMessage: jest.fn().mockResolvedValue(null)
}));

// テスト用データ
const TEST_DATA = {
  usStock: {
    symbol: 'AAPL',
    price: 180.95,
    change: 2.5,
    changePercent: 1.4,
    currency: 'USD'
  },
  jpStock: {
    symbol: '7203',
    price: 2500,
    change: 50,
    changePercent: 2.0,
    currency: 'JPY'
  },
  exchangeRate: {
    pair: 'USD-JPY',
    rate: 149.82,
    change: 0.32,
    changePercent: 0.21,
    base: 'USD',
    target: 'JPY'
  },
  mutualFund: {
    symbol: '0131103C',
    price: 12500,
    change: 25,
    changePercent: 0.2,
    currency: 'JPY',
    isMutualFund: true
  }
};

describe('Market Data API Handler', () => {
  // 各テスト前の準備
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // モック実装を設定
    enhancedMarketDataService.getUsStocksData.mockResolvedValue({
      [TEST_DATA.usStock.symbol]: TEST_DATA.usStock
    });
    
    enhancedMarketDataService.getJpStocksData.mockResolvedValue({
      [TEST_DATA.jpStock.symbol]: TEST_DATA.jpStock
    });
    
    enhancedMarketDataService.getExchangeRateData.mockResolvedValue({
      pair: TEST_DATA.exchangeRate.pair,
      rate: TEST_DATA.exchangeRate.rate,
      change: TEST_DATA.exchangeRate.change,
      changePercent: TEST_DATA.exchangeRate.changePercent,
      base: TEST_DATA.exchangeRate.base,
      target: TEST_DATA.exchangeRate.target,
      lastUpdated: new Date().toISOString()
    });
    
    enhancedMarketDataService.getMutualFundsData.mockResolvedValue({
      [TEST_DATA.mutualFund.symbol]: TEST_DATA.mutualFund
    });
    
    // キャッシュサービスのモック
    cacheService.get.mockResolvedValue(null); // デフォルトではキャッシュなし
    cacheService.set.mockResolvedValue(undefined);
    
    // 使用量サービスのモック
    usageService.checkAndUpdateUsage.mockResolvedValue({
      allowed: true,
      usage: {
        daily: { count: 1, limit: 100 },
        monthly: { count: 10, limit: 1000 }
      }
    });
    
    // フォールバックデータストアのモック
    fallbackDataStore.recordFailedFetch.mockResolvedValue(undefined);
    fallbackDataStore.getFallbackForSymbol.mockResolvedValue(null);
    
    // アラートサービスのモック
    alertService.notifyError.mockResolvedValue(undefined);
    
    // レスポンス形式化のモック
    responseUtils.formatResponse.mockResolvedValue({
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: {}
      })
    });
    
    responseUtils.formatErrorResponse.mockResolvedValue({
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: {
          message: 'Error'
        }
      })
    });
    
    responseUtils.formatOptionsResponse.mockReturnValue({
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    });
  });

  describe('米国株データ取得', () => {
    test('正常に米国株データを取得する', async () => {
      // テスト用のイベントを作成
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'us-stock',
          symbols: TEST_DATA.usStock.symbol
        }
      };
      
      // ハンドラー関数を実行
      const response = await handler(event);
      
      // マーケットデータサービスが正しく呼び出されたか検証
      expect(enhancedMarketDataService.getUsStocksData).toHaveBeenCalledWith(
        [TEST_DATA.usStock.symbol],
        false
      );
      
      // 使用量チェックが行われたか検証
      expect(usageService.checkAndUpdateUsage).toHaveBeenCalled();
      
      // レスポンスが正しく形式化されたか検証
      expect(responseUtils.formatResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(Object),
          usage: expect.any(Object)
        })
      );
      
      // 最終的なレスポンスを検証
      expect(response.statusCode).toBe(200);
    });
    
    test('複数の米国株データを取得する', async () => {
      // 複数の株式データをモック
      enhancedMarketDataService.getUsStocksData.mockResolvedValue({
        'AAPL': TEST_DATA.usStock,
        'MSFT': {
          symbol: 'MSFT',
          price: 310.5,
          change: 5.2,
          changePercent: 1.7,
          currency: 'USD'
        }
      });
      
      // テスト用のイベントを作成
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'us-stock',
          symbols: 'AAPL,MSFT'
        }
      };
      
      // ハンドラー関数を実行
      const response = await handler(event);
      
      // マーケットデータサービスが正しく呼び出されたか検証
      expect(enhancedMarketDataService.getUsStocksData).toHaveBeenCalledWith(
        ['AAPL', 'MSFT'],
        false
      );
      
      // レスポンス検証
      expect(responseUtils.formatResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(Object)
        })
      );
      
      expect(response.statusCode).toBe(200);
    });
    
    test('強制更新（refresh=true）の場合はキャッシュを無視する', async () => {
      // テスト用のイベントを作成（refresh=trueパラメータ付き）
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'us-stock',
          symbols: TEST_DATA.usStock.symbol,
          refresh: 'true'
        }
      };
      
      // ハンドラー関数を実行
      const response = await handler(event);
      
      // refresh=trueで呼び出されたか検証
      expect(enhancedMarketDataService.getUsStocksData).toHaveBeenCalledWith(
        [TEST_DATA.usStock.symbol],
        true
      );
      
      // 最終的なレスポンスを検証
      expect(response.statusCode).toBe(200);
    });
  });

  describe('日本株データ取得', () => {
    test('正常に日本株データを取得する', async () => {
      // テスト用のイベントを作成
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'jp-stock',
          symbols: TEST_DATA.jpStock.symbol
        }
      };
      
      // ハンドラー関数を実行
      const response = await handler(event);
      
      // マーケットデータサービスが正しく呼び出されたか検証
      expect(enhancedMarketDataService.getJpStocksData).toHaveBeenCalledWith(
        [TEST_DATA.jpStock.symbol],
        false
      );
      
      // 最終的なレスポンスを検証
      expect(response.statusCode).toBe(200);
    });
  });

  describe('為替レートデータ取得', () => {
    test('正常に為替レートデータを取得する', async () => {
      // テスト用のイベントを作成
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'exchange-rate',
          symbols: TEST_DATA.exchangeRate.pair,
          base: 'USD',
          target: 'JPY'
        }
      };
      
      // ハンドラー関数を実行
      const response = await handler(event);
      
      // マーケットデータサービスが正しく呼び出されたか検証
      expect(enhancedMarketDataService.getExchangeRateData).toHaveBeenCalledWith(
        'USD',
        'JPY',
        false
      );
      
      // 最終的なレスポンスを検証
      expect(response.statusCode).toBe(200);
    });
  });

  describe('投資信託データ取得', () => {
    test('正常に投資信託データを取得する', async () => {
      // テスト用のイベントを作成
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'mutual-fund',
          symbols: TEST_DATA.mutualFund.symbol
        }
      };
      
      // ハンドラー関数を実行
      const response = await handler(event);
      
      // マーケットデータサービスが正しく呼び出されたか検証
      expect(enhancedMarketDataService.getMutualFundsData).toHaveBeenCalledWith(
        [TEST_DATA.mutualFund.symbol],
        false
      );
      
      // 最終的なレスポンスを検証
      expect(response.statusCode).toBe(200);
    });
  });

  describe('エラーハンドリング', () => {
    test('無効なデータタイプを指定した場合はエラーを返す', async () => {
      // テスト用のイベントを作成（無効なtype）
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'invalid-type',
          symbols: TEST_DATA.usStock.symbol
        }
      };
      
      // ハンドラー関数を実行
      await handler(event);
      
      // エラーレスポンスが形式化されたか検証
      expect(responseUtils.formatErrorResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          code: expect.any(String),
          message: expect.stringContaining('Invalid')
        })
      );
    });
    
    test('シンボルが指定されていない場合はエラーを返す', async () => {
      // テスト用のイベントを作成（symbolsなし）
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'us-stock'
        }
      };
      
      // ハンドラー関数を実行
      await handler(event);
      
      // エラーレスポンスが形式化されたか検証
      expect(responseUtils.formatErrorResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          code: expect.any(String),
          message: expect.stringContaining('symbols')
        })
      );
    });
    
    test('データ取得でエラーが発生した場合は適切に処理する', async () => {
      // データ取得時のエラーをモック
      enhancedMarketDataService.getUsStocksData.mockRejectedValue(
        new Error('Failed to fetch stock data')
      );
      
      // テスト用のイベントを作成
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'us-stock',
          symbols: TEST_DATA.usStock.symbol
        }
      };
      
      // ハンドラー関数を実行
      await handler(event);
      
      // エラーレスポンスが形式化されたか検証
      expect(responseUtils.formatErrorResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          code: expect.any(String),
          message: expect.stringContaining('error occurred')
        })
      );
      
      // アラート通知が呼び出されたか検証
      expect(alertService.notifyError).toHaveBeenCalled();
    });
    
    test('HTTPメソッドがGET以外の場合はエラーを返す', async () => {
      // テスト用のイベントを作成（POSTメソッド）
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          type: 'us-stock',
          symbols: TEST_DATA.usStock.symbol
        })
      };
      
      // ハンドラー関数を実行
      await handler(event);
      
      // OPTIONSレスポンスが形式化されたか検証
      expect(responseUtils.formatOptionsResponse).toHaveBeenCalled();
    });
    
    test('OPTIONSリクエストに対してCORSヘッダーを返す', async () => {
      // テスト用のイベントを作成（OPTIONSメソッド）
      const event = {
        httpMethod: 'OPTIONS'
      };
      
      // ハンドラー関数を実行
      await handler(event);
      
      // OPTIONSレスポンスが形式化されたか検証
      expect(responseUtils.formatOptionsResponse).toHaveBeenCalled();
    });
  });
  
  describe('使用量制限', () => {
    test('使用量制限を超えた場合はエラーを返す', async () => {
      // 使用量制限超過をモック
      usageService.checkAndUpdateUsage.mockResolvedValue({
        allowed: false,
        usage: {
          daily: { count: 100, limit: 100 },
          monthly: { count: 500, limit: 1000 }
        }
      });
      
      // テスト用のイベントを作成
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'us-stock',
          symbols: TEST_DATA.usStock.symbol
        }
      };
      
      // ハンドラー関数を実行
      await handler(event);
      
      // エラーレスポンスが形式化されたか検証
      expect(responseUtils.formatErrorResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 429,
          code: expect.any(String),
          message: expect.stringContaining('limit exceeded'),
          usage: expect.any(Object)
        })
      );
    });
  });
});
