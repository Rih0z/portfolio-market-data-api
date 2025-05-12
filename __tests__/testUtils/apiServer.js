/**
 * ファイルパス: __tests__/testUtils/apiServer.js
 * 
 * テスト実行時に自動的にAPIサーバーを起動・停止するためのユーティリティ
 * 
 * @file __tests__/testUtils/apiServer.js
 * @author Koki Riho
 * @created 2025-05-12
 * @updated 2025-05-12
 */

const { spawn } = require('child_process');
let apiProcess = null;

/**
 * テスト用APIサーバーを起動する
 * @param {number} port - APIサーバーを起動するポート番号
 * @returns {Promise} サーバー起動完了を表すPromise
 */
const startApiServer = async (port = 3000) => {
  if (apiProcess) {
    console.log('API server is already running');
    return;
  }
  
  return new Promise((resolve, reject) => {
    console.log('Starting API server for testing...');
    
    // サーバー起動コマンド
    apiProcess = spawn('npm', ['run', 'dev'], {
      env: {
        ...process.env,
        PORT: port.toString(),
        NODE_ENV: 'test'
      },
      detached: false
    });
    
    // 標準出力を監視して、サーバー起動を検知
    apiProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`API: ${output}`);
      
      // サーバー起動完了のメッセージを検出
      if (output.includes('Server is running') || output.includes('listening on port')) {
        console.log(`✅ API server started on port ${port}`);
        resolve();
      }
    });
    
    // エラー処理
    apiProcess.stderr.on('data', (data) => {
      console.error(`API Error: ${data.toString()}`);
    });
    
    apiProcess.on('error', (error) => {
      console.error('Failed to start API server:', error);
      apiProcess = null;
      reject(error);
    });
    
    // タイムアウト処理
    setTimeout(() => {
      if (apiProcess) {
        console.log('API server startup timeout reached, assuming it is running');
        resolve();
      } else {
        reject(new Error('API server failed to start within timeout period'));
      }
    }, 5000);
  });
};

/**
 * テスト用APIサーバーを停止する
 */
const stopApiServer = () => {
  if (apiProcess) {
    console.log('Stopping API server...');
    try {
      // プロセスとその子プロセスをすべて終了
      process.kill(-apiProcess.pid, 'SIGTERM');
    } catch (error) {
      console.error('Error stopping API server:', error);
      // 強制終了を試みる
      try {
        apiProcess.kill('SIGKILL');
      } catch (killError) {
        console.error('Failed to kill API server process:', killError);
      }
    } finally {
      apiProcess = null;
    }
  }
};

/**
 * APIサーバーの実行状態を確認する
 * @returns {boolean} サーバーが実行中かどうか
 */
const isApiServerRunning = () => {
  return apiProcess !== null;
};

module.exports = {
  startApiServer,
  stopApiServer,
  isApiServerRunning
};
