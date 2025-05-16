/**
 * ファイルパス: setupTests.js
 * 
 * Jest テスト用のセットアップファイル
 * すべてのテストに共通する設定を行う
 * 
 * @file setupTests.js
 * @author Portfolio Manager Team
 * @updated 2025-05-16 - 適切なタイムアウト設定と環境変数のセットアップ
 */

// 環境変数の設定
process.env.NODE_ENV = 'test';
process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
process.env.DYNAMODB_TABLE_PREFIX = 'test-';

// ユーティリティのモック化
jest.mock('./src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// グローバルタイムアウト設定
// このファイルは各プロジェクトでも実行されますが、
// jest.config.jsのprojectsセクションでのtestTimeoutがこれより優先されます
jest.setTimeout(30000);  // デフォルト: 30秒

// テスト種別の検出と適切なタイムアウト設定
// 注: jest.config.jsのprojectsセクションの設定が優先されますが、
// ファイルパスに基づいてタイムアウトを変えたい場合は以下の方法も有効です
if (process.env.JEST_WORKER_ID) {
  const testPath = process.env.TEST_PATH || '';
  
  if (testPath.includes('/__tests__/unit/')) {
    jest.setTimeout(15000);  // ユニットテスト: 15秒
  } else if (testPath.includes('/__tests__/integration/')) {
    jest.setTimeout(30000);  // 統合テスト: 30秒
  } else if (testPath.includes('/__tests__/e2e/')) {
    jest.setTimeout(60000);  // E2Eテスト: 60秒
  }
}

// APIリクエストのタイムアウト設定
const axios = require('axios');
axios.defaults.timeout = 10000; // 10秒

// DynamoDBモックの初期化のロジック改善
// テスト中に使われるDynamoDBのテーブル名のパターンは一貫して「test-」プレフィックスを使用する
if (process.env.NODE_ENV === 'test') {
  if (!process.env.SESSION_TABLE) {
    process.env.SESSION_TABLE = 'test-sessions';
  }
  if (!process.env.CACHE_TABLE) {
    process.env.CACHE_TABLE = 'test-cache';
  }
  if (!process.env.BLACKLIST_TABLE) {
    process.env.BLACKLIST_TABLE = 'test-scraping-blacklist';
  }
}

// テスト用のグローバル変数設定
global.__TEST_MODE__ = true;

// テスト開始・終了時のログ出力
beforeAll(() => {
  console.log(`Starting test suite in ${process.env.NODE_ENV} environment`);
});

afterAll(() => {
  console.log('All tests completed');
});
