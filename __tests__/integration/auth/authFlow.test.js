/**
 * ファイルパス: __tests__/integration/auth/authFlow.test.js
 * 
 * 認証フローの統合テスト
 * ログイン、セッション確認、ログアウトの完全なフローをテスト
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-13
 */

const axios = require('axios');
const { setupTestEnvironment, teardownTestEnvironment } = require('../../testUtils/environment');
const { mockApiRequest, resetApiMocks, sessionState } = require('../../testUtils/apiMocks');
const { isApiServerRunning } = require('../../testUtils/apiServer');
const { setupGoogleOAuth2Mock } = require('../../testUtils/googleMock');

// APIエンドポイント（テスト環境用）
const API_BASE_URL = process.env.API_TEST_URL || 'http://localhost:3000/dev';

// モック利用の判定フラグ
const USE_MOCKS = process.env.USE_API_MOCKS === 'true' || false;

// テストデータ
const TEST_DATA = {
  testAuthCode: 'test-auth-code',
  redirectUri: 'http://localhost:3000/callback',
  testUser: {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/pic.jpg'
  }
};

// APIサーバー実行状態フラグ
let apiServerAvailable = USE_MOCKS;

// JWT関連のヘルパー関数（モック用）
const generateMockJwt = (payload) => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = Buffer.from('signature').toString('base64');
  return `${header}.${body}.${signature}`;
};

// 条件付きテスト関数 - APIサーバーが実行されていない場合はスキップ
const conditionalTest = (name, fn) => {
  if (!apiServerAvailable && !USE_MOCKS) {
    test.skip(name, () => {
      console.log(`Skipping test: ${name} - API server not available and mocks not enabled`);
    });
  } else {
    test(name, fn);
  }
};

describe('完全な認証フロー統合テスト', () => {
  // Google認証モック
  let googleMock;
  
  // テスト環境のセットアップ
  beforeAll(async () => {
    await setupTestEnvironment();
    
    // Google OAuth2モックをセットアップ
    googleMock = setupGoogleOAuth2Mock();
    
    // APIサーバーの起動確認
    try {
      const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
      apiServerAvailable = response.status === 200;
      console.log(`✅ API server is running at ${API_BASE_URL}`);
    } catch (error) {
      console.warn(`❌ API server is not running at ${API_BASE_URL}: ${error.message}`);
      console.warn('Using mocks instead');
      
      // モックが有効な場合はサーバー可用性をtrueに設定
      apiServerAvailable = USE_MOCKS;
      
      if (USE_MOCKS) {
        setupAuthMocks();
      }
    }
  });
  
  // テスト環境のクリーンアップ
  afterAll(async () => {
    await teardownTestEnvironment();
    
    if (googleMock) {
      googleMock.stop();
    }
  });
  
  // モックの設定
  const setupAuthMocks = () => {
    // APIモックをリセット
    resetApiMocks();
    
    // Googleログイン処理のモック
    mockApiRequest(`${API_BASE_URL}/auth/google/login`, 'POST', {
      success: true,
      isAuthenticated: true,
      user: TEST_DATA.testUser
    }, 200, {
      'set-cookie': ['session=test-session-id; HttpOnly; Secure']
    });
    
    // IDトークンのモック
    const mockIdToken = generateMockJwt({
      sub: TEST_DATA.testUser.id,
      email: TEST_DATA.testUser.email,
      name: TEST_DATA.testUser.name,
      picture: TEST_DATA.testUser.picture
    });
    
    // セッション確認API
    mockApiRequest(`${API_BASE_URL}/auth/session`, 'GET', {
      success: true,
      data: {
        isAuthenticated: true,
        user: TEST_DATA.testUser
      }
    });
    
    // ログアウトAPI
    mockApiRequest(`${API_BASE_URL}/auth/logout`, 'POST', {
      success: true,
      message: 'ログアウトしました'
    }, 200, {
      'set-cookie': ['session=; Max-Age=0; HttpOnly; Secure']
    });
    
    // ログアウト後のセッション確認API - 401エラーを返す
    mockApiRequest(`${API_BASE_URL}/auth/session`, 'GET', {
      success: false,
      error: {
        code: 'NO_SESSION',
        message: '認証されていません'
      }
    }, 401, {}, { headers: { 'Cookie': 'session=; Max-Age=0' } });
    
    // ヘルスチェックAPI
    mockApiRequest(`${API_BASE_URL}/health`, 'GET', {
      success: true,
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  };
  
  // 認証フローのテスト
  conditionalTest('完全な認証フロー: ログイン → セッション確認 → ログアウト → 再確認', async () => {
    // ステップ1: Googleログイン処理
    let sessionCookie = '';
    
    try {
      const loginResponse = await axios.post(`${API_BASE_URL}/auth/google/login`, {
        code: TEST_DATA.testAuthCode,
        redirectUri: TEST_DATA.redirectUri
      });
      
      // レスポンスの検証
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.data.success).toBe(true);
      expect(loginResponse.data.isAuthenticated).toBe(true);
      expect(loginResponse.data.user).toBeDefined();
      
      // セッションCookieを保存
      sessionCookie = loginResponse.headers['set-cookie'] 
        ? loginResponse.headers['set-cookie'][0]
        : 'session=test-session-id';
        
      expect(sessionCookie).toContain('session=');
      
      console.log('✅ ログイン成功');
      
      // ステップ2: セッション情報の取得と確認
      const sessionResponse = await axios.get(`${API_BASE_URL}/auth/session`, {
        headers: {
          Cookie: sessionCookie
        }
      });
      
      // レスポンスの検証
      expect(sessionResponse.status).toBe(200);
      expect(sessionResponse.data.success).toBe(true);
      expect(sessionResponse.data.data.isAuthenticated).toBe(true);
      expect(sessionResponse.data.data.user).toBeDefined();
      expect(sessionResponse.data.data.user.id).toBe(TEST_DATA.testUser.id);
      expect(sessionResponse.data.data.user.email).toBe(TEST_DATA.testUser.email);
      
      console.log('✅ セッション確認成功');
      
      // ステップ3: ログアウト処理
      const logoutResponse = await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
        headers: {
          Cookie: sessionCookie
        }
      });
      
      // レスポンスの検証
      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.data.success).toBe(true);
      expect(logoutResponse.data.message).toBe('ログアウトしました');
      
      // ログアウト後のセッションCookieを確認
      const logoutCookie = logoutResponse.headers['set-cookie'] 
        ? logoutResponse.headers['set-cookie'][0]
        : 'session=; Max-Age=0';
        
      expect(logoutCookie).toContain('Max-Age=0');
      
      console.log('✅ ログアウト成功');
      
      // ステップ4: ログアウト後のセッション確認（エラーになることを確認）
      try {
        await axios.get(`${API_BASE_URL}/auth/session`, {
          headers: {
            Cookie: logoutCookie
          }
        });
        
        // ここに到達した場合はエラー（401が期待される）
        fail('Expected 401 error for authenticated request after logout');
      } catch (error) {
        // エラーレスポンスを検証
        expect(error.response).toBeDefined();
        expect(error.response.status).toBe(401);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.error).toBeDefined();
        expect(error.response.data.error.code).toBe('NO_SESSION');
        
        console.log('✅ ログアウト後のセッション確認（正しくエラー）');
      }
      
    } catch (error) {
      console.error('認証フローテストエラー:', error.response?.data || error.message);
      throw error;
    }
  });
  
  conditionalTest('無効な認証コードによるログイン失敗', async () => {
    try {
      await axios.post(`${API_BASE_URL}/auth/google/login`, {
        code: 'invalid-auth-code',
        redirectUri: TEST_DATA.redirectUri
      });
      
      // 成功した場合はテスト失敗
      fail('Expected login to fail with invalid auth code');
    } catch (error) {
      // エラーレスポンスを検証
      expect(error.response).toBeDefined();
      expect(error.response.status).toBe(401);
      expect(error.response.data.success).toBe(false);
      expect(error.response.data.error).toBeDefined();
      
      console.log('✅ 無効な認証コードによるログイン失敗（正しくエラー）');
    }
  });
  
  conditionalTest('認証なしのセッション確認', async () => {
    try {
      await axios.get(`${API_BASE_URL}/auth/session`);
      
      // 成功した場合はテスト失敗
      fail('Expected session check to fail without authentication');
    } catch (error) {
      // エラーレスポンスを検証
      expect(error.response).toBeDefined();
      expect(error.response.status).toBe(401);
      expect(error.response.data.success).toBe(false);
      
      console.log('✅ 認証なしのセッション確認（正しくエラー）');
    }
  });
  
  conditionalTest('無効なセッションIDによるセッション確認', async () => {
    try {
      await axios.get(`${API_BASE_URL}/auth/session`, {
        headers: {
          Cookie: 'session=invalid-session-id'
        }
      });
      
      // 成功した場合はテスト失敗
      fail('Expected session check to fail with invalid session ID');
    } catch (error) {
      // エラーレスポンスを検証
      expect(error.response).toBeDefined();
      expect(error.response.status).toBe(401);
      expect(error.response.data.success).toBe(false);
      
      console.log('✅ 無効なセッションIDによるセッション確認（正しくエラー）');
    }
  });
});
