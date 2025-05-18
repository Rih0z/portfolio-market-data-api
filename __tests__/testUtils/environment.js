/**
 * ファイルパス: __tests__/testUtils/environment.js
 * 
 * テスト環境のセットアップと終了処理を提供します。
 * テスト開始前の環境変数設定やモックの設定、終了時のクリーンアップを行います。
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-15
 * @updated 2025-05-18
 */

'use strict';

// 必要なモジュールのインポート
const mockFs = require('mock-fs'); // ファイルシステムのモック化（使用する場合）
const dotenv = require('dotenv');

// 元の環境変数を保存
let originalEnv = null;

/**
 * テスト環境をセットアップする
 * - 環境変数の設定
 * - モックの初期化
 * - テスト用データベースのセットアップ（必要に応じて）
 */
const setupTestEnvironment = async () => {
  console.log('Setting up test environment...');
  
  // 元の環境変数を保存
  originalEnv = { ...process.env };
  
  // .envファイルがある場合は読み込む
  try {
    dotenv.config({ path: '.env.test' });
  } catch (error) {
    console.warn('No .env.test file found, using default test values');
  }
  
  // テスト用の環境変数を設定
  process.env.NODE_ENV = 'test';
  process.env.USE_API_MOCKS = 'true';
  process.env.API_TEST_URL = 'http://localhost:3000/dev';
  
  // API関連の環境変数
  process.env.YAHOO_FINANCE_API_KEY = 'test-api-key';
  process.env.EXCHANGE_RATE_API_KEY = 'test-api-key';
  
  // キャッシュ関連の環境変数
  process.env.CACHE_ENABLED = 'true';
  process.env.CACHE_TTL = '60'; // 1分（テスト用に短く）
  
  // タイムアウト設定
  process.env.JP_STOCK_SCRAPING_TIMEOUT = '5000'; // 5秒
  process.env.US_STOCK_SCRAPING_TIMEOUT = '5000'; // 5秒
  process.env.MUTUAL_FUND_TIMEOUT = '5000'; // 5秒
  
  // レート制限設定
  process.env.DATA_RATE_LIMIT_DELAY = '100'; // 100ミリ秒
  process.env.SCRAPING_RATE_LIMIT_DELAY = '100'; // 100ミリ秒
  
  // LocalStackのエンドポイント設定（必要に応じて）
  process.env.DYNAMODB_ENDPOINT = 'http://localhost:4566';
  
  // その他の共通モックをセットアップ（例：Date.nowのモック化）
  const fixedDate = new Date('2025-05-18T12:00:00Z');
  global.OriginalDate = Date;
  global.Date = class extends Date {
    constructor(...args) {
      if (args.length === 0) {
        super(fixedDate);
      } else {
        super(...args);
      }
    }
    
    static now() {
      return fixedDate.getTime();
    }
  };
  
  // ファイルシステムのモック化（必要に応じて）
  // mockFs({
  //   'test/fixtures': {
  //     'sample.json': '{"test": "data"}',
  //     'empty-dir': {}
  //   }
  // });
  
  console.log('Test environment setup complete');
};

/**
 * テスト環境を終了し、クリーンアップを行う
 * - モックのリセット
 * - 環境変数の復元
 * - 一時ファイルの削除など
 */
const teardownTestEnvironment = async () => {
  console.log('Tearing down test environment...');
  
  // モックのリセット
  jest.resetAllMocks();
  
  // ファイルシステムモックをリセット（使用している場合）
  // mockFs.restore();
  
  // 環境変数を元に戻す
  if (originalEnv) {
    process.env = { ...originalEnv };
  }
  
  // グローバルオブジェクトの復元
  if (global.OriginalDate) {
    global.Date = global.OriginalDate;
    delete global.OriginalDate;
  }
  
  console.log('Test environment teardown complete');
};

module.exports = {
  setupTestEnvironment,
  teardownTestEnvironment
};
