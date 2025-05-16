// __tests__/unit/function/marketData.test.js
const { handler } = require('../../../src/function/marketData');

// Fix: Properly mock all dependencies
jest.mock('../../../src/services/usage', () => ({
  checkAndUpdateUsage: jest.fn()
}));

jest.mock('../../../src/services/sources/enhancedMarketDataService', () => ({
  getUsStockData: jest.fn(),
  getUsStocksData: jest.fn(),
  getJpStockData: jest.fn(),
  getMutualFundData: jest.fn(),
  getExchangeRateData: jest.fn()
}));

jest.mock('../../../src/utils/responseUtils', () => ({
  formatSuccessResponse: jest.fn(),
  formatErrorResponse: jest.fn()
}));

// Import mocked modules
const usageService = require('../../../src/services/usage');
const marketDataService = require('../../../src/services/sources/enhancedMarketDataService');
const responseUtils = require('../../../src/utils/responseUtils');

describe('Market Data API Handler', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Fix: Setup default mock implementations with jest.fn()
    usageService.checkAndUpdateUsage.mockResolvedValue({
      allowed: true,
      usage: {
        daily: { count: 1, limit: 100 },
        monthly: { count: 10, limit: 1000 }
      }
    });

    // Mock success responses for each data type
    marketDataService.getUsStockData.mockResolvedValue({
      AAPL: { ticker: 'AAPL', price: 180.95, name: 'Apple Inc.' }
    });
    
    marketDataService.getUsStocksData.mockResolvedValue({
      AAPL: { ticker: 'AAPL', price: 180.95 },
      MSFT: { ticker: 'MSFT', price: 420.30 }
    });
    
    marketDataService.getJpStockData.mockResolvedValue({
      '7203': { ticker: '7203', price: 2500, name: 'Toyota Motor' }
    });
    
    marketDataService.getMutualFundData.mockResolvedValue({
      '0131103C': { ticker: '0131103C', price: 12345 }
    });
    
    marketDataService.getExchangeRateData.mockResolvedValue({
      'USD-JPY': { pair: 'USD-JPY', rate: 149.82, base: 'USD', target: 'JPY' }
    });
    
    responseUtils.formatSuccessResponse.mockImplementation((data) => ({
      statusCode: 200,
      body: JSON.stringify({ success: true, data })
    }));
    
    responseUtils.formatErrorResponse.mockImplementation(({ statusCode, errorCode, message }) => ({
      statusCode,
      body: JSON.stringify({ 
        success: false, 
        error: { code: errorCode, message } 
      })
    }));
  });

  describe('米国株データ取得', () => {
    test('正常に米国株データを取得する', async () => {
      // テストイベントとコンテキスト
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'us-stock',
          symbols: 'AAPL'
        }
      };
      const context = {};

      // ハンドラーを実行
      const result = await handler(event, context);

      // 使用量チェックが呼ばれたことを確認
      expect(usageService.checkAndUpdateUsage).toHaveBeenCalled();
      
      // 正しいサービスメソッドが呼ばれたことを確認
      expect(marketDataService.getUsStockData).toHaveBeenCalledWith('AAPL', false);
      
      // レスポンスが正しい形式であることを確認
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).success).toBe(true);
    });

    test('複数の米国株データを取得する', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'us-stock',
          symbols: 'AAPL,MSFT'
        }
      };
      const context = {};

      const result = await handler(event, context);

      expect(marketDataService.getUsStocksData).toHaveBeenCalledWith(['AAPL', 'MSFT'], false);
      expect(result.statusCode).toBe(200);
    });

    test('強制更新（refresh=true）の場合はキャッシュを無視する', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'us-stock',
          symbols: 'AAPL',
          refresh: 'true'
        }
      };
      const context = {};

      const result = await handler(event, context);

      expect(marketDataService.getUsStockData).toHaveBeenCalledWith('AAPL', true);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('日本株データ取得', () => {
    test('正常に日本株データを取得する', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'jp-stock',
          symbols: '7203'
        }
      };
      const context = {};

      const result = await handler(event, context);

      expect(marketDataService.getJpStockData).toHaveBeenCalledWith('7203', false);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('為替レートデータ取得', () => {
    test('正常に為替レートデータを取得する', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'exchange-rate',
          symbols: 'USD-JPY'
        }
      };
      const context = {};

      const result = await handler(event, context);

      expect(marketDataService.getExchangeRateData).toHaveBeenCalledWith('USD-JPY', false);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('投資信託データ取得', () => {
    test('正常に投資信託データを取得する', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'mutual-fund',
          symbols: '0131103C'
        }
      };
      const context = {};

      const result = await handler(event, context);

      expect(marketDataService.getMutualFundData).toHaveBeenCalledWith('0131103C', false);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('エラーハンドリング', () => {
    test('無効なデータタイプを指定した場合はエラーを返す', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'invalid-type',
          symbols: 'AAPL'
        }
      };
      const context = {};

      const result = await handler(event, context);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).success).toBe(false);
      expect(JSON.parse(result.body).error.code).toBe('INVALID_PARAMS');
    });

    test('シンボルが指定されていない場合はエラーを返す', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'us-stock'
          // symbols parameter missing
        }
      };
      const context = {};

      const result = await handler(event, context);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error.code).toBe('MISSING_PARAMS');
    });

    test('データ取得でエラーが発生した場合は適切に処理する', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'us-stock',
          symbols: 'AAPL'
        }
      };
      const context = {};

      // サービスが例外をスローするようにモック
      marketDataService.getUsStockData.mockRejectedValue(new Error('API error'));

      const result = await handler(event, context);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    test('HTTPメソッドがGET以外の場合はエラーを返す', async () => {
      const event = {
        httpMethod: 'POST',
        queryStringParameters: {
          type: 'us-stock',
          symbols: 'AAPL'
        }
      };
      const context = {};

      const result = await handler(event, context);

      expect(result.statusCode).toBe(405);
      expect(JSON.parse(result.body).error.code).toBe('METHOD_NOT_ALLOWED');
    });

    test('OPTIONSリクエストに対してCORSヘッダーを返す', async () => {
      const event = {
        httpMethod: 'OPTIONS'
      };
      const context = {};

      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers['Access-Control-Allow-Origin']).toBeTruthy();
    });
  });

  describe('使用量制限', () => {
    test('使用量制限を超えた場合はエラーを返す', async () => {
      // 使用量制限を超えたことを示すレスポンスを設定
      usageService.checkAndUpdateUsage.mockResolvedValue({
        allowed: false,
        usage: {
          daily: { count: 101, limit: 100 },
          monthly: { count: 1001, limit: 1000 }
        }
      });

      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'us-stock',
          symbols: 'AAPL'
        }
      };
      const context = {};

      const result = await handler(event, context);

      expect(result.statusCode).toBe(429);
      expect(JSON.parse(result.body).error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
});
