/**
 * テスト環境のセットアップと破棄を管理するユーティリティ
 */
const { startDynamoDBLocal, stopDynamoDBLocal, createTestTable } = require('./dynamodbLocal');
const { setupMockServer, stopMockServer } = require('./mockServer');

/**
 * テスト環境をセットアップする
 */
const setupTestEnvironment = async () => {
  // テスト用の環境変数をセット
  process.env.NODE_ENV = 'test';
  process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
  
  // DynamoDB Localを起動
  await startDynamoDBLocal();
  
  // テスト用のテーブルを作成
  await createTestTable(process.env.SESSION_TABLE || 'test-sessions', { sessionId: 'S' });
  await createTestTable(`${process.env.DYNAMODB_TABLE_PREFIX || 'test-'}cache`, { key: 'S' });
  await createTestTable(`${process.env.DYNAMODB_TABLE_PREFIX || 'test-'}scraping-blacklist`, { symbol: 'S' });
  
  // モックサーバーをセットアップ
  await setupMockServer();
  
  console.log('Test environment is ready');
};

/**
 * テスト環境を破棄する
 */
const teardownTestEnvironment = async () => {
  // DynamoDB Localを停止
  stopDynamoDBLocal();
  
  // モックサーバーを停止
  stopMockServer();
  
  console.log('Test environment cleaned up');
};

module.exports = {
  setupTestEnvironment,
  teardownTestEnvironment
};
