/**
 * ファイルパス: setupTests.js
 * 
 * Jestテスト実行前の共通セットアップファイル
 * __tests__/setup.js と jest.setup.js の内容を統合
 * 
 * @file setupTests.js
 * @author Portfolio Manager Team
 * @created 2025-05-20
 */

// テスト用のタイムアウト設定
jest.setTimeout(30000); // 30秒

// エラーハンドリングを改善
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // テスト環境では強制終了しない
});

// テスト環境を設定
process.env.NODE_ENV = 'test';

// テスト環境変数のデフォルト値設定
process.env = {
  ...process.env,
  // 基本設定
  DYNAMODB_ENDPOINT: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  SESSION_TABLE: process.env.SESSION_TABLE || 'test-sessions',
  DYNAMODB_TABLE_PREFIX: process.env.DYNAMODB_TABLE_PREFIX || 'test-',
  
  // AWS リージョン設定
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  
  // テスト用キャッシュとセッションテーブル
  CACHE_TABLE: process.env.CACHE_TABLE || 'test-portfolio-market-data-cache',
  
  // CORS設定
  CORS_ALLOW_ORIGIN: process.env.CORS_ALLOW_ORIGIN || '*',
  
  // APIキー設定
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || 'test-admin-api-key',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@example.com',
  
  // 使用量制限
  DAILY_REQUEST_LIMIT: process.env.DAILY_REQUEST_LIMIT || '100',
  MONTHLY_REQUEST_LIMIT: process.env.MONTHLY_REQUEST_LIMIT || '1000',
  DISABLE_ON_LIMIT: process.env.DISABLE_ON_LIMIT || 'true',
  
  // キャッシュ設定
  CACHE_TIME_US_STOCK: process.env.CACHE_TIME_US_STOCK || '3600',
  CACHE_TIME_JP_STOCK: process.env.CACHE_TIME_JP_STOCK || '3600',
  CACHE_TIME_MUTUAL_FUND: process.env.CACHE_TIME_MUTUAL_FUND || '10800',
  CACHE_TIME_EXCHANGE_RATE: process.env.CACHE_TIME_EXCHANGE_RATE || '21600',
  
  // Google認証設定
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'test-client-id',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || 'test-client-secret',
  SESSION_EXPIRES_DAYS: process.env.SESSION_EXPIRES_DAYS || '7',
};

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

// モックライブラリの設定
// nockの自動クリーンアップを設定
const nock = require('nock');
nock.disableNetConnect();
nock.enableNetConnect('localhost'); // ローカル接続は許可

// コンソール出力をモック化（静かなテスト実行のため）
global.originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

// テスト結果が詳細に出力されないよう完全に抑制
// CI環境やDEBUGモード以外では出力を制御
if (process.env.CI !== 'true' && process.env.DEBUG !== 'true' && process.env.VERBOSE_MODE !== 'true') {
  const isQuietMode = process.env.QUIET_MODE === 'true';
  
  // 標準出力を完全に抑制
  if (isQuietMode) {
    // すべてのコンソール出力を抑制
    console.log = () => {};
    console.info = () => {};
    console.warn = () => {};
    console.error = () => {};
    
    // テスト実行時のconsole.groupも抑制
    console.group = () => {};
    console.groupEnd = () => {};
    console.groupCollapsed = () => {};
    
    // Jestの内部出力も抑制
    global._suppressConsole = true;
  } else {
    // 部分的に抑制（デフォルトモード）
    console.log = (...args) => {
      // テスト開始・終了メッセージと重要な警告のみ表示
      if (typeof args[0] === 'string' && (
          args[0].includes('PASS') || 
          args[0].includes('FAIL') || 
          args[0].includes('ERROR') ||
          args[0].startsWith('Test suite') ||
          args[0].includes('Test Suites:') ||
          args[0].includes('Tests:') ||
          args[0].includes('Snapshots:') ||
          args[0].includes('Time:')
        )) {
        global.originalConsole.log(...args);
      }
    };
    console.info = (...args) => {
      // 重要な情報のみ表示
      if (typeof args[0] === 'string' && (
          args[0].includes('IMPORTANT') ||
          args[0].includes('[INFO]')
        )) {
        global.originalConsole.info(...args);
      }
    };
  }
  
  // スタックトレースとエラーメッセージを抑制
  if (isQuietMode) {
    // Jestのスタックトレース表示を抑制する試み
    Error.prepareStackTrace = (_, stack) => '';
    
    // エラーログを書き換えるためのプロキシ
    const errorProxyHandler = {
      get(target, prop) {
        if (prop === 'stack') return '';
        return target[prop];
      }
    };
    
    // エラーオブジェクトのプロトタイプを変更
    const originalErrorCreate = Error.create;
    Error.create = function(message) {
      const err = originalErrorCreate.call(this, message);
      return new Proxy(err, errorProxyHandler);
    };
  }
}

// テストファイル内でのコンソール出力を抑制するヘルパー関数
global.suppressConsoleOutput = () => {
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error
  };
  
  // すべてのコンソール出力を抑制
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  
  // オリジナルのコンソール関数を復元する関数を返す
  return () => {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  };
};

// 警告とエラーは常に表示（デフォルトの状態）
console.warn = global.originalConsole.warn;
console.error = global.originalConsole.error;

// 日付のモック
jest.spyOn(global.Date, 'now').mockImplementation(() => 1715900000000); // 2025-05-18T10:00:00.000Z

// テスト前後の共通処理
beforeAll(async () => {
  if (process.env.DEBUG === 'true') {
    global.originalConsole.log('Starting test suite with environment:', process.env.NODE_ENV);
    global.originalConsole.log('Test configuration:');
    global.originalConsole.log('- RUN_E2E_TESTS:', process.env.RUN_E2E_TESTS);
    global.originalConsole.log('- USE_API_MOCKS:', process.env.USE_API_MOCKS);
    global.originalConsole.log('- SKIP_E2E_TESTS:', process.env.SKIP_E2E_TESTS);
  }
});

afterAll(async () => {
  if (process.env.DEBUG === 'true') {
    global.originalConsole.log('Test suite completed');
  }
  
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
