/**
 * ファイルパス: __tests__/testUtils/environment.js
 * 
 * テスト環境のセットアップと破棄を管理するユーティリティ
 * 
 * @file __tests__/testUtils/environment.js
 * @author Portfolio Manager Team
 * @updated Koki - 2025-05-12 バグ修正: エラーハンドリングを追加、テーブル作成を非同期に改善
 */
const { startDynamoDBLocal, stopDynamoDBLocal, createTestTable } = require('./dynamodbLocal');
const { setupMockServer, stopMockServer } = require('./mockServer');
const { mockExternalApis } = require('./apiMocks');

/**
 * テスト環境をセットアップする
 */
const setupTestEnvironment = async () => {
  try {
    // テスト用の環境変数をセット
    process.env.NODE_ENV = 'test';
    process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
    
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
    await setupMockServer().catch(error => {
      console.warn(`Mock server setup warning: ${error.message}`);
      console.warn('Continuing with tests, but API-dependent tests may fail');
    });
    
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
