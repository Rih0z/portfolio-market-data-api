/**
 * ファイルパス: __tests__/unit/function/marketData.test.js
 * 
 * マーケットデータAPIハンドラーのユニットテスト
 * 株価・為替・投資信託データの取得機能をテスト
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-15
 */

const { handler } = require('../../../src/function/marketData');
const marketDataService = require('../../../src/services/marketDataService');
const cacheService = require('../../../src/services/cacheService');
const responseUtils = require('../../../src/utils/responseUtils');
const { mockExternalApis } = require('../../testUtils/apiMocks');

// モジュールのモック化
jest.mock('../../../src/services/marketDataService');
jest.mock('../../../src/services/cacheService');
jest.mock('../../../src/utils/responseUtils');

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
    marketDataService.getUSStockData.mockResolvedValue({
      [TEST_DATA.usStock.symbol]: TEST_DATA.usStock
    });
    
    marketDataService.getJPStockData.mockResolvedValue({
      [TEST_DATA.jpStock.symbol]: TEST_DATA.jpStock
    });
    
    marketDataService.getExchangeRateData.mockResolvedValue({
      [TEST_DATA.exchangeRate.pair]: TEST_DATA.exchangeRate
    });
    
    marketDataService.getMutualFundData.mockResolvedValue({
      [TEST_DATA.mutualFund.symbol]: TEST_DATA.mutualFund
    });
    
    // キャッシュサービスのモック
    cacheService.get.mockResolvedValue(null); // デフォルトではキャッシュなし
    cacheService.set.mockResolvedValue(undefined);
    
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
      expect(marketDataService.getUSStockData).toHaveBeenCalledWith(
        TEST_DATA.usStock.symbol
      );
      
      // キャッシュ確認が行われたか検証
      expect(cacheService.get).toHaveBeenCalledWith(
        expect.stringContaining('us-stock')
      );
      
      // 結果がキャッシュに保存されたか検証
      expect(cacheService.set).toHaveBeenCalled();
      
      // レスポンスが正しく形式化されたか検証
      expect(responseUtils.formatResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            [TEST_DATA.usStock.symbol]: TEST_DATA.usStock
          }
        })
      );
      
      // 最終的なレスポンスを検証
      expect(response.statusCode).toBe(200);
    });
    
    test('複数の米国株データを取得する', async () => {
      // 複数の株式データをモック
      marketDataService.getUSStockData.mockResolvedValue({
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
      expect(marketDataService.getUSStockData).toHaveBeenCalledWith(
        'AAPL,MSFT'
      );
      
      // レスポンス検証
      expect(responseUtils.formatResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            'AAPL': expect.any(Object),
            'MSFT': expect.any(Object)
          })
        })
      );
      
      expect(response.statusCode).toBe(200);
    });
    
    test('キャッシュから米国株データを取得する', async () => {
      // キャッシュにデータが存在する場合をモック
      cacheService.get.mockResolvedValue({
        data: {
          [TEST_DATA.usStock.symbol]: TEST_DATA.usStock
        },
        ttl: 300 // 5分有効
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
      const response = await handler(event);
      
      // キャッシュが確認されたか検証
      expect(cacheService.get).toHaveBeenCalledWith(
        expect.stringContaining('us-stock')
      );
      
      // キャッシュヒットの場合、マーケットデータサービスは呼ばれないはず
      expect(marketDataService.getUSStockData).not.toHaveBeenCalled();
      
      // レスポンスが正しく形式化されたか検証
      expect(responseUtils.formatResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            [TEST_DATA.usStock.symbol]: TEST_DATA.usStock
          },
          source: 'cache'
        })
      );
      
      // 最終的なレスポンスを検証
      expect(response.statusCode).toBe(200);
    });
    
    test('強制更新（refresh=true）の場合はキャッシュを無視する', async () => {
      // キャッシュにデータが存在する場合をモック
      cacheService.get.mockResolvedValue({
        data: {
          [TEST_DATA.usStock.symbol]: {
            ...TEST_DATA.usStock,
            price: 170.0 // 古い価格
          }
        },
        ttl: 300
      });
      
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
      
      // refresh=trueでも一応キャッシュ確認は行われる
      expect(cacheService.get).toHaveBeenCalled();
      
      // refreshが指定されているので、マーケットデータサービスが呼ばれるはず
      expect(marketDataService.getUSStockData).toHaveBeenCalled();
      
      // 取得した新しいデータでキャッシュが更新されたか検証
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('us-stock'),
        expect.objectContaining({
          [TEST_DATA.usStock.symbol]: expect.objectContaining({
            price: 180.95 // 新しい価格
          })
        }),
        expect.any(Number)
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
      expect(marketDataService.getJPStockData).toHaveBeenCalledWith(
        TEST_DATA.jpStock.symbol
      );
      
      // キャッシュが確認されたか検証
      expect(cacheService.get).toHaveBeenCalledWith(
        expect.stringContaining('jp-stock')
      );
      
      // 結果がキャッシュに保存されたか検証
      expect(cacheService.set).toHaveBeenCalled();
      
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
      expect(marketDataService.getExchangeRateData).toHaveBeenCalledWith(
        TEST_DATA.exchangeRate.pair,
        'USD',
        'JPY'
      );
      
      // キャッシュが確認されたか検証
      expect(cacheService.get).toHaveBeenCalledWith(
        expect.stringContaining('exchange-rate')
      );
      
      // 結果がキャッシュに保存されたか検証
      expect(cacheService.set).toHaveBeenCalled();
      
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
      expect(marketDataService.getMutualFundData).toHaveBeenCalledWith(
        TEST_DATA.mutualFund.symbol
      );
      
      // キャッシュが確認されたか検証
      expect(cacheService.get).toHaveBeenCalledWith(
        expect.stringContaining('mutual-fund')
      );
      
      // 結果がキャッシュに保存されたか検証
      expect(cacheService.set).toHaveBeenCalled();
      
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
          code: 'INVALID_PARAMS',
          message: expect.stringContaining('Invalid market data type')
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
          code: 'INVALID_PARAMS',
          message: expect.stringContaining('symbols')
        })
      );
    });
    
    test('データ取得でエラーが発生した場合は適切に処理する', async () => {
      // データ取得時のエラーをモック
      marketDataService.getUSStockData.mockRejectedValue(
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
          code: 'DATA_FETCH_ERROR',
          message: expect.stringContaining('Failed to fetch market data')
        })
      );
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
      
      // エラーレスポンスが形式化されたか検証
      expect(responseUtils.formatErrorResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 405,
          code: 'METHOD_NOT_ALLOWED',
          message: 'Method not allowed'
        })
      );
    });
  });
});
