/**
 * ファイルパス: scripts/setup-test-env.js
 * 
 * テスト環境セットアップスクリプト
 * 
 * @author Koki Riho
 * @created 2025-05-12
 * @updated 2025-05-13 AWS SDK v3対応、テーブル作成とDynamoDBLocalの起動順序を改善
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { DynamoDBClient, CreateTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

// 色の設定
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// ログ関数
const log = {
  info: message => console.log(`${colors.blue}[INFO]${colors.reset} ${message}`),
  success: message => console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`),
  warning: message => console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`),
  error: message => console.log(`${colors.red}[ERROR]${colors.reset} ${message}`)
};

// DynamoDB Local の起動
async function startDynamoDBLocal() {
  log.info('DynamoDB Local の起動を確認中...');
  
  try {
    // DynamoDB Local が起動しているか確認
    const isRunning = execSync('lsof -i :8000 | grep LISTEN', { stdio: 'pipe' }).toString().trim();
    
    if (isRunning) {
      log.success('DynamoDB Local はすでに起動しています');
      return true;
    }
  } catch (error) {
    // コマンドが失敗 = DynamoDB Local が起動していない
    log.info('DynamoDB Local を起動します...');
    
    try {
      // 非同期で DynamoDB Local を起動（バックグラウンドプロセス）
      const child = require('child_process').spawn('java', [
        '-Djava.library.path=./dynamodb-local/DynamoDBLocal_lib',
        '-jar',
        './dynamodb-local/DynamoDBLocal.jar',
        '-inMemory',
        '-port',
        '8000'
      ], {
        detached: true,
        stdio: 'ignore'
      });
      
      // 親プロセスから切り離す
      child.unref();
      
      // 起動を待機
      log.info('DynamoDB Local の起動を待機しています...');
      execSync('sleep 3'); // 起動を待つために少し長くスリープ
      
      try {
        // 起動確認
        execSync('curl -s http://localhost:8000', { stdio: 'pipe' });
        log.success('DynamoDB Local の起動が完了しました');
        return true;
      } catch (error) {
        log.error('DynamoDB Local の起動確認に失敗しました');
        return false;
      }
    } catch (error) {
      log.error(`DynamoDB Local の起動に失敗しました: ${error.message}`);
      log.warning('テストはモックモードで実行されます');
      return false;
    }
  }
}

// テストに必要なディレクトリの作成
function createTestDirectories() {
  log.info('テストディレクトリを設定しています...');
  
  const directories = [
    './test-results',
    './coverage'
  ];
  
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log.success(`ディレクトリを作成しました: ${dir}`);
    }
  });
}

// 必要なテーブルの作成
async function createRequiredTables() {
  log.info('DynamoDB テーブルを作成しています...');
  
  try {
    const client = new DynamoDBClient({
      region: 'us-east-1',
      endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
      }
    });
    
    // 既存のテーブルを確認
    const { TableNames } = await client.send(new ListTablesCommand({}));
    log.info(`現在のテーブル一覧: ${TableNames?.join(', ') || '(なし)'}`);
    
    // 必要なテーブルの定義
    const tables = [
      {
        name: process.env.SESSION_TABLE || 'test-sessions',
        keySchema: [{ AttributeName: 'sessionId', KeyType: 'HASH' }],
        attributeDefinitions: [{ AttributeName: 'sessionId', AttributeType: 'S' }]
      },
      {
        name: `${process.env.DYNAMODB_TABLE_PREFIX || 'test-'}cache`,
        keySchema: [{ AttributeName: 'key', KeyType: 'HASH' }],
        attributeDefinitions: [{ AttributeName: 'key', AttributeType: 'S' }]
      },
      {
        name: `${process.env.DYNAMODB_TABLE_PREFIX || 'test-'}scraping-blacklist`,
        keySchema: [{ AttributeName: 'symbol', KeyType: 'HASH' }],
        attributeDefinitions: [{ AttributeName: 'symbol', AttributeType: 'S' }]
      }
    ];
    
    // 各テーブルを必要に応じて作成
    for (const table of tables) {
      if (TableNames && !TableNames.includes(table.name)) {
        try {
          await client.send(new CreateTableCommand({
            TableName: table.name,
            KeySchema: table.keySchema,
            AttributeDefinitions: table.attributeDefinitions,
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5
            }
          }));
          log.success(`テーブルを作成しました: ${table.name}`);
        } catch (error) {
          if (error.name === 'ResourceInUseException') {
            log.info(`テーブルはすでに存在します: ${table.name}`);
          } else {
            log.error(`テーブル作成エラー - ${table.name}: ${error.message}`);
          }
        }
      } else {
        log.info(`テーブルはすでに存在します: ${table.name}`);
      }
    }
    
    return true;
  } catch (error) {
    log.error(`テーブル作成時にエラーが発生しました: ${error.message}`);
    return false;
  }
}

// テスト環境変数の設定
function setupEnvironmentVariables() {
  log.info('テスト環境変数を設定しています...');
  
  // .env.test ファイルが存在するか確認
  const envFile = path.join(process.cwd(), '.env.test');
  
  if (fs.existsSync(envFile)) {
    log.success('.env.test ファイルが見つかりました');
  } else {
    // .env.test ファイルがなければ作成
    log.warning('.env.test ファイルが見つかりません。デフォルト設定で作成します。');
    
    const defaultEnv = `# テスト環境用の環境変数
NODE_ENV=test
DYNAMODB_ENDPOINT=http://localhost:8000
SESSION_TABLE=test-sessions
DYNAMODB_TABLE_PREFIX=test-
API_TEST_URL=http://localhost:3000/dev
SKIP_E2E_TESTS=false
SKIP_DYNAMODB_CHECKS=true
`;
    
    fs.writeFileSync(envFile, defaultEnv);
    log.success('.env.test ファイルを作成しました');
  }
  
  // テスト実行用の環境変数を設定
  process.env.NODE_ENV = 'test';
  process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
  process.env.SESSION_TABLE = 'test-sessions';
  process.env.DYNAMODB_TABLE_PREFIX = 'test-';
  // DynamoDBチェックをスキップする設定を追加（テスト環境では特に重要）
  process.env.SKIP_DYNAMODB_CHECKS = 'true';
}

// テストセットアップの実行
async function setupTestEnvironment() {
  log.info('テスト環境のセットアップを開始します...');
  
  // ディレクトリの作成
  createTestDirectories();
  
  // 環境変数の設定
  setupEnvironmentVariables();
  
  // DynamoDB Local の起動
  const dynamoDBStatus = await startDynamoDBLocal();
  
  // テーブルの作成（DynamoDBが起動している場合のみ）
  if (dynamoDBStatus) {
    // 少し待機してからテーブル作成を実行（DynamoDB Local の初期化を待つ）
    await new Promise(resolve => setTimeout(resolve, 1000));
    await createRequiredTables();
  }
  
  // 結果の出力
  log.info('テスト環境のセットアップが完了しました');
  log.info('テスト実行の準備が整いました');
  
  if (!dynamoDBStatus) {
    log.warning('DynamoDB Local が起動していません。一部のテストが失敗する可能性があります。');
    log.warning('DynamoDB に依存するテストは USE_API_MOCKS=true を設定して実行してください。');
  }
}

// スクリプトの実行
setupTestEnvironment().catch(error => {
  log.error(`テスト環境のセットアップ中にエラーが発生しました: ${error.message}`);
  process.exit(1);
});
