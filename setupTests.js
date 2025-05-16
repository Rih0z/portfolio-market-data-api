/**
 * ファイルパス: setupTests.js
 * 
 * Jestテスト実行前の統合セットアップファイル
 * __tests__/setup.js と jest.setup.js の内容を統合
 * 
 * @file setupTests.js
 * @author Portfolio Manager Team
 * @created 2025-05-22
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
  
  // テスト用キャッシュテーブル
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
  
  // テスト出力設定 - デフォルトでverboseモードを有効（デバッグのため）
  QUIET_MODE: process.env.QUIET_MODE || 'false',
  VERBOSE_MODE: process.env.VERBOSE_MODE || 'true',
  DEBUG: process.env.DEBUG || 'false',
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
try {
  const nock = require('nock');
  nock.disableNetConnect();
  nock.enableNetConnect('localhost'); // ローカル接続は許可
} catch (error) {
  console.warn('nockのロードに失敗しました。HTTP通信のモック化は利用できません。');
}

// コンソール出力をモック化（静かなテスト実行のため）
global.originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

// コンソール出力制御
const setupConsole = () => {
  // CI環境やDEBUGモードでは元の出力を維持
  if (process.env.CI === 'true' || process.env.DEBUG === 'true' || process.env.VERBOSE_MODE === 'true') {
    return;
  }

  // テスト中の標準出力を制御
  if (process.env.QUIET_MODE === 'true') {
    // 完全に静かなモード：重要な出力のみ
    console.log = (...args) => {
      // テスト結果のサマリーと重要なメッセージのみ表示
      if (typeof args[0] === 'string' && (
          args[0].includes('Test Suites:') ||
          args[0].includes('Tests:') ||
          args[0].includes('Time:') ||
          args[0].includes('IMPORTANT:') ||
          args[0].includes('ERROR:')
        )) {
        global.originalConsole.log(...args);
      }
    };
    console.info = () => {};
  } else {
    // 通常モード：テスト結果と特定のメッセージを表示
    console.log = (...args) => {
      // テスト開始・終了メッセージと結果を表示
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
};

// コンソール出力を設定
setupConsole();

// 警告とエラーは常に表示
console.warn = global.originalConsole.warn;
console.error = global.originalConsole.error;

// 日付のモック
jest.spyOn(global.Date, 'now').mockImplementation(() => 1715900000000); // 2025-05-18T10:00:00.000Z

// テスト前後の共通処理
beforeAll(async () => {
  if (process.env.DEBUG === 'true' || process.env.VERBOSE_MODE === 'true') {
    global.originalConsole.log('Starting test suite with environment:', process.env.NODE_ENV);
    global.originalConsole.log('Test configuration:');
    global.originalConsole.log('- RUN_E2E_TESTS:', process.env.RUN_E2E_TESTS);
    global.originalConsole.log('- USE_API_MOCKS:', process.env.USE_API_MOCKS);
    global.originalConsole.log('- SKIP_E2E_TESTS:', process.env.SKIP_E2E_TESTS);
  }
});

afterAll(async () => {
  if (process.env.DEBUG === 'true' || process.env.VERBOSE_MODE === 'true') {
    global.originalConsole.log('Test suite completed');
  }
  
  // Jestのタイマーを確実にクリーンアップ
  jest.useRealTimers();
  
  // nockのクリーンアップ
  try {
    const nock = require('nock');
    nock.cleanAll();
    nock.enableNetConnect();
  } catch (error) {
    // nockがない場合は無視
  }
});

// 各テスト後のクリーンアップ
afterEach(() => {
  // タイマーのクリーンアップ
  jest.clearAllTimers();
  
  // モックのリセット
  jest.resetAllMocks();
});

// テスト環境の診断ユーティリティ
global.diagnoseTestEnvironment = () => {
  return {
    nodeEnv: process.env.NODE_ENV,
    jestVersion: require('jest/package.json').version,
    dynamoEndpoint: process.env.DYNAMODB_ENDPOINT,
    mocks: {
      dynamoDb: !!global.__AWS_MOCK__,
      apiMocks: process.env.USE_API_MOCKS === 'true'
    },
    output: {
      quiet: process.env.QUIET_MODE === 'true',
      verbose: process.env.VERBOSE_MODE === 'true',
      debug: process.env.DEBUG === 'true'
    },
    date: new Date(global.Date.now())
  };
};

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
```

### jest.config.js (更新版)

```javascript
/**
 * ファイルパス: jest.config.js
 * 
 * Jest テスト設定ファイル
 * 
 * @file jest.config.js
 * @author Portfolio Manager Team
 * @created 2025-05-18
 * @updated 2025-05-22 - setupTests.jsを使用するように設定を最適化
 */

module.exports = {
  // テスト環境
  testEnvironment: 'node',
  
  // カバレッジの設定
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!**/node_modules/**'
  ],
  
  // カバレッジのしきい値 - 開発中はしきい値を緩和
  coverageThreshold: {
    global: {
      branches: 30,    // 初期目標: 30% (最終目標: 70%)
      functions: 40,   // 初期目標: 40% (最終目標: 80%)
      lines: 50,       // 初期目標: 50% (最終目標: 80%)
      statements: 50   // 初期目標: 50% (最終目標: 80%)
    },
    'src/utils/*.js': {
      branches: 40,    // 初期目標: 40% (最終目標: 80%)
      functions: 50,   // 初期目標: 50% (最終目標: 90%)
      lines: 50        // 初期目標: 50% (最終目標: 90%)
    },
    'src/services/*.js': {
      branches: 30,    // 初期目標: 30% (最終目標: 75%)
      functions: 40,   // 初期目標: 40% (最終目標: 85%)
      lines: 40        // 初期目標: 40% (最終目標: 85%)
    }
  },
  
  // テストファイルのパターン
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // 統合セットアップファイルを使用
  setupFiles: ['./setupTests.js'],
  
  // テストタイムアウト設定
  testTimeout: 15000,
  
  // モック設定
  moduleNameMapper: {
    '^axios$': '<rootDir>/__mocks__/axios.js'
  },
  
  // 並列実行設定 - システムリソースに基づいて調整
  maxWorkers: process.env.CI ? '2' : '50%',
  
  // テストの詳細レポート
  verbose: process.env.VERBOSE_MODE === 'true',
  
  // レポート形式
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results',
      outputName: 'junit.xml'
    }],
    ['jest-html-reporter', {
      pageTitle: 'Portfolio Market Data API テスト結果',
      outputPath: './test-results/test-report.html',
      includeFailureMsg: true
    }],
    ['<rootDir>/custom-reporter.js', {}]
  ],
  
  // キャッシュ設定
  cache: true,
  cacheDirectory: './.jest-cache',
  
  // 特定のテストフォルダーの優先度設定
  projects: [
    {
      displayName: 'unit',
      testMatch: ['**/__tests__/unit/**/*.js'],
      testPathIgnorePatterns: ['/node_modules/']
    },
    {
      displayName: 'integration',
      testMatch: ['**/__tests__/integration/**/*.js'],
      testPathIgnorePatterns: ['/node_modules/']
    },
    {
      displayName: 'e2e',
      testMatch: ['**/__tests__/e2e/**/*.js'],
      testPathIgnorePatterns: ['/node_modules/']
    }
  ]
};
`
