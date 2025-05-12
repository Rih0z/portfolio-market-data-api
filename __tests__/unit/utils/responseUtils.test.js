/**
 * responseUtils.js のユニットテスト
 * 
 * @file __tests__/unit/utils/responseUtils.test.js
 * @author Portfolio Manager Team
 * @created 2025-05-18
 */

const { formatResponse, formatErrorResponse, formatRedirectResponse, formatOptionsResponse, handleOptions } = require('../../../src/utils/responseUtils');
const { getBudgetWarningMessage, addBudgetWarningToResponse } = require('../../../src/utils/budgetCheck');

// budgetCheck モジュールをモック化
jest.mock('../../../src/utils/budgetCheck', () => ({
  getBudgetWarningMessage: jest.fn(),
  addBudgetWarningToResponse: jest.fn(response => response),
  isBudgetCritical: jest.fn().mockResolvedValue(false)
}));

describe('responseUtils', () => {
  // 環境変数のモック
  const originalEnv = process.env;
  
  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv };
    process.env.CORS_ALLOW_ORIGIN = '*';
    process.env.NODE_ENV = 'test';
  });
  
  afterAll(() => {
    process.env = originalEnv;
  });

  describe('formatResponse', () => {
    test('デフォルトパラメータでの正常レスポンス', async () => {
      // addBudgetWarningToResponse が呼ばれるように設定
      addBudgetWarningToResponse.mockImplementation(response => response);
      
      // テスト実行
      const response = await formatResponse({
        data: { message: 'Success' }
      });

      // 検証
      expect(response.statusCode).toBe(200);
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Access-Control-Allow-Credentials']).toBe('true');
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Success');
      
      // 予算警告が追加されたか確認
      expect(addBudgetWarningToResponse).toHaveBeenCalledWith(expect.any(Object));
    });

    test('カスタムステータスコードとヘッダーでの正常レスポンス', async () => {
      // テスト実行
      const response = await formatResponse({
        statusCode: 201,
        headers: { 'Custom-Header': 'Value' },
        data: { id: '123' },
        source: 'Test Source',
        lastUpdated: '2025-05-18T10:00:00Z',
        processingTime: '50ms'
      });

      // 検証
      expect(response.statusCode).toBe(201);
      expect(response.headers['Custom-Header']).toBe('Value');
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('123');
      expect(body.source).toBe('Test Source');
      expect(body.lastUpdated).toBe('2025-05-18T10:00:00Z');
      expect(body.processingTime).toBe('50ms');
    });
    
    test('予算警告スキップオプション', async () => {
      // テスト実行
      await formatResponse({
        data: { message: 'No Budget Warning' },
        skipBudgetWarning: true
      });

      // 予算警告が追加されていないことを確認
      expect(addBudgetWarningToResponse).not.toHaveBeenCalled();
    });
  });

  describe('formatErrorResponse', () => {
    test('デフォルトパラメータでのエラーレスポンス', async () => {
      // テスト実行
      const response = await formatErrorResponse({
        message: 'Error occurred'
      });

      // 検証
      expect(response.statusCode).toBe(500);
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Error occurred');
      expect(body.error.code).toBe('SERVER_ERROR');
      expect(body.error.details).toBeUndefined();
    });

    test('詳細エラー情報を含むエラーレスポンス（開発環境用）', async () => {
      // 開発環境設定
      process.env.NODE_ENV = 'development';
      
      // テスト実行
      const response = await formatErrorResponse({
        statusCode: 400,
        code: 'INVALID_PARAMS',
        message: 'Invalid parameters',
        details: 'Missing required field'
      });

      // 検証
      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_PARAMS');
      expect(body.error.message).toBe('Invalid parameters');
      expect(body.error.details).toBe('Missing required field');
    });
    
    test('使用量情報を含むエラーレスポンス', async () => {
      // テスト実行
      const response = await formatErrorResponse({
        statusCode: 429,
        code: 'LIMIT_EXCEEDED',
        message: 'API usage limit exceeded',
        usage: {
          daily: { count: 5000, limit: 5000 },
          monthly: { count: 50000, limit: 100000 }
        }
      });

      // 検証
      expect(response.statusCode).toBe(429);
      
      const body = JSON.parse(response.body);
      expect(body.usage.daily.count).toBe(5000);
      expect(body.usage.monthly.limit).toBe(100000);
    });
  });

  describe('formatRedirectResponse', () => {
    test('デフォルトの一時的リダイレクト', () => {
      // テスト実行
      const response = formatRedirectResponse('https://example.com/redirect');

      // 検証
      expect(response.statusCode).toBe(302);
      expect(response.headers.Location).toBe('https://example.com/redirect');
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.body).toBe('');
    });

    test('恒久的リダイレクト', () => {
      // テスト実行
      const response = formatRedirectResponse('https://example.com/permanent', 301);

      // 検証
      expect(response.statusCode).toBe(301);
      expect(response.headers.Location).toBe('https://example.com/permanent');
    });
  });

  describe('formatOptionsResponse', () => {
    test('デフォルトのOPTIONSレスポンス', () => {
      // テスト実行
      const response = formatOptionsResponse();

      // 検証
      expect(response.statusCode).toBe(204);
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Access-Control-Allow-Headers']).toContain('Content-Type');
      expect(response.headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(response.body).toBe('');
    });

    test('カスタムヘッダー付きのOPTIONSレスポンス', () => {
      // テスト実行
      const response = formatOptionsResponse({
        'Custom-Header': 'Value'
      });

      // 検証
      expect(response.statusCode).toBe(204);
      expect(response.headers['Custom-Header']).toBe('Value');
    });
  });

  describe('handleOptions', () => {
    test('OPTIONSメソッドの処理', () => {
      // テスト実行
      const response = handleOptions({
        httpMethod: 'OPTIONS'
      });

      // 検証
      expect(response).not.toBeNull();
      expect(response.statusCode).toBe(204);
    });

    test('OPTIONSメソッド以外の処理', () => {
      // テスト実行
      const response = handleOptions({
        httpMethod: 'GET'
      });

      // 検証
      expect(response).toBeNull();
    });
  });
});
