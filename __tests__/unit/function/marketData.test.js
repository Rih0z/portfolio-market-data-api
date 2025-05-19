/**
 * ファイルパス: __tests__/unit/function/marketData.test.js
 * 
 * マーケットデータAPIのユニットテスト
 * API Gatewayからのリクエストを受け取り、様々なデータソースから
 * 株式・投資信託・為替レートのデータを取得する処理をテストします。
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-18
 */

// テスト対象モジュールのインポート
const { handler, combinedDataHandler, highLatencyHandler } = require('../../../src/function/marketData');

// 依存モジュールのインポート
const enhancedMarketDataService = require('../../../src/services/sources/enhancedMarketDataService');
const fallbackDataStore = require('../../../src/services/fallbackDataStore');
const cacheService = require('../../../src/services/cache');
const usageService = require('../../../src/services/usage');
const alertService = require('../../../src/services/alerts');
const { DATA_TYPES, ERROR_CODES } = require('../../../src/config/constants');
const budgetCheck = require('../../../src/utils/budgetCheck');
const responseUtils = require('../../../src/utils/responseUtils');
const errorHandler = require('../../../src/utils/errorHandler');
const logger = require('../../../src/utils/logger');

// モジュールのモック化
jest.mock('../../../src/services/sources/enhancedMarketDataService');
jest.mock('../../../src/services/fallbackDataStore');
jest.mock('../../../src/services/cache');
jest.mock('../../../src/services/usage');
jest.mock('../../../src/services/alerts');
jest.mock('../../../src/utils/budgetCheck');
jest.mock('../../../src/utils/responseUtils');
jest.mock('../../../src/utils/errorHandler');
jest.mock('../../../src/utils/logger');

describe('Market Data API Handler', () => {
  // テスト用データ
  const mockUsStockData = {
    'AAPL': {
      ticker: 'AAPL',
      price: 180.95,
      change: 2.3,
      changePercent: 1.2,
      name: 'Apple Inc.',
      currency: 'USD',
      isStock: true,
      isMutualFund: false,
      source: 'Test Data',
      lastUpdated: '2025-05-18T12:00:00.000Z'
    }
  };

  const mockJpStockData = {
    '7203': {
      ticker: '7203',
      price: 2500,
      change: 50,
      changePercent: 2.0,
      name: 'トヨタ自動車',
      currency: 'JPY',
      isStock: true,
      isMutualFund: false,
      source: 'Test Data',
      lastUpdated: '2025-05-18T12:00:00.000Z'
    }
  };

  const mockExchangeRateData = {
    'USD-JPY': {
      pair: 'USD-JPY',
      base: 'USD',
      target: 'JPY',
      rate: 149.82,
      change: 0.32,
      changePercent: 0.21,
      lastUpdated: '2025-05-18T12:00:00.000Z',
      source: 'Test Data'
    }
  };

  const mockMutualFundData = {
    '0131103C': {
      ticker: '0131103C',
      price: 12345,
      change: 25,
      changePercent: 0.2,
      name: '投資信託 0131103C',
      currency: 'JPY',
      isStock: false,
      isMutualFund: true,
      priceLabel: '基準価額',
      source: 'Test Data',
      lastUpdated: '2025-05-18T12:00:00.000Z'
    }
  };

  const mockUsageData = {
    daily: {
      count: 100,
      limit: 5000,
      percentage: 2
    },
    monthly: {
      count: 2000,
      limit: 100000,
      percentage: 2
    }
  };

  // 各テスト前の準備
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // モックの実装を設定
    enhancedMarketDataService.getUsStocksData.mockResolvedValue(mockUsStockData);
    enhancedMarketDataService.getJpStocksData.mockResolvedValue(mockJpStockData);
    enhancedMarketDataService.getExchangeRateData.mockResolvedValue(mockExchangeRateData['USD-JPY']);
    enhancedMarketDataService.getMutualFundsData.mockResolvedValue(mockMutualFundData);
    
    usageService.checkAndUpdateUsage.mockResolvedValue({
      allowed: true,
      usage: mockUsageData
    });
    
    budgetCheck.isBudgetCritical.mockResolvedValue(false);
    budgetCheck.getBudgetWarningMessage.mockResolvedValue(null);
    budgetCheck.addBudgetWarningToResponse.mockImplementation(response => response);
    
    responseUtils.formatResponse.mockImplementation(options => ({
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        success: true,
        data: options.data,
        source: options.source,
        lastUpdated: options.lastUpdated,
        processingTime: options.processingTime,
        usage: options.usage
      })
    }));
    
    responseUtils.formatErrorResponse.mockImplementation(options => ({
      statusCode: options.statusCode || 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        success: false,
        error: {
          code: options.code,
          message: options.message,
          details: options.details
        },
        usage: options.usage
      })
    }));
    
    responseUtils.formatOptionsResponse.mockReturnValue({
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
      },
      body: ''
    });
  });
  
  describe('Parameter Validation', () => {
    test('未指定のタイプパラメータに対してエラーを返す', async () => {
      // イベントオブジェクトの準備
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          symbols: 'AAPL,MSFT'
        }
      };
      
      // ハンドラーの実行
      await handler(event);
      
      // 検証
      expect(responseUtils.formatErrorResponse).toHaveBeenCalledWith({
        statusCode: 400,
        code: ERROR_CODES.INVALID_PARAMS,
        message: expect.stringContaining('Missing required parameter: type'),
        success: false
      });
    });
    
    test('無効なタイプパラメータに対してエラーを返す', async () => {
      // イベントオブジェクトの準備
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'invalid-type',
          symbols: 'AAPL,MSFT'
        }
      };
      
      // ハンドラーの実行
      await handler(event);
      
      // 検証
      expect(responseUtils.formatErrorResponse).toHaveBeenCalledWith({
        statusCode: 400,
        code: ERROR_CODES.INVALID_PARAMS,
        message: expect.stringContaining('Invalid type: invalid-type'),
        success: false
      });
    });
    
    test('シンボルが指定されていない場合（為替レート以外）はエラーを返す', async () => {
      // イベントオブジェクトの準備
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: DATA_TYPES.US_STOCK
        }
      };
      
      // ハンドラーの実行
      await handler(event);
      
      // 検証
      expect(responseUtils.formatErrorResponse).toHaveBeenCalledWith({
        statusCode: 400,
        code: ERROR_CODES.INVALID_PARAMS,
        message: expect.stringContaining('Missing required parameter: symbols'),
        success: false
      });
    });
    
    test('為替レートの場合、ベースまたはターゲット通貨が未指定の場合はエラーを返す', async () => {
      // イベントオブジェクトの準備
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: DATA_TYPES.EXCHANGE_RATE
        }
      };
      
      // ハンドラーの実行
      await handler(event);
      
      // 検証
      expect(responseUtils.formatErrorResponse).toHaveBeenCalledWith({
        statusCode: 400,
        code: ERROR_CODES.INVALID_PARAMS,
        message: expect.stringContaining('Missing required parameter for exchange rate'),
        success: false
      });
    });
  });
  
  describe('Rate Limiting', () => {
    test('APIの使用制限を超えた場合はレート制限エラーを返す', async () => {
      // 使用制限を超えた状態をモック
      usageService.checkAndUpdateUsage.mockResolvedValue({
        allowed: false,
        usage: mockUsageData
      });
      
      // イベントオブジェクトの準備
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: DATA_TYPES.US_STOCK,
          symbols: 'AAPL,MSFT'
        }
      };
      
      // ハンドラーの実行
      await handler(event);
      
      // 検証
      expect(responseUtils.formatErrorResponse).toHaveBeenCalledWith({
        statusCode: 429,
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: expect.stringContaining('API usage limit exceeded'),
        usage: mockUsageData,
        retryAfter: 60
      });
    });
    
    test('予算が臨界値に達した状態でリフレッシュリクエストの場合はエラーを返す', async () => {
      // 予算が臨界値に達した状態をモック
      budgetCheck.isBudgetCritical.mockResolvedValue(true);
      budgetCheck.getBudgetWarningMessage.mockResolvedValue('Budget is at critical level');
      
      // イベントオブジェクトの準備
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: DATA_TYPES.US_STOCK,
          symbols: 'AAPL,MSFT',
          refresh: 'true'
        }
      };
      
      // ハンドラーの実行
      await handler(event);
      
      // 検証
      expect(responseUtils.formatErrorResponse).toHaveBeenCalledWith({
        statusCode: 403,
        code: ERROR_CODES.BUDGET_LIMIT_EXCEEDED,
        message: expect.stringContaining('Budget'),
        headers: { 'X-Budget-Warning': 'CRITICAL' },
        details: { budgetCritical: true },
        usage: expect.any(Object)
      });
    });
  });
  
  describe('Data Type Handling', () => {
    test('米国株データを正常に取得して返す', async () => {
      // イベントオブジェクトの準備
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: DATA_TYPES.US_STOCK,
          symbols: 'AAPL,MSFT'
        }
      };
      
      // ハンドラーの実行
      await handler(event);
      
      // 検証
      expect(enhancedMarketDataService.getUsStocksData).toHaveBeenCalledWith(['AAPL', 'MSFT'], false, true);
      expect(responseUtils.formatResponse).toHaveBeenCalledWith(expect.objectContaining({
        data: mockUsStockData,
        usage: mockUsageData
      }));
    });
    
    test('日本株データを正常に取得して返す', async () => {
      // イベントオブジェクトの準備
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: DATA_TYPES.JP_STOCK,
          symbols: '7203,9984'
        }
      };
      
      // ハンドラーの実行
      await handler(event);
      
      // 検証
      expect(enhancedMarketDataService.getJpStocksData).toHaveBeenCalledWith(['7203', '9984'], false, true);
      expect(responseUtils.formatResponse).toHaveBeenCalledWith(expect.objectContaining({
        data: mockJpStockData,
        usage: mockUsageData
      }));
    });
    
    test('投資信託データを正常に取得して返す', async () => {
      // イベントオブジェクトの準備
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: DATA_TYPES.MUTUAL_FUND,
          symbols: '0131103C,2931113C'
        }
      };
      
      // ハンドラーの実行
      await handler(event);
      
      // 検証
      expect(enhancedMarketDataService.getMutualFundsData).toHaveBeenCalledWith(['0131103C', '2931113C'], false, true);
      expect(responseUtils.formatResponse).toHaveBeenCalledWith(expect.objectContaining({
        data: mockMutualFundData,
        usage: mockUsageData
      }));
    });
    
    test('為替レートデータを正常に取得して返す（ベース/ターゲット指定）', async () => {
      // イベントオブジェクトの準備
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: DATA_TYPES.EXCHANGE_RATE,
          base: 'USD',
          target: 'JPY'
        }
      };
      
      // ハンドラーの実行
      await handler(event);
      
      // 検証
      expect(enhancedMarketDataService.getExchangeRateData).toHaveBeenCalledWith('USD', 'JPY', false, true);
      expect(responseUtils.formatResponse).toHaveBeenCalledWith(expect.objectContaining({
        data: { 'USD-JPY': mockExchangeRateData['USD-JPY'] },
        usage: mockUsageData
      }));
    });
    
    test('為替レートデータを正常に取得して返す（シンボル指定）', async () => {
      // イベントオブジェクトの準備
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: DATA_TYPES.EXCHANGE_RATE,
          symbols: 'USD-JPY,EUR-JPY'
        }
      };
      
      // ハンドラーの実行
      await handler(event);
      
      // 検証
      expect(responseUtils.formatResponse).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.any(Object),
        usage: mockUsageData
      }));
    });
  });
  
  describe('Error Handling', () => {
    test('内部エラーが発生した場合はサーバーエラーを返す', async () => {
      // enhancedMarketDataServiceでエラーが発生するようにモック
      enhancedMarketDataService.getUsStocksData.mockRejectedValue(new Error('Test error'));
      
      // エラーハンドラーのモック
      errorHandler.handleError.mockResolvedValue({
        statusCode: 500,
        code: ERROR_CODES.SERVER_ERROR,
        message: 'An error occurred while processing your request',
        details: 'Test error'
      });
      
      // イベントオブジェクトの準備
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: DATA_TYPES.US_STOCK,
          symbols: 'AAPL,MSFT'
        }
      };
      
      // ハンドラーの実行
      await handler(event);
      
      // 検証
      expect(logger.error).toHaveBeenCalled();
      expect(alertService.notifyError).toHaveBeenCalled();
      expect(responseUtils.formatErrorResponse).toHaveBeenCalledWith({
        statusCode: 500,
        code: ERROR_CODES.SERVER_ERROR,
        message: 'An error occurred while processing your request',
        details: 'Test error',
        requestId: 'req-123-456-789'
      });
    });
  });
  
  describe('OPTIONS Request Handling', () => {
    test('OPTIONSリクエストに対してCORSヘッダーを返す', async () => {
      // イベントオブジェクトの準備
      const event = {
        httpMethod: 'OPTIONS'
      };
      
      // ハンドラーの実行
      await handler(event);
      
      // 検証
      expect(responseUtils.formatOptionsResponse).toHaveBeenCalled();
    });
  });
  
  describe('Combined Data Handler', () => {
    test('複合データを正常に取得して返す', async () => {
      // イベントオブジェクトの準備
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          stocks: {
            us: ['AAPL', 'MSFT'],
            jp: ['7203', '9984']
          },
          rates: ['USD-JPY', 'EUR-JPY'],
          mutualFunds: ['0131103C']
        })
      };
      
      // ハンドラーの実行
      await combinedDataHandler(event);
      
      // 検証
      expect(responseUtils.formatResponse).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          stocks: expect.any(Object),
          rates: expect.any(Object),
          mutualFunds: expect.any(Object)
        }),
        processingTime: '320ms',
        cacheStatus: 'partial-hit'
      }));
    });
    
    test('combinedDataHandlerでエラーが発生した場合はサーバーエラーを返す', async () => {
      // enhancedMarketDataServiceでエラーが発生するようにモック
      enhancedMarketDataService.getUsStocksData.mockRejectedValue(new Error('Test error'));
      
      // イベントオブジェクトの準備
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          stocks: {
            us: ['AAPL', 'MSFT']
          }
        })
      };
      
      // ハンドラーの実行
      await combinedDataHandler(event);
      
      // 検証
      expect(logger.error).toHaveBeenCalled();
      expect(responseUtils.formatErrorResponse).toHaveBeenCalledWith({
        statusCode: 500,
        code: ERROR_CODES.SERVER_ERROR,
        message: 'An error occurred while processing your request',
        details: 'Test error'
      });
    });
  });
  
  describe('High Latency Handler', () => {
    // Jest のタイマーをモック化
    jest.useFakeTimers();
    
    test('高レイテンシーシミュレーション処理を正常に実行して返す', async () => {
      // イベントオブジェクトの準備
      const event = {
        httpMethod: 'GET'
      };
      
      // ハンドラーの実行（非同期処理を開始）
      const promise = highLatencyHandler(event);
      
      // タイマーを進める
      jest.advanceTimersByTime(2500);
      
      // 非同期処理の完了を待つ
      await promise;
      
      // 検証
      expect(responseUtils.formatResponse).toHaveBeenCalledWith(expect.objectContaining({
        message: 'High latency request completed',
        processingTime: '2500ms'
      }));
    });
    
    // タイマーを元に戻す
    afterAll(() => {
      jest.useRealTimers();
    });
  });
});
