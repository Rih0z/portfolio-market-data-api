/**
 * ファイルパス: __tests__/testUtils/environment.js
 * 
 * テスト環境のセットアップと破棄を管理するユーティリティ
 * 
 * @author Koki Riho
 * @created 2025-05-12
 * @updated 2025-05-12 修正: APIサーバー自動起動機能の追加、E2Eテスト実行条件の改善
 * @updated 2025-05-14 修正: 環境変数の拡張サポート、デバッグログの追加
 * @updated 2025-05-15 修正: モック初期化プロセスの改善、エラーハンドリング強化
 * @updated 2025-05-16 修正: テーブル作成のエラーハンドリングと安定性の向上
 */
const { startDynamoDBLocal, stopDynamoDBLocal, createTestTable } = require('./dynamodbLocal');
const { setupMockServer, stopMockServer } = require('./mockServer');
const { startApiServer, stopApiServer } = require('./apiServer');
const { mockExternalApis, setupFallbackResponses } = require('./apiMocks');
const axios = require('axios');

// デバッグログを表示
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
 * 修正: テーブル作成の順序とエラーハンドリングを改善
 */
const setupTestEnvironment = async () => {
  try {
    console.log('テスト環境のセットアップを開始します...');
    
    // テスト用の環境変数をセット
    process.env.NODE_ENV = 'test';
    process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
    
    // 強制実行フラグをサポート
    if (process.env.FORCE_TESTS !== 'true' && process.env.FORCE_TESTS !== 'false') {
      process.env.FORCE_TESTS = 'false';
    }
    
    // モック使用フラグを設定（優先度：環境変数 > デフォルト）
    if (process.env.USE_API_MOCKS === undefined || process.env.USE_API_MOCKS === '') {
      process.env.USE_API_MOCKS = 'true'; // テスト安定性のため、デフォルトでモックを有効化
    }
    
    // 変数にも値を持たせておく（参照の容易さのため）
    const useMocks = process.env.USE_API_MOCKS === 'true';
    
    // E2Eテストを実行する場合、APIサーバーを起動
    if (process.env.RUN_E2E_TESTS === 'true') {
      try {
        await startApiServer();
        console.log('✅ API server started successfully for E2E tests');
      } catch (apiError) {
        console.warn(`⚠️ Could not start API server: ${apiError.message}`);
        console.warn('E2E tests that require a real API server will be skipped.');
        
        if (!useMocks) {
          console.warn('Setting USE_API_MOCKS=true to allow tests to run with mock API server');
          process.env.USE_API_MOCKS = 'true';
        }
      }
    } else {
      // API サーバーが稼働しているか確認（手動起動の場合）
      const apiBaseUrl = process.env.API_TEST_URL || 'http://localhost:3000';
      try {
        await axios.get(`${apiBaseUrl}/health`, { timeout: 5000 });
        console.log(`✅ API server is running at ${apiBaseUrl}`);
      } catch (apiError) {
        console.warn(`⚠️ API server at ${apiBaseUrl} may not be running or not responding: ${apiError.message}`);
        
        if (useMocks) {
          console.log('✅ Using mock APIs instead of real server');
        } else {
          console.warn('If you plan to run E2E tests, please either:');
          console.warn('  1. Start the API server manually: npm run dev');
          console.warn('  2. Set RUN_E2E_TESTS=true to auto-start the API server');
          console.warn('  3. Set USE_API_MOCKS=true to use mock API server');
          console.warn('  4. Set FORCE_TESTS=true to run tests regardless of server status');
          
          // 開発者による設定がない場合は、自動的にモックを有効化
          if (process.env.FORCE_TESTS !== 'true' && process.env.USE_API_MOCKS !== 'true') {
            console.log('Auto-enabling USE_API_MOCKS=true to allow tests to run');
            process.env.USE_API_MOCKS = 'true';
          }
        }
      }
    }
    
    // モックAPIをセットアップ（USE_API_MOCKSが有効な場合）
    if (process.env.USE_API_MOCKS === 'true') {
      console.log('モックAPIをセットアップします...');
      try {
        // 1. モックサーバーをセットアップ
        await setupMockServer().catch(error => {
          console.warn(`Mock server setup warning: ${error.message}`);
          console.warn('Will continue with other mock setup');
        });
        
        // 2. 外部APIモックを設定
        await mockExternalApis();
        
        // 3. フォールバックレスポンスも設定（未処理リクエスト対応）
        await setupFallbackResponses();
        
        console.log('✅ Mock API setup completed');
      } catch (mockError) {
        console.warn(`Mock setup warning: ${mockError.message}`);
        console.warn('Will attempt to continue with tests using available mocks');
      }
    }
    
    // DynamoDB Localを起動 - まず最初に実行して利用可能にする
    try {
      await startDynamoDBLocal();
      console.log('✅ DynamoDB Local started successfully');
      
      // 短い待機を追加して確実に起動するようにする
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (dbError) {
      console.warn(`DynamoDB Local startup warning: ${dbError.message}`);
      console.warn('Continuing with tests, but DynamoDB-dependent tests may fail');
    }
    
    // テスト用のテーブルを作成 - 逐次処理に変更して信頼性を高める
    try {
      // テーブル名を明示的に設定
      const sessionTableName = process.env.SESSION_TABLE || 'test-sessions';
      const cacheTableName = `${process.env.DYNAMODB_TABLE_PREFIX || 'test-'}cache`;
      const blacklistTableName = `${process.env.DYNAMODB_TABLE_PREFIX || 'test-'}scraping-blacklist`;
      
      // 逐次処理でテーブルを作成 - エラーが発生しても全体が失敗しないようにする
      console.log('Creating test tables sequentially for better reliability...');
      
      // セッションテーブルを作成
      let sessionTableCreated = false;
      try {
        sessionTableCreated = await createTestTable(sessionTableName, { sessionId: 'S' });
        if (sessionTableCreated) {
          console.log(`✅ Created session table: ${sessionTableName}`);
        }
      } catch (tableError) {
        console.warn(`Session table creation error: ${tableError.message}`);
      }
      
      // キャッシュテーブルを作成
      let cacheTableCreated = false;
      try {
        cacheTableCreated = await createTestTable(cacheTableName, { key: 'S' });
        if (cacheTableCreated) {
          console.log(`✅ Created cache table: ${cacheTableName}`);
        }
      } catch (tableError) {
        console.warn(`Cache table creation error: ${tableError.message}`);
      }
      
      // ブラックリストテーブルを作成
      let blacklistTableCreated = false;
      try {
        blacklistTableCreated = await createTestTable(blacklistTableName, { symbol: 'S' });
        if (blacklistTableCreated) {
          console.log(`✅ Created blacklist table: ${blacklistTableName}`);
        }
      } catch (tableError) {
        console.warn(`Blacklist table creation error: ${tableError.message}`);
      }
      
      // 作成結果を表示
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
      console.warn('Continuing with tests, but table-dependent tests may fail');
    }
    
    console.log('✅ テスト環境のセットアップが完了しました');
    
    // 最終的な環境設定を表示
    console.log('==== FINAL ENVIRONMENT CONFIG ====');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('USE_API_MOCKS:', process.env.USE_API_MOCKS);
    console.log('RUN_E2E_TESTS:', process.env.RUN_E2E_TESTS);
    console.log('FORCE_TESTS:', process.env.FORCE_TESTS);
    console.log('================================');
    
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
    console.log('テスト環境のクリーンアップを開始...');
    
    // APIサーバーを停止（自動起動した場合のみ）
    if (process.env.RUN_E2E_TESTS === 'true') {
      stopApiServer();
    }
    
    // DynamoDB Localを停止
    stopDynamoDBLocal();
    
    // モックサーバーを停止
    if (process.env.USE_API_MOCKS === 'true') {
      stopMockServer();
    }
    
    console.log('✅ Test environment cleaned up');
  } catch (error) {
    console.error(`Test environment teardown error: ${error.message}`);
  }
};

module.exports = {
  setupTestEnvironment,
  teardownTestEnvironment
};
