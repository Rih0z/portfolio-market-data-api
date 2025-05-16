// __tests__/testUtils/environment.js
const { 
  startDynamoDBLocal, 
  stopDynamoDBLocal, 
  createTables,
  isDynamoDBRunning
} = require('./dynamodbLocal');
const { configureApiMocks } = require('./apiMocks');
const { startMockServer, stopMockServer } = require('./mockServer');
const { createDynamoDBClient } = require('../../src/utils/dynamoDbService');
const { startApiServer, stopApiServer } = require('./apiServer');

// Debug environment information
console.log('==== ENVIRONMENT SETUP DEBUG INFO ====');
console.log('現在の環境変数:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('USE_API_MOCKS:', process.env.USE_API_MOCKS);
console.log('RUN_E2E_TESTS:', process.env.RUN_E2E_TESTS);
console.log('FORCE_TESTS:', process.env.FORCE_TESTS);
console.log('API_TEST_URL:', process.env.API_TEST_URL);
console.log('================================');

/**
 * テスト環境をセットアップする
 */
const setupTestEnvironment = async () => {
  console.log('テスト環境のセットアップを開始します...');
  
  // Fix: Track setup progress for better error reporting
  const setupStatus = {
    dynamodb: false,
    mockApi: false,
    tables: false
  };
  
  try {
    // APIサーバーを起動（統合テスト・E2Eテスト用）
    if (!process.env.API_TEST_URL) {
      const apiServerUrl = await startApiServer();
      console.log(`✅ API server is running at ${apiServerUrl}`);
    } else {
      console.log(`✅ Using external API server at ${process.env.API_TEST_URL}`);
    }
    
    // モックAPIをセットアップ（API依存を除去）
    if (process.env.USE_API_MOCKS !== 'false') {
      console.log('モックAPIをセットアップします...');
      
      // モックサーバーを起動
      await startMockServer();
      
      // モックを設定
      await configureApiMocks();
      
      console.log('✅ Mock API setup completed');
      setupStatus.mockApi = true;
      
      // 環境変数を設定
      process.env.USE_API_MOCKS = 'true';
    }
    
    // DynamoDB Localを起動
    try {
      // Fix: Check if DynamoDB is already running
      const isRunning = await isDynamoDBRunning();
      if (isRunning) {
        console.log('DynamoDB Local is already running, skipping startup');
        setupStatus.dynamodb = true;
      } else {
        await startDynamoDBLocal();
        console.log('✅ DynamoDB Local started successfully');
        setupStatus.dynamodb = true;
      }
      
      // Wait a moment for DynamoDB to be fully ready
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (dynamoError) {
      console.error('❌ Failed to start DynamoDB Local:', dynamoError.message);
      // Continue with tests - some tests might still work without DynamoDB
    }
    
    // テスト用のテーブルを作成
    if (setupStatus.dynamodb) {
      console.log('Creating test tables sequentially for better reliability...');
      
      // DynamoDB クライアントを作成
      const dynamoDbClient = createDynamoDBClient();
      
      // Fix: Create tables one by one instead of all at once for better reliability
      const prefix = process.env.TABLE_PREFIX || 'test';
      let sessionTableCreated = false;
      let cacheTableCreated = false;
      let blacklistTableCreated = false;
      
      try {
        // Create sessions table
        sessionTableCreated = await createTables(dynamoDbClient, `${prefix}-sessions`);
      } catch (e) {
        console.warn(`Error creating sessions table: ${e.message}`);
      }
      
      try {
        // Create cache table
        cacheTableCreated = await createTables(dynamoDbClient, `${prefix}-cache`);
      } catch (e) {
        console.warn(`Error creating cache table: ${e.message}`);
      }
      
      try {
        // Create blacklist table
        blacklistTableCreated = await createTables(dynamoDbClient, `${prefix}-scraping-blacklist`);
      } catch (e) {
        console.warn(`Error creating blacklist table: ${e.message}`);
      }
      
      if (sessionTableCreated && cacheTableCreated && blacklistTableCreated) {
        console.log('✅ All test tables created successfully');
      } else {
        console.warn(`⚠️ Some test tables could not be created - Created: ` +
                    `sessions=${sessionTableCreated}, ` +
                    `cache=${cacheTableCreated}, ` +
                    `blacklist=${blacklistTableCreated}`);
        console.warn('Continuing with tests, but some table-dependent tests may fail');
      }
    } catch (tableError) {
      console.warn(`Test table creation error: ${tableError.message}`);
      console.warn('Continuing without test tables - some tests may fail');
    }
    
    console.log('✅ テスト環境のセットアップが完了しました');
    
    // Fix: Log final environment configuration
    console.log('==== FINAL ENVIRONMENT CONFIG ====');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('USE_API_MOCKS:', process.env.USE_API_MOCKS);
    console.log('RUN_E2E_TESTS:', process.env.RUN_E2E_TESTS);
    console.log('FORCE_TESTS:', process.env.FORCE_TESTS || false);
    console.log('================================');
    
    return {
      dynamodbStarted: setupStatus.dynamodb,
      mockApiSetup: setupStatus.mockApi,
      tablesCreated: setupStatus.tables
    };
  } catch (error) {
    console.error('❌ テスト環境のセットアップに失敗しました:', error);
    throw error;
  }
};

/**
 * テスト環境をクリーンアップする
 */
const cleanupTestEnvironment = async () => {
  console.log('テスト環境のクリーンアップを開始...');
  
  try {
    // DynamoDB Localを停止
    await stopDynamoDBLocal();
    
    // モックサーバーを停止
    await stopMockServer();
    
    // APIサーバーを停止
    await stopApiServer();
    
    console.log('✅ Test environment cleaned up');
    
    return true;
  } catch (error) {
    console.error('❌ Test environment cleanup failed:', error);
    return false;
  }
};

/**
 * テスト実行前の環境チェック
 * @returns {boolean} テストを実行すべきかどうか
 */
const shouldRunTests = () => {
  // 強制実行フラグがある場合は常に実行
  if (process.env.FORCE_TESTS === 'true') {
    return true;
  }
  
  // E2Eテストのみ実行フラグがある場合
  if (process.env.RUN_E2E_TESTS === 'true') {
    // E2Eテストの場合のみ実行
    const isE2ETest = process.env.JEST_WORKER_ID?.startsWith('e2e');
    return isE2ETest;
  }
  
  // デフォルトではすべてのテストを実行
  return true;
};

module.exports = {
  setupTestEnvironment,
  cleanupTestEnvironment,
  shouldRunTests
};
