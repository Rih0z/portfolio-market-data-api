/**
 * ファイルパス: __tests__/testUtils/environment.js
 * 
 * テスト環境のセットアップと破棄を管理するユーティリティ
 * 
 * @file __tests__/testUtils/environment.js
 * @author Koki Riho
 * @created 2025-05-12
 * @updated 2025-05-12 修正: APIサーバー自動起動機能の追加、E2Eテスト実行条件の改善
 */
const { startDynamoDBLocal, stopDynamoDBLocal, createTestTable } = require('./dynamodbLocal');
const { setupMockServer, stopMockServer } = require('./mockServer');
const { startApiServer, stopApiServer } = require('./apiServer');
const { mockExternalApis } = require('./apiMocks');
const axios = require('axios');

/**
 * テスト環境をセットアップする
 */
const setupTestEnvironment = async () => {
  try {
    // テスト用の環境変数をセット
    process.env.NODE_ENV = 'test';
    process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
    
    // E2Eテストを実行する場合、APIサーバーを起動
    if (process.env.RUN_E2E_TESTS === 'true') {
      try {
        await startApiServer();
        console.log('✅ API server started successfully for E2E tests');
      } catch (apiError) {
        console.warn(`⚠️ Could not start API server: ${apiError.message}`);
        console.warn('E2E tests that require a real API server will be skipped.');
        
        if (process.env.USE_API_MOCKS !== 'true') {
          console.warn('Set USE_API_MOCKS=true to run E2E tests with mock API server');
        }
      }
    } else {
      // API サーバーが稼働しているか確認（手動起動の場合）
      const apiBaseUrl = process.env.API_TEST_URL || 'http://localhost:3000';
      try {
        await axios.get(`${apiBaseUrl}/health`, { timeout: 2000 });
        console.log(`✅ API server is running at ${apiBaseUrl}`);
      } catch (apiError) {
        console.warn(`⚠️ API server at ${apiBaseUrl} may not be running or not responding.`);
        console.warn('If you plan to run E2E tests, please either:');
        console.warn('  1. Start the API server manually: npm run dev');
        console.warn('  2. Set RUN_E2E_TESTS=true to auto-start the API server');
        console.warn('  3. Set USE_API_MOCKS=true to use mock API server');
        console.warn('Some tests will fail if the API server is not running.');
      }
    }
    
    // DynamoDB Localを起動
    await startDynamoDBLocal().catch(error => {
      console.warn(`DynamoDB Local startup warning: ${error.message}`);
      console.warn('Continuing with tests, but DynamoDB-dependent tests may fail');
    });
    
    // テスト用のテーブルを作成 - 並列に処理して高速化
    const tableCreationPromises = [
      createTestTable(process.env.SESSION_TABLE || 'test-sessions', { sessionId: 'S' }),
      createTestTable(`${process.env.DYNAMODB_TABLE_PREFIX || 'test-'}cache`, { key: 'S' }),
      createTestTable(`${process.env.DYNAMODB_TABLE_PREFIX || 'test-'}scraping-blacklist`, { symbol: 'S' })
    ];
    
    // すべてのテーブル作成が完了するか、エラーが発生するまで待機
    await Promise.allSettled(tableCreationPromises);
    
    // モックサーバーをセットアップ
    if (process.env.USE_API_MOCKS === 'true') {
      try {
        await setupMockServer();
        console.log('✅ Mock API server setup complete');
      } catch (mockError) {
        console.warn(`Mock server setup warning: ${mockError.message}`);
        console.warn('Continuing with tests, but API-dependent tests may fail');
      }
    }
    
    // 外部APIをモック化
    mockExternalApis();
    
    console.log('Test environment is ready');
  } catch (error) {
    console.error(`Test environment setup error: ${error.message}`);
    console.warn('Continuing with tests, but some tests may fail');
  }
};

/**
 * テスト環境を破棄する
 */
const teardownTestEnvironment = async () => {
  try {
    // APIサーバーを停止（自動起動した場合のみ）
    if (process.env.RUN_E2E_TESTS === 'true') {
      stopApiServer();
    }
    
    // DynamoDB Localを停止
    stopDynamoDBLocal();
    
    // モックサーバーを停止
    stopMockServer();
    
    console.log('Test environment cleaned up');
  } catch (error) {
    console.error(`Test environment teardown error: ${error.message}`);
  }
};

module.exports = {
  setupTestEnvironment,
  teardownTestEnvironment
};
