/**
 * テスト環境セットアップスクリプト
 * DynamoDB Localの起動、テーブル作成、環境変数設定を自動化
 * コンソール出力を最小限にして、重要な情報のみを表示するように最適化
 * 
 * @file scripts/setup-test-env.js
 * @updated 2025-05-15 - エラーハンドリング強化、設定の最適化
 * @updated 2025-05-21 - コンソール出力を最小限にして、ログファイル出力を強化
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { DynamoDBClient, CreateTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

// ログディレクトリの設定
const LOG_DIR = './test-results/logs';
const LOG_FILE = `${LOG_DIR}/setup-env-${new Date().toISOString().replace(/:/g, '-')}.log`;

// ログディレクトリが存在しない場合は作成
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 環境変数からQuietModeとVerboseModeを取得
const QUIET_MODE = process.env.QUIET_MODE === 'true';
const VERBOSE_MODE = process.env.VERBOSE_MODE === 'true';
const DEBUG_MODE = process.env.DEBUG === 'true';

// ログファイルの初期化
fs.writeFileSync(LOG_FILE, `=== Test Environment Setup: ${new Date().toISOString()} ===\n\n`);

// 色の設定
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

// ロガー関数
function logToFile(message) {
  fs.appendFileSync(LOG_FILE, `${message}\n`);
}

// ログ関数
const log = {
  // コンソールとファイルの両方に出力
  info: message => {
    console.log(`${colors.blue}[INFO]${colors.reset} ${message}`);
    logToFile(`[INFO] ${message}`);
  },
  success: message => {
    console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`);
    logToFile(`[SUCCESS] ${message}`);
  },
  warning: message => {
    console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`);
    logToFile(`[WARNING] ${message}`);
  },
  error: message => {
    console.log(`${colors.red}[ERROR]${colors.reset} ${message}`);
    logToFile(`[ERROR] ${message}`);
  },
  step: message => {
    console.log(`${colors.cyan}[STEP]${colors.reset} ${message}`);
    logToFile(`[STEP] ${message}`);
  },
  // ファイルにのみ出力（詳細情報）
  verbose: message => {
    if (VERBOSE_MODE || DEBUG_MODE) {
      console.log(`${colors.magenta}[VERBOSE]${colors.reset} ${message}`);
    }
    logToFile(`[VERBOSE] ${message}`);
  },
  debug: message => {
    if (DEBUG_MODE) {
      console.log(`${colors.magenta}[DEBUG]${colors.reset} ${message}`);
    }
    logToFile(`[DEBUG] ${message}`);
  }
};

// 静音モードで使用するログ関数
const quietLog = {
  info: message => {
    logToFile(`[INFO] ${message}`);
  },
  success: message => {
    console.log(`${colors.green}✓${colors.reset} ${message}`);
    logToFile(`[SUCCESS] ${message}`);
  },
  warning: message => {
    console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
    logToFile(`[WARNING] ${message}`);
  },
  error: message => {
    console.log(`${colors.red}✗${colors.reset} ${message}`);
    logToFile(`[ERROR] ${message}`);
  },
  step: message => {
    console.log(`${colors.cyan}➤${colors.reset} ${message}`);
    logToFile(`[STEP] ${message}`);
  },
  verbose: message => {
    logToFile(`[VERBOSE] ${message}`);
  },
  debug: message => {
    logToFile(`[DEBUG] ${message}`);
  }
};

// 使用するログ関数を決定
const logger = QUIET_MODE ? quietLog : log;

/**
 * DynamoDB Local が起動しているかチェック
 * @returns {boolean} 起動している場合はtrue
 */
function isDynamoDBRunning() {
  try {
    // ポートが開いているか確認
    if (process.platform === 'win32') {
      // Windows環境
      return execSync('netstat -ano | findstr "8000"', { stdio: 'pipe' }).toString().includes('LISTENING');
    } else {
      // Unix系環境
      return execSync('lsof -i :8000 | grep LISTEN', { stdio: 'pipe' }).toString().trim() !== '';
    }
  } catch (error) {
    logger.debug(`DynamoDB check error: ${error.message}`);
    return false;
  }
}

/**
 * DynamoDB Local の起動
 * @returns {Promise<boolean>} 起動成功時はtrue
 */
async function startDynamoDBLocal() {
  logger.step('DynamoDB Local の確認・起動...');
  
  // 既に起動しているか確認
  if (isDynamoDBRunning()) {
    logger.success('DynamoDB Local はすでに起動しています');
    return true;
  }
  
  // DynamoDBのjarファイルが存在するか確認
  const jarPath = './dynamodb-local/DynamoDBLocal.jar';
  if (!fs.existsSync(jarPath)) {
    logger.warning(`DynamoDB Local の jar ファイルが見つかりません: ${jarPath}`);
    
    if (QUIET_MODE) {
      // 静音モードではモック動作に自動設定
      logger.info('モックモードで続行します');
      return false;
    }
    
    logger.info('DynamoDB Local をダウンロードしますか？ (y/n)');
    
    // ユーザーの入力を待つ（同期的に）
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      readline.question('> ', resolve);
    });
    readline.close();
    
    if (answer.toLowerCase() === 'y') {
      logger.info('DynamoDB Local をダウンロードしています...');
      
      try {
        // dynamodb-local ディレクトリを作成
        if (!fs.existsSync('./dynamodb-local')) {
          fs.mkdirSync('./dynamodb-local', { recursive: true });
        }
        
        // ダウンロードコマンドを実行（出力を抑制）
        logger.verbose('ダウンロードコマンドを実行しています...');
        let outputLog = '';
        try {
          outputLog = execSync('curl -L https://d1ni2b6xgvw0s0.cloudfront.net/v2.2.0/dynamodb_local_latest.zip -o ./dynamodb-local/dynamodb_local_latest.zip', { stdio: 'pipe' }).toString();
        } catch (error) {
          logger.verbose(`ダウンロードエラー: ${error.message}`);
          logger.verbose(error.stdout ? error.stdout.toString() : 'No stdout');
          logger.verbose(error.stderr ? error.stderr.toString() : 'No stderr');
          throw error;
        }
        logger.verbose(`ダウンロード出力: ${outputLog}`);
        
        // 解凍（出力を抑制）
        logger.info('ダウンロードしたファイルを解凍しています...');
        if (process.platform === 'win32') {
          // Windows環境
          outputLog = execSync('powershell -command "Expand-Archive -Path ./dynamodb-local/dynamodb_local_latest.zip -DestinationPath ./dynamodb-local -Force"', { stdio: 'pipe' }).toString();
        } else {
          // Unix系環境
          outputLog = execSync('unzip -o ./dynamodb-local/dynamodb_local_latest.zip -d ./dynamodb-local', { stdio: 'pipe' }).toString();
        }
        logger.verbose(`解凍出力: ${outputLog}`);
        
        logger.success('DynamoDB Local のダウンロードが完了しました');
      } catch (error) {
        logger.error(`DynamoDB Local のダウンロードに失敗しました: ${error.message}`);
        logger.warning('テストはモックモードで実行する必要があります');
        return false;
      }
    } else {
      logger.warning('DynamoDB Local のダウンロードをスキップします');
      logger.warning('テストはモックモードで実行する必要があります');
      return false;
    }
  }
  
  // DynamoDB Local を起動
  logger.info('DynamoDB Local を起動します...');
  
  try {
    // Java バージョンを確認
    try {
      const javaVersion = execSync('java -version 2>&1', { stdio: 'pipe' }).toString();
      logger.verbose(`Java バージョン: ${javaVersion.split('\n')[0]}`);
    } catch (error) {
      logger.error('Java が見つかりません。DynamoDB Local の実行には Java が必要です。');
      return false;
    }
    
    // バックグラウンドで DynamoDB Local を起動
    const child = require('child_process').spawn('java', [
      '-Djava.library.path=./dynamodb-local/DynamoDBLocal_lib',
      '-jar',
      './dynamodb-local/DynamoDBLocal.jar',
      '-inMemory',
      '-port',
      '8000',
      '-sharedDb'
    ], {
      detached: true,
      stdio: process.platform === 'win32' ? 'ignore' : ['ignore', 'pipe', 'pipe']
    });
    
    // エラーハンドリング（ログファイルに出力）
    if (child.stderr) {
      child.stderr.on('data', (data) => {
        logger.verbose(`DynamoDB stderr: ${data}`);
      });
    }
    
    if (child.stdout) {
      child.stdout.on('data', (data) => {
        logger.verbose(`DynamoDB stdout: ${data}`);
        if (data.toString().includes('CorsParams')) {
          logger.success('DynamoDB Local が正常に起動しました');
        }
      });
    }
    
    // 親プロセスから切り離す
    child.unref();
    
    // 起動を待機
    logger.info('DynamoDB Local の起動を待機しています...');
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      if (isDynamoDBRunning()) {
        logger.success(`DynamoDB Local の起動が完了しました (${attempts}秒)`);
        return true;
      }
      
      logger.verbose(`起動待機中... (${attempts}/${maxAttempts})`);
    }
    
    logger.error('DynamoDB Local の起動タイムアウト');
    return false;
  } catch (error) {
    logger.error(`DynamoDB Local の起動に失敗しました: ${error.message}`);
    logger.warning('テストはモックモードで実行されます');
    return false;
  }
}

/**
 * テスト用ディレクトリの作成
 */
function createTestDirectories() {
  logger.step('テストディレクトリを作成しています...');
  
  const directories = [
    './test-results',
    './test-results/junit',
    './test-results/logs',
    './coverage',
    './.jest-cache'
  ];
  
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.verbose(`ディレクトリを作成しました: ${dir}`);
    } else {
      logger.verbose(`ディレクトリは既に存在します: ${dir}`);
    }
  });
  
  logger.success('テストディレクトリの確認が完了しました');
}

/**
 * DynamoDBクライアントの作成
 * @returns {DynamoDBClient} DynamoDBクライアント
 */
function createDynamoDBClient() {
  return new DynamoDBClient({
    region: 'us-east-1',
    endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test'
    }
  });
}

/**
 * テスト用テーブルの作成
 * @returns {Promise<boolean>} 成功時はtrue
 */
async function createTestTables() {
  logger.step('テスト用テーブルを作成しています...');
  
  try {
    const client = createDynamoDBClient();
    
    // 既存のテーブルを取得
    let existingTables = [];
    try {
      const { TableNames } = await client.send(new ListTablesCommand({}));
      existingTables = TableNames || [];
      logger.verbose(`既存のテーブル: ${existingTables.join(', ') || '(なし)'}`);
    } catch (error) {
      logger.verbose(`テーブル一覧の取得に失敗しました: ${error.message}`);
    }
    
    // 作成するテーブルの定義
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
    
    // 各テーブルを作成
    let successCount = 0;
    for (const table of tables) {
      if (!existingTables.includes(table.name)) {
        try {
          logger.verbose(`テーブルを作成しています: ${table.name}`);
          
          await client.send(new CreateTableCommand({
            TableName: table.name,
            KeySchema: table.keySchema,
            AttributeDefinitions: table.attributeDefinitions,
            BillingMode: 'PAY_PER_REQUEST'
          }));
          
          logger.verbose(`テーブルを作成しました: ${table.name}`);
          successCount++;
        } catch (error) {
          if (error.name === 'ResourceInUseException') {
            logger.verbose(`テーブルは既に存在します: ${table.name}`);
            successCount++;
          } else {
            logger.error(`テーブル作成エラー - ${table.name}: ${error.message}`);
          }
        }
      } else {
        logger.verbose(`テーブルは既に存在します: ${table.name}`);
        successCount++;
      }
    }
    
    if (successCount === tables.length) {
      logger.success(`テスト用テーブル (${tables.length}件) の作成が完了しました`);
    } else {
      logger.warning(`一部のテーブル作成に失敗しました (${successCount}/${tables.length}件成功)`);
    }
    
    return successCount === tables.length;
  } catch (error) {
    logger.error(`テーブル作成処理に失敗しました: ${error.message}`);
    return false;
  }
}

/**
 * テスト環境変数の設定
 */
function setupEnvironmentVariables() {
  logger.step('テスト環境変数を設定しています...');
  
  // .env.test ファイルのパス
  const envFile = path.join(process.cwd(), '.env.test');
  
  // デフォルトの環境変数設定
  const defaultEnv = `# テスト環境用の環境変数
NODE_ENV=test
DYNAMODB_ENDPOINT=http://localhost:8000
SESSION_TABLE=test-sessions
DYNAMODB_TABLE_PREFIX=test-
API_TEST_URL=http://localhost:3000/dev
SKIP_DYNAMODB_CHECKS=true
USE_API_MOCKS=true
CACHE_TIME_US_STOCK=60
CACHE_TIME_JP_STOCK=60
CACHE_TIME_MUTUAL_FUND=60
CACHE_TIME_EXCHANGE_RATE=60
CORS_ALLOW_ORIGIN=*
TEST_MODE=true
QUIET_MODE=true
`;
  
  // .env.test ファイルが存在するか確認
  if (fs.existsSync(envFile)) {
    logger.verbose('.env.test ファイルが見つかりました');
    
    // ファイルの内容を読み込む
    const content = fs.readFileSync(envFile, 'utf8');
    
    // 必要な環境変数が含まれているか確認
    const requiredVars = [
      'NODE_ENV',
      'DYNAMODB_ENDPOINT',
      'SESSION_TABLE',
      'DYNAMODB_TABLE_PREFIX'
    ];
    
    const missingVars = requiredVars.filter(varName => !content.includes(`${varName}=`));
    
    if (missingVars.length > 0) {
      logger.verbose(`.env.test ファイルに不足している環境変数があります: ${missingVars.join(', ')}`);
      
      if (QUIET_MODE) {
        // 静音モードでは自動的に更新
        logger.verbose('.env.test ファイルを自動的に更新します');
        
        // 既存の内容に追加
        const updatedContent = content + '\n' + missingVars.map(varName => {
          const defaultValue = defaultEnv.match(new RegExp(`${varName}=(.*)`))[1];
          return `${varName}=${defaultValue}`;
        }).join('\n') + '\n';
        
        fs.writeFileSync(envFile, updatedContent);
        logger.verbose('.env.test ファイルを更新しました');
      } else {
        // 通常モードではユーザーに確認
        logger.info('ファイルを更新しますか？ (y/n)');
        
        // ユーザーの入力を待つ（同期的に）
        const answer = require('readline-sync').question('> ');
        
        if (answer.toLowerCase() === 'y') {
          // 既存の内容に追加
          const updatedContent = content + '\n' + missingVars.map(varName => {
            const defaultValue = defaultEnv.match(new RegExp(`${varName}=(.*)`))[1];
            return `${varName}=${defaultValue}`;
          }).join('\n') + '\n';
          
          fs.writeFileSync(envFile, updatedContent);
          logger.success('.env.test ファイルを更新しました');
        }
      }
    }
  } else {
    // .env.test ファイルがなければ作成
    logger.warning('.env.test ファイルが見つかりません。デフォルト設定で作成します。');
    fs.writeFileSync(envFile, defaultEnv);
    logger.success('.env.test ファイルを作成しました');
  }
  
  // 現在のプロセスの環境変数を設定
  process.env.NODE_ENV = 'test';
  process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
  process.env.SESSION_TABLE = 'test-sessions';
  process.env.DYNAMODB_TABLE_PREFIX = 'test-';
  process.env.SKIP_DYNAMODB_CHECKS = 'true';
  process.env.USE_API_MOCKS = 'true';
  process.env.QUIET_MODE = QUIET_MODE ? 'true' : 'false';
  process.env.VERBOSE_MODE = VERBOSE_MODE ? 'true' : 'false';
  process.env.DEBUG = DEBUG_MODE ? 'true' : 'false';
  
  logger.success('環境変数の設定が完了しました');
}

/**
 * モックセットアップファイルの確認と生成
 */
function checkMockSetup() {
  logger.step('モックセットアップファイルを確認しています...');
  
  const mockDirs = [
    './__mocks__',
    './__mocks__/aws-sdk',
    './__mocks__/axios'
  ];
  
  // ディレクトリがなければ作成
  mockDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.verbose(`ディレクトリを作成しました: ${dir}`);
    }
  });
  
  // Axiosモックファイルの確認
  const axiosMockFile = './__mocks__/axios.js';
  if (!fs.existsSync(axiosMockFile)) {
    const axiosMockContent = `/**
 * Axios モック
 * @file __mocks__/axios.js
 */

module.exports = {
  get: jest.fn().mockResolvedValue({
    status: 200,
    data: { success: true, data: {} }
  }),
  post: jest.fn().mockResolvedValue({
    status: 200,
    data: { success: true, data: {} }
  }),
  put: jest.fn().mockResolvedValue({
    status: 200,
    data: { success: true, data: {} }
  }),
  delete: jest.fn().mockResolvedValue({
    status: 200,
    data: { success: true, data: {} }
  }),
  create: jest.fn().mockReturnThis(),
  defaults: {
    headers: {
      common: {}
    }
  },
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() }
  }
};`;
    
    fs.writeFileSync(axiosMockFile, axiosMockContent);
    logger.verbose(`モックファイルを作成しました: ${axiosMockFile}`);
  }
  
  logger.success('モックファイルの確認が完了しました');
}

/**
 * テスト実行前の設定とクリーンアップ
 */
function prepareTestEnvironment() {
  logger.step('テスト実行前の準備...');
  
  // 古いレポートファイルのクリーンアップ
  const reportPatterns = [
    './test-results/junit.xml',
    './test-results/test-report.html',
    './test-results/test-log.md'
  ];
  
  reportPatterns.forEach(pattern => {
    if (fs.existsSync(pattern)) {
      try {
        fs.unlinkSync(pattern);
        logger.verbose(`古いレポートを削除しました: ${pattern}`);
      } catch (error) {
        logger.verbose(`レポートファイルの削除に失敗しました: ${pattern}`);
      }
    }
  });
  
  // テストモードフラグファイルの作成
  fs.writeFileSync('./test-results/.test-mode', new Date().toISOString());
  
  logger.success('テスト実行前の準備が完了しました');
}

/**
 * メイン処理
 */
async function main() {
  console.log(`${colors.cyan}${colors.bold}テスト環境のセットアップを開始します...${colors.reset}`);
  console.log(`${colors.blue}ログファイル: ${LOG_FILE}${colors.reset}`);
  
  try {
    // テストディレクトリの作成
    createTestDirectories();
    
    // モックのセットアップ
    checkMockSetup();
    
    // 環境変数の設定
    setupEnvironmentVariables();
    
    // DynamoDB Local の起動
    const dynamoDBRunning = await startDynamoDBLocal();
    
    // テーブルの作成（DynamoDBが起動している場合のみ）
    let tablesCreated = false;
    if (dynamoDBRunning) {
      // DynamoDB起動確認後に少し待機
      await new Promise(resolve => setTimeout(resolve, 1000));
      tablesCreated = await createTestTables();
    }
    
    // 前処理
    prepareTestEnvironment();
    
    console.log(`${colors.cyan}${colors.bold}=== セットアップ結果 ====${colors.reset}`);
    
    if (dynamoDBRunning && tablesCreated) {
      logger.success('テスト環境のセットアップが完了しました！');
      console.log(`${colors.green}テスト実行の準備が整いました${colors.reset}`);
    } else if (dynamoDBRunning) {
      logger.warning('DynamoDB は起動していますが、テーブル作成に問題がありました');
      console.log(`${colors.yellow}ほとんどのテストは実行できますが、一部のテストが失敗する可能性があります${colors.reset}`);
    } else {
      logger.warning('DynamoDBの起動に問題があります。モックモードでテストを実行してください:');
      console.log(`${colors.yellow}モックモード${colors.reset}でテストを実行します`);
    }
    
    return 0;
  } catch (error) {
    logger.error(`テスト環境のセットアップに失敗しました: ${error.message}`);
    logger.verbose(error.stack);
    return 1;
  }
}

// スクリプトを実行
main().then(exitCode => {
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}).catch(error => {
  console.error('Fatal error:', error);
  logToFile(`FATAL ERROR: ${error.message}\n${error.stack}`);
  process.exit(1);
});
