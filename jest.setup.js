/**
 * Jest テスト開始前の環境設定
 * 
 * @file jest.setup.js
 * @author Portfolio Manager Team
 * @created 2025-05-18
 */

// テスト環境を設定
process.env.NODE_ENV = 'test';

// AWS リージョン設定
process.env.AWS_REGION = 'us-east-1';

// テスト用のテーブル名プレフィックス
process.env.DYNAMODB_TABLE_PREFIX = 'test-portfolio-market-data-';

// テスト用キャッシュテーブル
process.env.CACHE_TABLE = 'test-portfolio-market-data-cache';

// テスト用セッションテーブル
process.env.SESSION_TABLE = 'test-portfolio-market-data-sessions';

// CORS設定
process.env.CORS_ALLOW_ORIGIN = '*';

// APIキー設定
process.env.ADMIN_API_KEY = 'test-admin-api-key';
process.env.ADMIN_EMAIL = 'admin@example.com';

// 使用量制限
process.env.DAILY_REQUEST_LIMIT = '100';
process.env.MONTHLY_REQUEST_LIMIT = '1000';
process.env.DISABLE_ON_LIMIT = 'true';

// キャッシュ設定
process.env.CACHE_TIME_US_STOCK = '3600';
process.env.CACHE_TIME_JP_STOCK = '3600';
process.env.CACHE_TIME_MUTUAL_FUND = '10800';
process.env.CACHE_TIME_EXCHANGE_RATE = '21600';

// Google認証設定
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.SESSION_EXPIRES_DAYS = '7';

// DynamoDBモックを有効化
const mockDynamoDb = {
  get: jest.fn().mockImplementation(() => ({
    promise: jest.fn().mockResolvedValue({ Item: null })
  })),
  put: jest.fn().mockImplementation(() => ({
    promise: jest.fn().mockResolvedValue({})
  })),
  update: jest.fn().mockImplementation(() => ({
    promise: jest.fn().mockResolvedValue({ Attributes: { count: 1 } })
  })),
  delete: jest.fn().mockImplementation(() => ({
    promise: jest.fn().mockResolvedValue({})
  })),
  scan: jest.fn().mockImplementation(() => ({
    promise: jest.fn().mockResolvedValue({ Items: [] })
  })),
  query: jest.fn().mockImplementation(() => ({
    promise: jest.fn().mockResolvedValue({ Items: [] })
  }))
};

// グローバルDynamoDBモック
global.__AWS_MOCK__ = {
  dynamoDb: mockDynamoDb
};

// コンソール出力をモック化（静かなテスト実行のため）
global.originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

// テスト中は警告・エラーのみ出力（CI環境では調整可能）
if (process.env.CI !== 'true') {
  console.log = jest.fn();
  console.info = jest.fn();
}

// 日付のモック
jest.spyOn(global.Date, 'now').mockImplementation(() => 1715900000000); // 2025-05-18T10:00:00.000Z

