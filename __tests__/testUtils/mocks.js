/**
 * テスト用ユーティリティ関数 - モック設定と一貫性確保のためのヘルパー
 * 
 * @file __tests__/testUtils/mocks.js
 * @author Portfolio Manager Team
 * @created 2025-05-21
 */
'use strict';

/**
 * テスト用リクエストイベントを作成
 * @param {Object} options - イベントオプション
 * @returns {Object} - テスト用リクエストイベント
 */
const createTestEvent = (options = {}) => {
  const {
    httpMethod = 'GET',
    path = '/',
    pathParameters = null,
    queryStringParameters = null,
    headers = {},
    body = null,
    isBase64Encoded = false
  } = options;
  
  // テストモードフラグを設定
  return {
    httpMethod,
    path,
    pathParameters,
    queryStringParameters,
    headers,
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null,
    isBase64Encoded,
    _testMode: true,
    _testLogger: createTestLogger(),
    _formatResponse: jest.fn(),
    _formatErrorResponse: jest.fn(),
    _formatRedirectResponse: jest.fn()
  };
};

/**
 * テスト用ロガーを作成
 * @returns {Object} - テスト用ロガー
 */
const createTestLogger = () => {
  return {
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };
};

/**
 * レスポンスユーティリティのモックを設定
 * @param {Object} mockModule - モック化する responseUtils モジュール
 * @returns {Object} - モック設定されたモジュール
 */
const setupResponseUtilsMock = (mockModule) => {
  // 正常レスポンスのモック
  mockModule.formatResponse = jest.fn().mockImplementation((options = {}) => {
    const {
      statusCode = 200,
      data = {},
      headers = {}
    } = options;
    
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(data)
    };
  });
  
  // エラーレスポンスのモック
  mockModule.formatErrorResponse = jest.fn().mockImplementation((options = {}) => {
    const {
      statusCode = 400,
      code = 'ERROR',
      message = 'エラーが発生しました',
      details,
      headers = {}
    } = options;
    
    const errorObj = { code, message };
    if (details) errorObj.details = details;
    
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({
        success: false,
        error: errorObj
      })
    };
  });
  
  // リダイレクトレスポンスのモック
  mockModule.formatRedirectResponse = jest.fn().mockImplementation((location, statusCode = 302, headers = {}) => {
    return {
      statusCode,
      headers: {
        'Location': location,
        ...headers
      },
      body: JSON.stringify({ location })
    };
  });
  
  // OPTIONSレスポンスのモック
  mockModule.formatOptionsResponse = jest.fn().mockImplementation((headers = {}) => {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        ...headers
      },
      body: ''
    };
  });
  
  // CORS処理のモック
  mockModule.handleCors = jest.fn().mockImplementation(async (event, handler) => {
    if (event.httpMethod === 'OPTIONS') {
      return mockModule.formatOptionsResponse();
    }
    return handler(event);
  });
  
  return mockModule;
};

/**
 * Google認証サービスのモックを設定
 * @param {Object} mockModule - モック化する googleAuthService モジュール
 * @returns {Object} - モック設定されたモジュール
 */
const setupGoogleAuthServiceMock = (mockModule) => {
  // 認証コードとトークン交換のモック
  mockModule.exchangeCodeForTokens = jest.fn().mockResolvedValue({
    id_token: 'test-id-token',
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600
  });
  
  // IDトークン検証のモック
  mockModule.verifyIdToken = jest.fn().mockResolvedValue({
    sub: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/pic.jpg'
  });
  
  // セッション作成のモック
  mockModule.createUserSession = jest.fn().mockResolvedValue({
    sessionId: 'test-session-id',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });
  
  // セッション取得のモック
  mockModule.getSession = jest.fn().mockResolvedValue({
    sessionId: 'test-session-id',
    googleId: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/pic.jpg',
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });
  
  // セッション無効化のモック
  mockModule.invalidateSession = jest.fn().mockResolvedValue(true);
  
  return mockModule;
};

/**
 * Cookie処理ユーティリティのモックを設定
 * @param {Object} mockModule - モック化する cookieParser モジュール
 * @returns {Object} - モック設定されたモジュール
 */
const setupCookieParserMock = (mockModule) => {
  // Cookieパースのモック
  mockModule.parseCookies = jest.fn().mockImplementation((cookieInput) => {
    // テスト用のデフォルト値
    if (!cookieInput) return {};
    
    // 特定のテストケース用の固定値
    if (cookieInput.Cookie === 'session=test-session-id') {
      return { session: 'test-session-id' };
    }
    
    // ヘッダーからのCookie解析をシミュレート
    if (cookieInput.headers && cookieInput.headers.Cookie) {
      const cookieStr = cookieInput.headers.Cookie;
      if (cookieStr.includes('session=')) {
        return { session: cookieStr.split('session=')[1].split(';')[0] };
      }
    }
    
    return {};
  });
  
  // セッションCookie作成のモック
  mockModule.createSessionCookie = jest.fn().mockImplementation((sessionId) => {
    return `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`;
  });
  
  // Cookie削除のモック
  mockModule.createClearSessionCookie = jest.fn().mockImplementation(() => {
    return 'session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });
  
  return mockModule;
};

/**
 * すべてのモジュールに対してモックをセットアップ
 * @param {Object} mocks - モック化するモジュールのオブジェクト
 * @returns {Object} - モック設定されたモジュール群
 */
const setupAllMocks = (mocks) => {
  const { responseUtils, googleAuthService, cookieParser } = mocks;
  
  return {
    responseUtils: setupResponseUtilsMock(responseUtils),
    googleAuthService: setupGoogleAuthServiceMock(googleAuthService),
    cookieParser: setupCookieParserMock(cookieParser)
  };
};

module.exports = {
  createTestEvent,
  createTestLogger,
  setupResponseUtilsMock,
  setupGoogleAuthServiceMock,
  setupCookieParserMock,
  setupAllMocks
};
