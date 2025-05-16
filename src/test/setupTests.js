/**
 * テスト設定補助ファイル
 * @file src/test/setupTests.js
 * 
 * このファイルはJestの自動セットアップとして使用します。
 * Jestのセットアップファイルとして設定することで、すべてのテストの前に実行されます。
 */

// モジュールモックの設定
jest.mock('../services/sources/enhancedMarketDataService');
jest.mock('../services/googleAuthService');
jest.mock('../utils/budgetCheck');
jest.mock('../services/usage');
jest.mock('../services/cache');

// モックの事前設定
const enhancedMarketDataService = require('../services/sources/enhancedMarketDataService');
const googleAuthService = require('../services/googleAuthService');
const budgetCheck = require('../utils/budgetCheck');
const usageService = require('../services/usage');
const cacheService = require('../services/cache');

// テスト環境検出
const isInTestEnv = process.env.NODE_ENV === 'test';

if (isInTestEnv) {
  // EnhancedMarketDataServiceのデフォルトモック
  enhancedMarketDataService.getUsStockData.mockResolvedValue({
    ticker: 'AAPL',
    price: 180.95,
    change: 2.5,
    changePercent: 1.4,
    name: 'Apple Inc.',
    currency: 'USD',
    isStock: true,
    isMutualFund: false,
    source: 'Test Data',
    lastUpdated: new Date().toISOString()
  });

  enhancedMarketDataService.getUsStocksData.mockResolvedValue({
    'AAPL': {
      ticker: 'AAPL',
      price: 180.95,
      change: 2.5,
      changePercent: 1.4,
      name: 'Apple Inc.',
      currency: 'USD',
      isStock: true,
      isMutualFund: false,
      source: 'Test Data',
      lastUpdated: new Date().toISOString()
    },
    'MSFT': {
      ticker: 'MSFT',
      price: 320.45,
      change: 1.5,
      changePercent: 0.5,
      name: 'Microsoft Corporation',
      currency: 'USD',
      isStock: true,
      isMutualFund: false,
      source: 'Test Data',
      lastUpdated: new Date().toISOString()
    },
    'GOOGL': {
      ticker: 'GOOGL',
      price: 135.37,
      change: -0.8,
      changePercent: -0.6,
      name: 'Alphabet Inc.',
      currency: 'USD',
      isStock: true,
      isMutualFund: false,
      source: 'Test Data',
      lastUpdated: new Date().toISOString()
    }
  });

  enhancedMarketDataService.getJpStockData.mockResolvedValue({
    ticker: '7203',
    price: 2500,
    change: 50,
    changePercent: 2.0,
    name: 'トヨタ自動車',
    currency: 'JPY',
    isStock: true,
    isMutualFund: false,
    source: 'Test Data',
    lastUpdated: new Date().toISOString()
  });

  enhancedMarketDataService.getJpStocksData.mockResolvedValue({
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
      lastUpdated: new Date().toISOString()
    },
    '9984': {
      ticker: '9984',
      price: 6780,
      change: -120,
      changePercent: -1.8,
      name: 'ソフトバンクグループ',
      currency: 'JPY',
      isStock: true,
      isMutualFund: false,
      source: 'Test Data',
      lastUpdated: new Date().toISOString()
    }
  });

  enhancedMarketDataService.getMutualFundData.mockResolvedValue({
    ticker: '0131103C',
    price: 12345,
    change: 25,
    changePercent: 0.2,
    name: 'テスト投資信託',
    currency: 'JPY',
    isStock: false,
    isMutualFund: true,
    priceLabel: '基準価額',
    source: 'Test Data',
    lastUpdated: new Date().toISOString()
  });

  enhancedMarketDataService.getMutualFundsData.mockResolvedValue({
    '0131103C': {
      ticker: '0131103C',
      price: 12345,
      change: 25,
      changePercent: 0.2,
      name: 'テスト投資信託1',
      currency: 'JPY',
      isStock: false,
      isMutualFund: true,
      priceLabel: '基準価額',
      source: 'Test Data',
      lastUpdated: new Date().toISOString()
    },
    '2931113C': {
      ticker: '2931113C',
      price: 23456,
      change: -15,
      changePercent: -0.1,
      name: 'テスト投資信託2',
      currency: 'JPY',
      isStock: false,
      isMutualFund: true,
      priceLabel: '基準価額',
      source: 'Test Data',
      lastUpdated: new Date().toISOString()
    }
  });

  enhancedMarketDataService.getExchangeRateData.mockResolvedValue({
    pair: 'USD-JPY',
    base: 'USD',
    target: 'JPY',
    rate: 149.82,
    change: 0.32,
    changePercent: 0.21,
    lastUpdated: new Date().toISOString(),
    source: 'Test Data'
  });

  // GoogleAuthServiceのデフォルトモック
  googleAuthService.exchangeCodeForTokens.mockResolvedValue({
    access_token: 'test-access-token',
    id_token: 'test-id-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600
  });

  googleAuthService.verifyIdToken.mockResolvedValue({
    sub: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/test-user.jpg'
  });

  googleAuthService.createUserSession.mockResolvedValue({
    sessionId: 'test-session-id',
    googleId: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/test-user.jpg',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  googleAuthService.getSession.mockResolvedValue({
    sessionId: 'test-session-id',
    googleId: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/test-user.jpg',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  googleAuthService.invalidateSession.mockResolvedValue(true);

  // 予算チェックのデフォルトモック
  budgetCheck.isBudgetCritical.mockResolvedValue(false);
  budgetCheck.getBudgetWarningMessage.mockResolvedValue('Budget warning test message');

  // 使用量サービスのデフォルトモック
  usageService.checkAndUpdateUsage.mockResolvedValue({
    allowed: true,
    usage: {
      daily: {
        count: 5,
        limit: 1000,
        remaining: 995,
        resetDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      monthly: {
        count: 10,
        limit: 10000,
        remaining: 9990,
        resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    }
  });

  // キャッシュサービスのデフォルトモック
  cacheService.get.mockResolvedValue(null); // デフォルトはキャッシュミス
  cacheService.set.mockResolvedValue(true);
}

// グローバル変数の設定
global.TEST_MODE = true;

// 環境変数の設定（テスト環境フラグ）
process.env.NODE_ENV = 'test';
