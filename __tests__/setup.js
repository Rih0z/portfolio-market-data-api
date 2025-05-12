/**
 * ファイルパス: __tests__/setup.js
 * 
 * Jestテスト実行前の共通セットアップファイル
 * 
 * @file __tests__/setup.js
 * @author Koki Riho
 * @created 2025-05-12
 * @updated 2025-05-12
 */

// テスト用のタイムアウト設定
jest.setTimeout(30000); // 30秒

// エラーハンドリングを改善
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // テスト環境では強制終了しない
});

// テスト環境変数のデフォルト値設定
process.env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'test',
  DYNAMODB_ENDPOINT: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  SESSION_TABLE: process.env.SESSION_TABLE || 'test-sessions',
  DYNAMODB_TABLE_PREFIX: process.env.DYNAMODB_TABLE_PREFIX || 'test-',
};

// モックライブラリの設定
// nockの自動クリーンアップを設定
const nock = require('nock');
nock.disableNetConnect();
nock.enableNetConnect('localhost'); // ローカル接続は許可

// テスト前後の共通処理
beforeAll(async () => {
  console.log('Starting test suite with environment:', process.env.NODE_ENV);
  console.log('Test configuration:');
  console.log('- RUN_E2E_TESTS:', process.env.RUN_E2E_TESTS);
  console.log('- USE_API_MOCKS:', process.env.USE_API_MOCKS);
  console.log('- SKIP_E2E_TESTS:', process.env.SKIP_E2E_TESTS);
});

afterAll(async () => {
  console.log('Test suite completed');
  
  // Jestのタイマーを確実にクリーンアップ
  jest.useRealTimers();
  
  // nockのクリーンアップ
  nock.cleanAll();
  nock.enableNetConnect();
});

// 各テスト後のクリーンアップ
afterEach(() => {
  // タイマーのクリーンアップ
  jest.clearAllTimers();
  
  // モックのリセット
  jest.resetAllMocks();
});
