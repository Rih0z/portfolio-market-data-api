/**
 * ファイルパス: scripts/setup-test-env.js
 * 
 * テスト環境のセットアップスクリプト
 * テスト実行前にテスト環境を準備します
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-20
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

console.log('テスト環境のセットアップを開始します...');

// テスト結果ディレクトリが存在しない場合は作成
if (!fs.existsSync('./test-results')) {
  console.log('テスト結果ディレクトリを作成します...');
  fs.mkdirSync('./test-results', { recursive: true });
}

// DynamoDB Localを起動して待機
startDynamoDBLocalAndWait()
  .then(() => {
    console.log('テスト環境のセットアップが完了しました');
  })
  .catch(error => {
    console.error('テスト環境のセットアップに失敗しました:', error);
    process.exit(1);
  });

/**
 * DynamoDB Localを起動して接続を確認
 */
async function startDynamoDBLocalAndWait() {
  // ポート8000が使用されているか確認
  const isPortUsed = checkIfPortIsUsed(8000);
  
  if (isPortUsed) {
    console.log('DynamoDB Localはすでに起動しています');
    await verifyDynamoDBConnection();
    return;
  }
  
  console.log('DynamoDB Localを起動します...');
  
  try {
    // DynamoDB Localのプロセスを起動
    const dynamoProcess = spawn(
      'java',
      [
        '-Djava.library.path=./dynamodb-local/DynamoDBLocal_lib',
        '-jar',
        './dynamodb-local/DynamoDBLocal.jar',
        '-inMemory',
        '-port',
        '8000'
      ],
      {
        detached: true,
        stdio: 'ignore'
      }
    );
    
    // プロセスの切り離し（親プロセスが終了しても継続するように）
    dynamoProcess.unref();
    
    // DynamoDBが起動するまで待機
    console.log('DynamoDB Localの起動を待機中...');
    await waitFor(2000); // 最初の待機
    
    // 接続を確認
    await verifyDynamoDBConnection();
  } catch (error) {
    console.error('DynamoDB Localの起動に失敗しました:', error);
    throw error;
  }
}

/**
 * DynamoDBへの接続を確認
 */
async function verifyDynamoDBConnection() {
  console.log('DynamoDBへの接続を確認中...');
  
  const client = new DynamoDBClient({
    region: 'us-east-1',
    endpoint: 'http://localhost:8000',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test'
    }
  });
  
  // 接続を確認するために ListTables を呼び出し
  for (let retry = 0; retry < 5; retry++) {
    try {
      await client.send(new ListTablesCommand({}));
      console.log('DynamoDBへの接続に成功しました');
      return;
    } catch (error) {
      console.warn(`DynamoDBへの接続確認に失敗しました (試行 ${retry + 1}/5):`, error.message);
      await waitFor(1000);
    }
  }
  
  throw new Error('DynamoDBへの接続確認に失敗しました');
}

/**
 * ポートが使用中かどうかを確認
 */
function checkIfPortIsUsed(port) {
  try {
    // Unixシステムの場合
    try {
      execSync(`lsof -i:${port} | grep LISTEN`, { stdio: 'ignore' });
      return true;
    } catch (e) {
      // lsofコマンドが失敗した場合はWindowsか、コマンドがないか
    }
    
    // Windowsの場合
    try {
      execSync(`netstat -ano | findstr :${port}`, { stdio: 'ignore' });
      return true;
    } catch (e) {
      // netstatコマンドが失敗した場合は別の方法を試す
    }
    
    return false;
  } catch (error) {
    console.warn('ポート使用確認に失敗しました:', error.message);
    return false; // エラー時はポートが空いていると仮定
  }
}

/**
 * 指定したミリ秒待機する
 */
function waitFor(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * テスト結果ディレクトリをクリーンアップ
 */
function cleanupTestResults() {
  try {
    const filesToKeep = ['.gitkeep']; // 保持するファイル
    
    fs.readdirSync('./test-results').forEach(file => {
      if (!filesToKeep.includes(file)) {
        fs.unlinkSync(path.join('./test-results', file));
      }
    });
    
    console.log('古いテスト結果をクリーンアップしました');
  } catch (error) {
    console.warn('テスト結果のクリーンアップに失敗しました:', error.message);
    // 続行する（クリティカルではない）
  }
}
