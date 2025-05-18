/**
 * テスト用モックユーティリティ
 * 
 * @file __tests__/testUtils/mocks.js
 * @author Portfolio Manager Team
 * @created 2025-05-20
 */

/**
 * API関数のレスポンス形式を統一するためのモック関数を設定する
 * 
 * @param {Object} mockFn - モックする関数
 * @param {Object} options - モック設定オプション
 * @returns {Object} - 設定したモックオブジェクト
 */
const setupResponseFormatMock = (mockFn, options = {}) => {
  // デフォルトのステータスコード
  const defaultStatusCode = options.defaultStatusCode || 200;
  
  // 成功レスポンス生成関数
  mockFn.mockImplementation((responseData) => {
    const statusCode = responseData.statusCode || defaultStatusCode;
    const headers = responseData.headers || { 'Content-Type': 'application/json' };
    const body = JSON.stringify(responseData.data || {});
    
    return {
      statusCode,
      headers,
      body
    };
  });
  
  return mockFn;
};

/**
 * エラーレスポンス形式を統一するためのモック関数を設定する
 * 
 * @param {Object} mockFn - モックする関数
 * @param {Object} options - モック設定オプション
 * @returns {Object} - 設定したモックオブジェクト
 */
const setupErrorResponseFormatMock = (mockFn, options = {}) => {
  // デフォルトのステータスコード
  const defaultStatusCode = options.defaultStatusCode || 400;
  
  // エラーレスポンス生成関数
  mockFn.mockImplementation((errorData) => {
    const statusCode = errorData.statusCode || defaultStatusCode;
    const headers = errorData.headers || { 'Content-Type': 'application/json' };
    const error = {
      code: errorData.code || 'ERROR',
      message: errorData.message || 'エラーが発生しました',
    };
    
    if (errorData.details) {
      error.details = errorData.details;
    }
    
    const body = JSON.stringify({
      success: false,
      error
    });
    
    return {
      statusCode,
      headers,
      body
    };
  });
  
  return mockFn;
};

/**
 * リダイレクトレスポンス形式を統一するためのモック関数を設定する
 * 
 * @param {Object} mockFn - モックする関数
 * @returns {Object} - 設定したモックオブジェクト
 */
const setupRedirectResponseFormatMock = (mockFn) => {
  // リダイレクトレスポンス生成関数
  mockFn.mockImplementation((location, statusCode = 302, headers = {}) => {
    return {
      statusCode,
      headers: {
        ...headers,
        'Location': location
      },
      body: JSON.stringify({
        location
      })
    };
  });
  
  return mockFn;
};

/**
 * テスト用のセッションデータを生成する
 * 
 * @param {Object} overrides - 上書きするプロパティ
 * @returns {Object} - セッションデータ
 */
const generateTestSessionData = (overrides = {}) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1週間後
  
  return {
    sessionId: 'test-session-id',
    googleId: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/pic.jpg',
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresAt: expiresAt.toISOString(),
    created: now.toISOString(),
    ...overrides
  };
};

/**
 * テスト用のGoogleトークンレスポンスを生成する
 * 
 * @param {Object} overrides - 上書きするプロパティ
 * @returns {Object} - Googleトークンレスポンス
 */
const generateGoogleTokenResponse = (overrides = {}) => {
  return {
    id_token: 'test-id-token',
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    ...overrides
  };
};

/**
 * テスト用のIDトークンペイロードを生成する
 * 
 * @param {Object} overrides - 上書きするプロパティ
 * @returns {Object} - IDトークンペイロード
 */
const generateIdTokenPayload = (overrides = {}) => {
  return {
    sub: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/pic.jpg',
    ...overrides
  };
};

module.exports = {
  setupResponseFormatMock,
  setupErrorResponseFormatMock,
  setupRedirectResponseFormatMock,
  generateTestSessionData,
  generateGoogleTokenResponse,
  generateIdTokenPayload
};
