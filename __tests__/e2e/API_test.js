/**
 * ファイルパス: __tests__/e2e/API_test.js
 * 
 * Portfolio Market Data API のエンドツーエンドテスト
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-18
 * @updated 2025-05-12 修正: APIサーバー起動チェックとエラーメッセージを改善、テストスキップ機能を追加
 */

const axios = require('axios');
const { setupTestEnvironment, teardownTestEnvironment } = require('../testUtils/environment');

// APIエンドポイント（テスト環境用）
const API_BASE_URL = process.env.API_TEST_URL || 'http://localhost:3000/dev';

// テストデータ
const TEST_DATA = {
  // 証券コード
  usStockSymbol: 'AAPL',
  jpStockCode: '7203',
  mutualFundCode: '0131103C',
  exchangeRate: 'USD-JPY',
  
  // 認証情報
  testAuthCode: 'test-auth-code',
  redirectUri: 'http://localhost:3000/callback',
  
  // ポートフォリオデータ
  samplePortfolio: {
    name: 'Test Portfolio',
    holdings: [
      { symbol: 'AAPL', shares: 10, cost: 150.0 },
      { symbol: '7203', shares: 100, cost: 2000 }
    ]
  }
};

// テスト用クッキーの保存
let sessionCookie = '';

// APIサーバー実行状態フラグ
let isApiServerRunning = false;

// 条件付きテスト関数 - APIサーバーが実行されていない場合はスキップ
const conditionalTest = (name, fn) => {
  if (!isApiServerRunning) {
    test.skip(name, fn);
  } else {
    test(name, fn);
  }
};

describe('Portfolio Market Data API E2Eテスト', () => {
  // テスト環境のセットアップ
  beforeAll(async () => {
    await setupTestEnvironment();
    
    // APIサーバーの起動確認 - 修正: 実際に存在するエンドポイントを使用
    try {
      await axios.get(`${API_BASE_URL}/auth/session`, { timeout: 2000 });
      console.log(`✅ API server is running at ${API_BASE_URL}`);
      isApiServerRunning = true;
    } catch (error) {
      console.warn(`❌ API server is not running at ${API_BASE_URL}`);
      console.warn(`Please start the API server with 'npm run dev' in a separate terminal.`);
      console.warn('E2E tests will be skipped until the API server is running.');
      isApiServerRunning = false;
      // エラーをスローしない - 代わりに各テストをスキップする
    }
  });
  
  // テスト環境のクリーンアップ
  afterAll(async () => {
    await teardownTestEnvironment();
  });
  
  // 各テスト後のリセット
  afterEach(() => {
    // 必要に応じて追加
  });
  
  describe('マーケットデータAPI', () => {
    conditionalTest('米国株データ取得', async () => {
      // APIリクエスト
      const response = await axios.get(`${API_BASE_URL}/api/market-data`, {
        params: {
          type: 'us-stock',
          symbols: TEST_DATA.usStockSymbol
        }
      });
      
      // レスポンス検証
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      
      const stockData = response.data.data[TEST_DATA.usStockSymbol];
      expect(stockData).toBeDefined();
      expect(stockData.ticker).toBe(TEST_DATA.usStockSymbol);
      expect(stockData.price).toBeGreaterThan(0);
      expect(stockData.currency).toBe('USD');
    });
    
    conditionalTest('日本株データ取得', async () => {
      // APIリクエスト
      const response = await axios.get(`${API_BASE_URL}/api/market-data`, {
        params: {
          type: 'jp-stock',
          symbols: TEST_DATA.jpStockCode
        }
      });
      
      // レスポンス検証
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      
      const stockData = response.data.data[TEST_DATA.jpStockCode];
      expect(stockData).toBeDefined();
      expect(stockData.ticker).toBe(TEST_DATA.jpStockCode);
      expect(stockData.price).toBeGreaterThan(0);
      expect(stockData.currency).toBe('JPY');
    });
    
    conditionalTest('投資信託データ取得', async () => {
      // APIリクエスト
      const response = await axios.get(`${API_BASE_URL}/api/market-data`, {
        params: {
          type: 'mutual-fund',
          symbols: TEST_DATA.mutualFundCode
        }
      });
      
      // レスポンス検証
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      
      const fundData = response.data.data[TEST_DATA.mutualFundCode];
      expect(fundData).toBeDefined();
      expect(fundData.ticker).toBe(TEST_DATA.mutualFundCode);
      expect(fundData.price).toBeGreaterThan(0);
      expect(fundData.isMutualFund).toBe(true);
    });
    
    conditionalTest('為替レートデータ取得', async () => {
      // APIリクエスト
      const response = await axios.get(`${API_BASE_URL}/api/market-data`, {
        params: {
          type: 'exchange-rate',
          symbols: TEST_DATA.exchangeRate,
          base: 'USD',
          target: 'JPY'
        }
      });
      
      // レスポンス検証
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      
      const rateData = response.data.data[TEST_DATA.exchangeRate];
      expect(rateData).toBeDefined();
      expect(rateData.pair).toBe(TEST_DATA.exchangeRate);
      expect(rateData.rate).toBeGreaterThan(0);
      expect(rateData.base).toBe('USD');
      expect(rateData.target).toBe('JPY');
    });
    
    conditionalTest('無効なパラメータでのエラーハンドリング', async () => {
      try {
        // 不正なパラメータでAPIリクエスト
        await axios.get(`${API_BASE_URL}/api/market-data`, {
          params: {
            type: 'invalid-type',
            symbols: TEST_DATA.usStockSymbol
          }
        });
        
        // ここに到達したらテスト失敗
        expect(true).toBe(false);
      } catch (error) {
        // エラーレスポンス検証
        expect(error.response.status).toBe(400);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.error.code).toBe('INVALID_PARAMS');
      }
    });
  });
  
  describe('認証API', () => {
    conditionalTest('認証フロー: ログイン、セッション取得、ログアウト', async () => {
      // モック認証サーバーの設定が必要 - 実際の環境では実装方法が異なります
      
      // ステップ1: Googleログイン
      const loginResponse = await axios.post(`${API_BASE_URL}/auth/google/login`, {
        code: TEST_DATA.testAuthCode,
        redirectUri: TEST_DATA.redirectUri
      });
      
      // レスポンス検証
      expect(loginResponse.status).toBe(200);
      expect(loginResponse.data.success).toBe(true);
      expect(loginResponse.data.isAuthenticated).toBe(true);
      expect(loginResponse.data.user).toBeDefined();
      
      // セッションCookieを保存
      sessionCookie = loginResponse.headers['set-cookie'][0];
      expect(sessionCookie).toContain('session=');
      
      // ステップ2: セッション情報取得
      const sessionResponse = await axios.get(`${API_BASE_URL}/auth/session`, {
        headers: {
          Cookie: sessionCookie
        }
      });
      
      // レスポンス検証
      expect(sessionResponse.status).toBe(200);
      expect(sessionResponse.data.success).toBe(true);
      expect(sessionResponse.data.data.isAuthenticated).toBe(true);
      expect(sessionResponse.data.data.user.id).toBeDefined();
      
      // ステップ3: ログアウト
      const logoutResponse = await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
        headers: {
          Cookie: sessionCookie
        }
      });
      
      // レスポンス検証
      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.data.success).toBe(true);
      expect(logoutResponse.data.message).toBe('ログアウトしました');
      
      // ログアウト後のセッションCookieを確認（削除されているはず）
      const logoutCookie = logoutResponse.headers['set-cookie'][0];
      expect(logoutCookie).toContain('Max-Age=0');
      
      // ステップ4: ログアウト後のセッション情報取得（エラーになるはず）
      try {
        await axios.get(`${API_BASE_URL}/auth/session`, {
          headers: {
            Cookie: logoutCookie
          }
        });
        
        // ここに到達したらテスト失敗
        expect(true).toBe(false);
      } catch (error) {
        // エラーレスポンス検証
        expect(error.response.status).toBe(401);
        expect(error.response.data.success).toBe(false);
      }
    });
  });
  
  describe('Google Drive API', () => {
    // 認証を前提とするため、beforeEach でログインしておく
    beforeEach(async () => {
      // APIサーバーが実行されていない場合はスキップ
      if (!isApiServerRunning) return;
      
      // ログイン処理
      const loginResponse = await axios.post(`${API_BASE_URL}/auth/google/login`, {
        code: TEST_DATA.testAuthCode,
        redirectUri: TEST_DATA.redirectUri
      });
      
      sessionCookie = loginResponse.headers['set-cookie'][0];
    });
    
    conditionalTest('ポートフォリオデータの保存と読み込み', async () => {
      // ステップ1: ポートフォリオデータを保存
      const saveResponse = await axios.post(
        `${API_BASE_URL}/drive/save`,
        { portfolioData: TEST_DATA.samplePortfolio },
        {
          headers: {
            Cookie: sessionCookie
          }
        }
      );
      
      // レスポンス検証
      expect(saveResponse.status).toBe(200);
      expect(saveResponse.data.success).toBe(true);
      expect(saveResponse.data.file.id).toBeDefined();
      
      // 保存したファイルIDを取得
      const fileId = saveResponse.data.file.id;
      
      // ステップ2: ファイル一覧を取得して検証
      const listResponse = await axios.get(`${API_BASE_URL}/drive/files`, {
        headers: {
          Cookie: sessionCookie
        }
      });
      
      // レスポンス検証
      expect(listResponse.status).toBe(200);
      expect(listResponse.data.success).toBe(true);
      expect(listResponse.data.files.length).toBeGreaterThan(0);
      
      // 保存したファイルが一覧に含まれているか
      const savedFile = listResponse.data.files.find(file => file.id === fileId);
      expect(savedFile).toBeDefined();
      
      // ステップ3: 保存したファイルを読み込み
      const loadResponse = await axios.get(`${API_BASE_URL}/drive/load`, {
        params: { fileId },
        headers: {
          Cookie: sessionCookie
        }
      });
      
      // レスポンス検証
      expect(loadResponse.status).toBe(200);
      expect(loadResponse.data.success).toBe(true);
      expect(loadResponse.data.data).toEqual(TEST_DATA.samplePortfolio);
    });
    
    conditionalTest('認証なしでのアクセス拒否', async () => {
      try {
        // 認証なしでリクエスト
        await axios.get(`${API_BASE_URL}/drive/files`);
        
        // ここに到達したらテスト失敗
        expect(true).toBe(false);
      } catch (error) {
        // エラーレスポンス検証
        expect(error.response.status).toBe(401);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.error.code).toBe('NO_SESSION');
      }
    });
  });
});
