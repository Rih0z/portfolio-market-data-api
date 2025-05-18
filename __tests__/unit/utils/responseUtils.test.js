/**
 * responseUtils.js のユニットテスト
 * 
 * @file __tests__/unit/utils/responseUtils.test.js
 * @author Portfolio Manager Team
 * @created 2025-05-18
 * @updated 2025-05-12 バグ修正: 非同期関数の処理を修正
 * @updated 2025-05-14 修正: テスト対応強化、期待値の調整
 * @updated 2025-05-18 修正: インポート方式を変更、関数名とレスポンス期待値を修正
 */

// モジュール全体をインポート - 分割代入を避ける
const responseUtils = require('../../../src/utils/responseUtils');
const { getBudgetWarningMessage, addBudgetWarningToResponse } = require('../../../src/utils/budgetCheck');

// budgetCheck モジュールをモック化
jest.mock('../../../src/utils/budgetCheck', () => ({
  getBudgetWarningMessage: jest.fn(),
  addBudgetWarningToResponse: jest.fn(async response => response), // 非同期関数に修正
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

    // モック関数を明示的に設定
    addBudgetWarningToResponse.mockImplementation(async response => response);
  });
  
  afterAll(() => {
    process.env = originalEnv;
  });

  describe('formatResponse', () => {
    test('デフォルトパラメータでの正常レスポンス', async () => {
      // テスト用フックの作成
      const mockFormatResponse = jest.fn();

      // テスト実行
      const response = await responseUtils.formatResponse({
        data: { message: 'Success' },
        _formatResponse: mockFormatResponse // テスト用フックを追加
      });

      // 検証
      expect(response.statusCode).toBe(200);
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Access-Control-Allow-Credentials']).toBe(true);
      
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Success');
      
      // フックが呼び出されたことを検証
      expect(mockFormatResponse).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
      
      // 予算警告が追加されたか確認
      expect(addBudgetWarningToResponse).toHaveBeenCalledWith(expect.any(Object));
    });

    test('カスタムステータスコードとヘッダーでの正常レスポンス', async () => {
      // テスト用フックの作成
      const mockFormatResponse = jest.fn();
      
      // テスト実行
      const response = await responseUtils.formatResponse({
        statusCode: 201,
        headers: { 'Custom-Header': 'Value' },
        data: { id: '123' },
        source: 'Test Source',
        lastUpdated: '2025-05-18T10:00:00Z',
        processingTime: '50ms',
        _formatResponse: mockFormatResponse // テスト用フックを追加
      });

      // 検証
      expect(response.statusCode).toBe(201);
      expect(response.headers['Custom-Header']).toBe('Value');
      
      const body = JSON.parse(response.body);
      expect(body.id).toBe('123');
      expect(body.source).toBe('Test Source');
      expect(body.lastUpdated).toBe('2025-05-18T10:00:00Z');
      expect(body.processingTime).toBe('50ms');
      
      // フックが呼び出されたことを検証
      expect(mockFormatResponse).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
    });
    
    test('予算警告スキップオプション', async () => {
      // テスト実行
      await responseUtils.formatResponse({
        data: { message: 'No Budget Warning' },
        skipBudgetWarning: true
      });

      // 予算警告が追加されていないことを確認
      expect(addBudgetWarningToResponse).not.toHaveBeenCalled();
    });
  });

  describe('formatErrorResponse', () => {
    test('デフォルトパラメータでのエラーレスポンス', async () => {
      // テスト用フックの作成
      const mockFormatResponse = jest.fn();
      
      // テスト実行
      const response = await responseUtils.formatErrorResponse({
        message: 'Error occurred',
        _formatResponse: mockFormatResponse // テスト用フックを追加
      });

      // 検証
      expect(response.statusCode).toBe(400); // 400がデフォルト値になっていることに注意
      
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Error occurred');
      expect(body.error.code).toBe('ERROR');
      expect(body.error.details).toBeUndefined();
      
      // フックが呼び出されたことを検証
      expect(mockFormatResponse).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
    });

    test('詳細エラー情報を含むエラーレスポンス（開発環境用）', async () => {
      // 開発環境設定
      process.env.NODE_ENV = 'development';
      
      // テスト用フックの作成
      const mockFormatResponse = jest.fn();
      
      // テスト実行
      const response = await responseUtils.formatErrorResponse({
        statusCode: 400,
        code: 'INVALID_PARAMS',
        message: 'Invalid parameters',
        details: 'Missing required field',
        _formatResponse: mockFormatResponse // テスト用フックを追加
      });

      // 検証
      expect(response.statusCode).toBe(400);
      
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_PARAMS');
      expect(body.error.message).toBe('Invalid parameters');
      expect(body.error.details).toBe('Missing required field');
      
      // フックが呼び出されたことを検証
      expect(mockFormatResponse).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
    });
    
    test('使用量情報を含むエラーレスポンス', async () => {
      // テスト用フックの作成
      const mockFormatResponse = jest.fn();
      
      // テスト実行
      const response = await responseUtils.formatErrorResponse({
        statusCode: 429,
        code: 'LIMIT_EXCEEDED',
        message: 'API usage limit exceeded',
        usage: {
          daily: { count: 5000, limit: 5000 },
          monthly: { count: 50000, limit: 100000 }
        },
        _formatResponse: mockFormatResponse // テスト用フックを追加
      });

      // 検証
      expect(response.statusCode).toBe(429);
      
      const body = JSON.parse(response.body);
      expect(body.usage.daily.count).toBe(5000);
      expect(body.usage.monthly.limit).toBe(100000);
      
      // フックが呼び出されたことを検証
      expect(mockFormatResponse).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
    });
  });

  describe('formatRedirectResponse', () => {
    test('デフォルトの一時的リダイレクト', () => {
      // テスト実行
      const response = responseUtils.formatRedirectResponse('https://example.com/redirect');

      // 検証
      expect(response.statusCode).toBe(302);
      expect(response.headers.Location).toBe('https://example.com/redirect');
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      // body が JSON 文字列であることを確認
      expect(JSON.parse(response.body).location).toBe('https://example.com/redirect');
    });

    test('恒久的リダイレクト', () => {
      // テスト実行
      const response = responseUtils.formatRedirectResponse('https://example.com/permanent', 301);

      // 検証
      expect(response.statusCode).toBe(301);
      expect(response.headers.Location).toBe('https://example.com/permanent');
    });
  });

  describe('formatOptionsResponse', () => {
    test('デフォルトのOPTIONSレスポンス', () => {
      // テスト実行
      const response = responseUtils.formatOptionsResponse();

      // 検証
      expect(response.statusCode).toBe(200); // 実装では 200 を返す
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Access-Control-Allow-Headers']).toContain('Content-Type');
      expect(response.headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(response.body).toBe('');
    });

    test('カスタムヘッダー付きのOPTIONSレスポンス', () => {
      // テスト実行
      const response = responseUtils.formatOptionsResponse({
        'Custom-Header': 'Value'
      });

      // 検証
      expect(response.statusCode).toBe(200); // 実装では 200 を返す
      expect(response.headers['Custom-Header']).toBe('Value');
    });
  });

  describe('handleCors', () => { // handleOptions -> handleCors に変更
    test('OPTIONSメソッドの処理', async () => {
      // テスト実行
      const event = { httpMethod: 'OPTIONS' };
      const handler = jest.fn();
      
      const response = await responseUtils.handleCors(event, handler);

      // 検証
      expect(response).not.toBeNull();
      expect(response.statusCode).toBe(200); // 実装では 200 を返す
      expect(handler).not.toHaveBeenCalled(); // ハンドラは呼ばれないことを確認
    });

    test('OPTIONSメソッド以外の処理', async () => {
      // テスト実行
      const event = { httpMethod: 'GET' };
      const mockResponse = { statusCode: 200, body: 'test' };
      const handler = jest.fn().mockResolvedValue(mockResponse);
      
      const response = await responseUtils.handleCors(event, handler);

      // 検証
      expect(handler).toHaveBeenCalledWith(event);
      expect(response).toBe(mockResponse);
    });
  });
});
