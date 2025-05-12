/**
 * テスト環境のセットアップスクリプト
 * 
 * @file scripts/setup-test-env.js
 * @author Portfolio Manager Team
 * @created 2025-05-25
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { DynamoDBClient, CreateTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

// 色の定義
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

// ロガー
const logger = {
  info: (message) => console.log(`${colors.blue}[INFO]${colors.reset} ${message}`),
  success: (message) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`),
  warn: (message) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`),
  error: (message) => console.log(`${colors.red}[ERROR]${colors.reset} ${message}`)
};

// DynamoDB Localのプロセス参照
let dynamodbProcess = null;

/**
 * DynamoDB Localをダウンロード
 */
async function downloadDynamoDBLocal() {
  const dynamodbDir = path.resolve(__dirname, '../dynamodb-local');
  const jarFile = path.resolve(dynamodbDir, 'DynamoDBLocal.jar');
  
  // 既に存在する場合はスキップ
  if (fs.existsSync(jarFile)) {
    logger.info('DynamoDB Localはすでにダウンロードされています');
    return;
  }
  
  logger.info('DynamoDB Localをダウンロードしています...');
  
  // ディレクトリの作成
  if (!fs.existsSync(dynamodbDir)) {
    fs.mkdirSync(dynamodbDir, { recursive: true });
  }
  
  // カレントディレクトリを一時的に変更
  const prevDir = process.cwd();
  process.chdir(dynamodbDir);
  
  try {
    // curlでダウンロード
    await new Promise((resolve, reject) => {
      const curl = spawn('curl', [
        '-O',
        'https://d1ni2b6xgvw0s0.cloudfront.net/dynamodb_local_latest.tar.gz'
      ]);
      
      curl.stderr.on('data', (data) => {
        console.log(data.toString());
      });
      
      curl.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`curl exited with code ${code}`));
        } else {
          resolve();
        }
      });
    });
    
    // tarで解凍
    await new Promise((resolve, reject) => {
      const tar = spawn('tar', [
        '-xvzf',
        'dynamodb_local_latest.tar.gz'
      ]);
      
      tar.stderr.on('data', (data) => {
        console.log(data.toString());
      });
      
      tar.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`tar exited with code ${code}`));
        } else {
          resolve();
        }
      });
    });
    
    // tarballを削除
    fs.unlinkSync('dynamodb_local_latest.tar.gz');
    
    logger.success('DynamoDB Localのダウンロードと解凍が完了しました');
  } catch (error) {
    logger.error(`DynamoDB Localのダウンロード中にエラーが発生しました: ${error.message}`);
    throw error;
  } finally {
    // カレントディレクトリを元に戻す
    process.chdir(prevDir);
  }
}

/**
 * DynamoDB Localを起動
 */
async function startDynamoDBLocal() {
  const dynamodbDir = path.resolve(__dirname, '../dynamodb-local');
  const jarFile = path.resolve(dynamodbDir, 'DynamoDBLocal.jar');
  
  if (!fs.existsSync(jarFile)) {
    logger.error('DynamoDBLocal.jarが見つかりません。ダウンロードを実行してください。');
    throw new Error('DynamoDBLocal.jar not found');
  }
  
  logger.info('DynamoDB Localを起動しています...');
  
  return new Promise((resolve, reject) => {
    dynamodbProcess = spawn('java', [
      '-Djava.library.path=./dynamodb-local/DynamoDBLocal_lib',
      '-jar',
      './dynamodb-local/DynamoDBLocal.jar',
      '-inMemory',
      '-port',
      '8000'
    ]);
    
    dynamodbProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('CorsParams')) {
        logger.success('DynamoDB Localが起動しました (ポート 8000)');
        resolve();
      }
    });
    
    dynamodbProcess.stderr.on('data', (data) => {
      logger.warn(`DynamoDB Local: ${data.toString()}`);
    });
    
    dynamodbProcess.on('error', (error) => {
      logger.error(`DynamoDB Localの起動に失敗しました: ${error.message}`);
      reject(error);
    });
    
    // 10秒後にタイムアウト
    setTimeout(() => {
      if (dynamodbProcess) {
        logger.success('DynamoDB Localが起動しました (タイムアウトにより自動判定)');
        resolve();
      }
    }, 10000);
  });
}

/**
 * クリーンアップ処理
 */
function cleanup() {
  if (dynamodbProcess) {
    logger.info('DynamoDB Localを停止しています...');
    dynamodbProcess.kill();
    dynamodbProcess = null;
  }
}

/**
 * テスト用テーブルの作成
 */
async function createTestTables() {
  logger.info('テスト用テーブルを作成しています...');
  
  const client = new DynamoDBClient({
    region: 'us-east-1',
    endpoint: 'http://localhost:8000',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test'
    }
  });
  
  // テーブル一覧の取得
  const listTablesCommand = new ListTablesCommand({});
  const listResult = await client.send(listTablesCommand);
  const existingTables = listResult.TableNames || [];
  
  // テスト用テーブルの定義
  const tableDefinitions = [
    {
      TableName: 'test-portfolio-market-data-sessions',
      KeySchema: [
        { AttributeName: 'sessionId', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'sessionId', AttributeType: 'S' }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      },
      TimeToLiveSpecification: {
        AttributeName: 'ttl',
        Enabled: true
      }
    },
    {
      TableName: 'test-portfolio-market-data-cache',
      KeySchema: [
        { AttributeName: 'key', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'key', AttributeType: 'S' }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      },
      TimeToLiveSpecification: {
        AttributeName: 'ttl',
        Enabled: true
      }
    },
    {
      TableName: 'test-portfolio-market-data-scraping-blacklist',
      KeySchema: [
        { AttributeName: 'symbol', KeyType: 'HASH' }
      ],
      AttributeDefinitions: [
        { AttributeName: 'symbol', AttributeType: 'S' }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    }
  ];
  
  // テーブルの作成
  for (const tableDef of tableDefinitions) {
    if (existingTables.includes(tableDef.TableName)) {
      logger.warn(`テーブル ${tableDef.TableName} は既に存在します`);
      continue;
    }
    
    try {
      // TimeToLiveSpecificationは初期テーブル作成時には含められないため削除
      const createParams = { ...tableDef };
      delete createParams.TimeToLiveSpecification;
      
      const createTableCommand = new CreateTableCommand(createParams);
      await client.send(createTableCommand);
      logger.success(`テーブル ${tableDef.TableName} を作成しました`);
    } catch (error) {
      logger.error(`テーブル ${tableDef.TableName} の作成中にエラーが発生しました: ${error.message}`);
    }
  }
  
  logger.success('テスト用テーブルの作成が完了しました');
}

/**
 * メイン処理
 */
async function main() {
  try {
    // DynamoDB Localのダウンロード
    await downloadDynamoDBLocal();
    
    // DynamoDB Localの起動
    await startDynamoDBLocal();
    
    // テスト用テーブルの作成
    await createTestTables();
    
    logger.success('テスト環境のセットアップが完了しました！');
    logger.info('テストを実行するには: npm test');
    logger.info('特定のテストを実行するには: npm run test:unit/integration/e2e');
    
    // プロセスを終了せずに待機（Ctrl+Cで終了できる）
    logger.info('Ctrl+Cで終了します...');
  } catch (error) {
    logger.error(`セットアップ中にエラーが発生しました: ${error.message}`);
    cleanup();
    process.exit(1);
  }
}

// クリーンアップハンドラーを設定
process.on('SIGINT', () => {
  logger.info('プロセスが中断されました...');
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('プロセスが終了要求を受け取りました...');
  cleanup();
  process.exit(0);
});

// コマンドラインオプションの解析
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  テスト環境セットアップスクリプト
  
  使用方法:
    node scripts/setup-test-env.js [options]
  
  オプション:
    --help, -h      このヘルプを表示
    --download-only DynamoDB Localのダウンロードのみ行う
    --tables-only   テーブル作成のみ行う
  `);
  process.exit(0);
} else if (args.includes('--download-only')) {
  downloadDynamoDBLocal()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else if (args.includes('--tables-only')) {
  createTestTables()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  main();
}
