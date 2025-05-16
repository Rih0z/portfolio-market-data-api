/**
 * ファイルパス: jest.config.js
 * 
 * Jest テスト設定ファイル
 * 統合版 - 各種設定を一つのファイルに集約
 * 
 * @file jest.config.js
 * @author Portfolio Manager Team
 * @created 2025-05-18
 * @updated 2025-05-15 - 設定を統合して最適化
 * @updated 2025-05-16 - タイムアウト設定のバグを修正
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
  
  // カバレッジのしきい値 - 開発中は緩和したしきい値を設定
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 25,
      lines: 30,
      statements: 30
    },
    'src/utils/*.js': {
      branches: 30,
      functions: 40,
      lines: 40
    },
    'src/services/*.js': {
      branches: 20,
      functions: 25,
      lines: 30
    }
  },
  
  // テストファイルのパターン
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // 統合セットアップファイルを使用
  setupFiles: ['./setupTests.js'],
  
  // タイムアウト設定 - 正しいオプション名に修正
  // 修正: testTimeout -> timeout に変更
  // テスト単位でタイムアウトを設定する場合は、個別のテストで jest.setTimeout() を使用
  timeout: 30000, // グローバルデフォルトタイムアウト
  
  // モック設定
  moduleNameMapper: {
    '^axios$': '<rootDir>/__mocks__/axios.js'
  },
  
  // 並列実行設定
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
    // カスタムレポーターを指定
    ['<rootDir>/custom-reporter.js', {}]
  ],
  
  // キャッシュ設定
  cache: true,
  cacheDirectory: './.jest-cache',
  
  // プロジェクト設定 - テスト種別ごとに異なる設定を適用
  projects: [
    {
      displayName: 'unit',
      testMatch: ['**/__tests__/unit/**/*.js'],
      testPathIgnorePatterns: ['/node_modules/'],
      // 修正: 正しいタイムアウトオプション名を使用
      // testTimeout -> timeoutではなく、jest.setTimeout()を使用
      setupFilesAfterEnv: ['<rootDir>/jest.setup.unit.js'] // このファイルでjest.setTimeout(15000)を設定
    },
    {
      displayName: 'integration',
      testMatch: ['**/__tests__/integration/**/*.js'],
      testPathIgnorePatterns: ['/node_modules/'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.integration.js'] // このファイルでjest.setTimeout(30000)を設定
    },
    {
      displayName: 'e2e',
      testMatch: ['**/__tests__/e2e/**/*.js'],
      testPathIgnorePatterns: ['/node_modules/'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.e2e.js'] // このファイルでjest.setTimeout(60000)を設定
    }
  ],
  
  // グローバル設定
  globals: {
    // カスタムレポーター設定をグローバルに追加
    __REPORTER_CONFIG__: {
      outputPath: './test-results',
      visualReportName: 'visual-report.html',
      generateChart: true,
      coverageTarget: process.env.COVERAGE_TARGET || 'initial',
      thresholds: {
        initial: {
          statements: 30,
          branches: 20, 
          functions: 25,
          lines: 30
        },
        mid: {
          statements: 60,
          branches: 50,
          functions: 60,
          lines: 60
        },
        final: {
          statements: 80,
          branches: 70,
          functions: 80,
          lines: 80
        }
      }
    }
  }
};
