/**
 * Jest テスト設定ファイル
 * 
 * @file jest.config.js
 * @author Portfolio Manager Team
 * @created 2025-05-18
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
  
  // カバレッジのしきい値
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    },
    'src/utils/*.js': {
      branches: 80,
      functions: 90,
      lines: 90
    },
    'src/services/*.js': {
      branches: 75,
      functions: 85,
      lines: 85
    }
  },
  
  // テストファイルのパターン
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // 開始前に実行するファイル
  setupFiles: ['./jest.setup.js'],
  
  // グローバル設定
  setupFilesAfterEnv: ['./jest.setupAfterEnv.js'],
  
  // テストタイムアウト設定
  testTimeout: 10000,
  
  // モック設定
  moduleNameMapper: {
    '^axios$': '<rootDir>/__mocks__/axios.js'
  },
  
  // 並列実行設定
  maxWorkers: '50%',
  
  // テストの詳細レポート
  verbose: true,
  
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
    }]
  ],
  
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
