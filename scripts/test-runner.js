/**
 * ファイルパス: scripts/test-runner.js
 * 
 * テスト実行ユーティリティ
 * Node.js から直接テストを実行するための高レベルAPI
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-21
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ProgressBar = require('./progress-bar');

/**
 * テスト実行管理クラス
 */
class TestRunner {
  /**
   * コンストラクタ
   * @param {Object} options オプション
   */
  constructor(options = {}) {
    // デフォルトオプション
    this.options = {
      testType: 'all',          // テスト種別 (unit, integration, e2e, all)
      clean: false,             // クリーンアップするか
      visual: false,            // ビジュアルレポートを表示するか
      mock: false,              // モックを使用するか
      watch: false,             // 監視モードで実行するか
      coverage: true,           // カバレッジを計測するか
      debug: false,             // デバッグモードで実行するか
      ignoreCoverageErrors: false, // カバレッジエラーを無視するか
      specificPattern: null,    // 特定のパターンに一致するテストのみ実行
      coverageTarget: 'initial', // カバレッジ目標段階
      quiet: true,              // 静音モードで実行するか
      verbose: false,           // 詳細モードで実行するか
      htmlCoverage: false,      // HTMLカバレッジレポートを生成するか
      chart: false,             // カバレッジチャートを生成するか
      junit: false,             // JUnit形式のレポートを生成するか
      ...options
    };
    
    // ログディレクトリの設定
    this.logDir = './test-results/logs';
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // ログファイルの設定
    this.logFile = `${this.logDir}/test-run-${new Date().toISOString().replace(/:/g, '-')}.log`;
    this.errorLogFile = `${this.logDir}/test-errors-${new Date().toISOString().replace(/:/g, '-')}.log`;
    
    // 初期ログを書き込み
    fs.writeFileSync(this.logFile, `=== Test Run: ${new Date().toISOString()} ===\n\n`);
    fs.writeFileSync(this.errorLogFile, `=== Error Log: ${new Date().toISOString()} ===\n\n`);
    
    // カラー設定
    this.colors = {
      reset: '\x1b[0m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m',
      magenta: '\x1b[35m',
      dim: '\x1b[2m',
      bold: '\x1b[1m'
    };
  }
  
  /**
   * ログをファイルに書き込む
   * @param {string} message メッセージ
   * @param {string} level ログレベル
   */
  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(this.logFile, `[${timestamp}] [${level}] ${message}\n`);
    
    if (level === 'ERROR') {
      fs.appendFileSync(this.errorLogFile, `[${timestamp}] ${message}\n`);
    }
  }
  
  /**
   * コンソールにメッセージを表示
   * @param {string} message メッセージ
   * @param {string} type メッセージタイプ
   */
  print(message, type = 'info') {
    // 静音モードでは最小限の出力のみ
    if (this.options.quiet && !this.options.verbose && type !== 'error' && type !== 'success' && type !== 'header') {
      this.log(message, type.toUpperCase());
      return;
    }
    
    let color = this.colors.reset;
    let prefix = '';
    
    switch (type) {
      case 'success':
        color = this.colors.green;
        prefix = '✓ ';
        break;
      case 'warning':
        color = this.colors.yellow;
        prefix = '⚠ ';
        break;
      case 'error':
        color = this.colors.red;
        prefix = '✗ ';
        break;
      case 'info':
        color = this.colors.blue;
        prefix = 'ℹ ';
        break;
      case 'step':
        color = this.colors.cyan;
        prefix = '➤ ';
        break;
      case 'header':
        console.log(`\n${this.colors.blue}${this.colors.bold}==========================================${this.colors.reset}`);
        console.log(`${this.colors.blue}${this.colors.bold}${message}${this.colors.reset}`);
        console.log(`${this.colors.blue}${this.colors.bold}==========================================${this.colors.reset}\n`);
        this.log(`\n===================\n${message}\n===================\n`, 'HEADER');
        return;
      default:
        color = this.colors.reset;
        break;
    }
    
    console.log(`${color}${prefix}${message}${this.colors.reset}`);
    this.log(message, type.toUpperCase());
  }
  
  /**
   * 環境のセットアップを実行
   */
  async setupEnvironment() {
    this.print('テスト環境をセットアップしています...', 'step');
    
    try {
      // クリーンアップが指定されている場合は実行
      if (this.options.clean) {
        this.print('環境をクリーンアップしています...', 'info');
        execSync('npm run test:clean', { stdio: this.options.verbose ? 'inherit' : 'pipe' });
        this.print('クリーンアップが完了しました', 'success');
      }
      
      // テスト環境をセットアップ
      this.print('テスト環境をセットアップしています...', 'info');
      
      // 環境変数を設定
      const env = {
        ...process.env,
        QUIET_MODE: this.options.quiet ? 'true' : 'false',
        VERBOSE_MODE: this.options.verbose ? 'true' : 'false',
        DEBUG: this.options.debug ? 'true' : 'false'
      };
      
      // セットアップスクリプトを実行
      execSync('node ./scripts/setup-test-env.js', { 
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        env
      });
      
      this.print('テスト環境のセットアップが完了しました', 'success');
      return true;
    } catch (error) {
      this.print(`テスト環境のセットアップに失敗しました: ${error.message}`, 'error');
      this.log(error.stack, 'ERROR');
      return false;
    }
  }
  
  /**
   * テストコマンドを構築
   * @returns {string} テストコマンド
   */
  buildTestCommand() {
    // 基本コマンド
    let command = './scripts/run-tests.sh';
    const args = [];
    
    // オプションを追加
    if (this.options.clean) args.push('-c');
    if (this.options.visual) args.push('-v');
    if (this.options.mock) args.push('-m');
    if (this.options.watch) args.push('-w');
    if (!this.options.coverage) args.push('-n');
    if (this.options.debug) args.push('-d');
    if (this.options.ignoreCoverageErrors) args.push('-i');
    if (this.options.specificPattern) {
      args.push('-s', `"${this.options.specificPattern}"`);
    }
    if (this.options.coverageTarget !== 'initial') {
      args.push('-t', this.options.coverageTarget);
    }
    if (this.options.quiet) args.push('-q');
    if (this.options.verbose) args.push('--verbose');
    if (this.options.htmlCoverage) args.push('--html-coverage');
    if (this.options.chart) args.push('--chart');
    if (this.options.junit) args.push('--junit');
    
    // テスト種別を追加
    args.push(this.options.testType);
    
    return `${command} ${args.join(' ')}`;
  }
  
  /**
   * テストを実行
   * @returns {Promise<number>} 終了コード
   */
  async run() {
    // 環境をセットアップ
    const setupSuccess = await this.setupEnvironment();
    if (!setupSuccess && !this.options.mock) {
      this.print('環境セットアップに失敗したため、モックモードを有効化します', 'warning');
      this.options.mock = true;
    }
    
    // テストコマンドを構築
    const command = this.buildTestCommand();
    this.print(`実行コマンド: ${command}`, 'info');
    
    // テスト実行開始
    this.print(`${this.options.testType} テストを実行しています...`, 'header');
    
    return new Promise((resolve) => {
      try {
        // コマンドを実行
        const child = spawn(command, { shell: true, stdio: 'inherit' });
        
        // 終了時のハンドリング
        child.on('close', (code) => {
          if (code === 0) {
            this.print('テスト実行が成功しました！', 'success');
          } else {
            this.print(`テスト実行が失敗しました (終了コード: ${code})`, 'error');
          }
          resolve(code);
        });
        
        // エラーハンドリング
        child.on('error', (error) => {
          this.print(`テスト実行中にエラーが発生しました: ${error.message}`, 'error');
          this.log(error.stack, 'ERROR');
          resolve(1);
        });
      } catch (error) {
        this.print(`テスト実行の起動に失敗しました: ${error.message}`, 'error');
        this.log(error.stack, 'ERROR');
        resolve(1);
      }
    });
  }
  
  /**
   * テスト実行をモニタリングして進捗状況を表示
   * @param {function} getProgress 進捗状況取得関数
   * @returns {Promise<number>} 終了コード
   */
  async runWithProgress(getProgress) {
    // 環境をセットアップ
    const setupSuccess = await this.setupEnvironment();
    if (!setupSuccess && !this.options.mock) {
      this.print('環境セットアップに失敗したため、モックモードを有効化します', 'warning');
      this.options.mock = true;
    }
    
    // テストコマンドを構築
    const command = this.buildTestCommand();
    this.print(`実行コマンド: ${command}`, 'info');
    
    // テスト実行開始
    this.print(`${this.options.testType} テストを実行しています...`, 'header');
    
    // プログレスバーを初期化
    const progressBar = new ProgressBar({
      total: 100,
      width: 40,
      symbols: {
        complete: '█',
        incomplete: '░'
      },
      format: `${this.colors.cyan}テスト進捗 [:bar] :percent${this.colors.reset} | 残り時間: :eta秒 | :status`
    });
    
    // 進捗更新タイマー
    let lastProgress = 0;
    let exitCode = 1;
    
    // 進捗状況更新関数
    const updateProgress = async () => {
      try {
        // 進捗状況を取得（実装は別途必要）
        const progress = getProgress ? await getProgress() : { percent: lastProgress + 1, status: 'テスト実行中...' };
        
        // プログレスバーを更新
        progressBar.update(progress.percent, progress.status);
        lastProgress = progress.percent;
        
        // 完了していなければ再帰的に更新
        if (lastProgress < 100) {
          setTimeout(updateProgress, 500);
        }
      } catch (error) {
        this.log(`進捗更新エラー: ${error.message}`, 'ERROR');
      }
    };
    
    return new Promise((resolve) => {
      try {
        // 進捗更新を開始
        updateProgress();
        
        // コマンドを実行
        const child = spawn(command, { shell: true, stdio: 'pipe' });
        
        // 標準出力を処理
        child.stdout.on('data', (data) => {
          const output = data.toString().trim();
          if (output) {
            this.log(`[STDOUT] ${output}`, 'INFO');
            // 重要なメッセージはコンソールにも表示
            if (output.includes('ERROR') || output.includes('FAIL') || output.includes('PASS') ||
                output.includes('Test Suites:') || output.includes('Tests:')) {
              console.log(output);
            }
          }
        });
        
        // 標準エラー出力を処理
        child.stderr.on('data', (data) => {
          const output = data.toString().trim();
          if (output) {
            this.log(`[STDERR] ${output}`, 'ERROR');
            // エラーメッセージはコンソールにも表示
            console.error(output);
          }
        });
        
        // 終了時のハンドリング
        child.on('close', (code) => {
          exitCode = code;
          // 進捗を100%にして完了
          progressBar.complete(code === 0 ? 'テスト成功!' : 'テスト失敗!');
          
          if (code === 0) {
            this.print('テスト実行が成功しました！', 'success');
          } else {
            this.print(`テスト実行が失敗しました (終了コード: ${code})`, 'error');
          }
          
          resolve(code);
        });
        
        // エラーハンドリング
        child.on('error', (error) => {
          this.print(`テスト実行中にエラーが発生しました: ${error.message}`, 'error');
          this.log(error.stack, 'ERROR');
          resolve(1);
        });
      } catch (error) {
        this.print(`テスト実行の起動に失敗しました: ${error.message}`, 'error');
        this.log(error.stack, 'ERROR');
        resolve(1);
      }
    });
  }
  
  /**
   * テスト結果ファイルを解析
   * @returns {Object|null} テスト結果
   */
  parseTestResults() {
    try {
      const resultsPath = path.resolve('./test-results/detailed-results.json');
      if (fs.existsSync(resultsPath)) {
        return JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      }
      return null;
    } catch (error) {
      this.log(`テスト結果の解析に失敗しました: ${error.message}`, 'ERROR');
      return null;
    }
  }
  
  /**
   * テスト結果のサマリーを表示
   */
  printSummary() {
    const results = this.parseTestResults();
    if (!results) {
      this.print('テスト結果が見つかりません', 'warning');
      return;
    }
    
    // 基本的なテスト結果
    this.print('テスト結果サマリー', 'header');
    console.log(`${this.colors.bold}合計テスト数:${this.colors.reset} ${results.numTotalTests}`);
    console.log(`${this.colors.green}成功:${this.colors.reset} ${results.numPassedTests}`);
    console.log(`${this.colors.red}失敗:${this.colors.reset} ${results.numFailedTests}`);
    console.log(`${this.colors.yellow}スキップ:${this.colors.reset} ${results.numPendingTests}`);
    
    // カバレッジ情報（存在する場合）
    if (results.coverageMap && results.coverageMap.total) {
      console.log(`\n${this.colors.bold}カバレッジ情報:${this.colors.reset}`);
      
      const { statements, branches, functions, lines } = results.coverageMap.total;
      
      console.log(`${this.colors.cyan}ステートメント:${this.colors.reset} ${statements.pct.toFixed(2)}% (${statements.covered}/${statements.total})`);
      console.log(`${this.colors.cyan}ブランチ:${this.colors.reset} ${branches.pct.toFixed(2)}% (${branches.covered}/${branches.total})`);
      console.log(`${this.colors.cyan}関数:${this.colors.reset} ${functions.pct.toFixed(2)}% (${functions.covered}/${functions.total})`);
      console.log(`${this.colors.cyan}行:${this.colors.reset} ${lines.pct.toFixed(2)}% (${lines.covered}/${lines.total})`);
    }
    
    // 失敗したテストの詳細（存在する場合）
    if (results.numFailedTests > 0 && results.testResults) {
      console.log(`\n${this.colors.bold}${this.colors.red}失敗したテスト:${this.colors.reset}`);
      
      // 失敗したテストを収集
      const failedTests = [];
      results.testResults.forEach(fileResult => {
        fileResult.testResults
          .filter(test => test.status === 'failed')
          .forEach(test => {
            failedTests.push({
              file: path.relative(process.cwd(), fileResult.testFilePath),
              title: test.title,
              message: test.failureMessages[0]
            });
          });
      });
      
      // 最大5件まで表示
      failedTests.slice(0, 5).forEach((test, index) => {
        console.log(`${index + 1}. ${this.colors.red}${test.title}${this.colors.reset}`);
        console.log(`   ${this.colors.dim}ファイル:${this.colors.reset} ${test.file}`);
        console.log(`   ${this.colors.dim}エラー:${this.colors.reset} ${test.message.split('\n')[0]}`);
      });
      
      if (failedTests.length > 5) {
        console.log(`... 他 ${failedTests.length - 5} 件のエラー`);
      }
    }
    
    // レポートへのリンク
    console.log(`\n${this.colors.bold}レポート:${this.colors.reset}`);
    console.log(`- 詳細レポート: ./test-results/visual-report.html`);
    console.log(`- テストログ: ./test-results/test-log.md`);
    console.log(`- エラーログ: ${this.errorLogFile}`);
  }
}

module.exports = TestRunner;
