/**
 * ファイルパス: custom-reporter.js
 * 
 * Jestカスタムレポーター - エヴァンゲリオン風NERV視覚化システム
 * テスト結果の詳細情報を収集し、エヴァンゲリオン風ビジュアルレポートを生成
 * 
 * @author Portfolio Manager Team / NERV
 * @created 2025-05-26
 * @updated 2025-05-15 - 出力ファイル名を visual-report.html に変更
 */

const fs = require('fs');
const path = require('path');

/**
 * エヴァンゲリオン風Jestレポータークラス
 */
class EvaNervReporter {
  constructor(globalConfig, options = {}) {
    // 基本設定
    this.globalConfig = globalConfig;
    this.options = options;
    this.startTime = Date.now();
    this.endTime = null;
    this.results = {
      numTotalTests: 0,
      numFailedTests: 0,
      numPassedTests: 0,
      numPendingTests: 0,
      testResults: [],
      coverageMap: null
    };
    
    // 出力設定
    this.quietMode = process.env.CI !== 'true' && 
                     process.env.DEBUG !== 'true' && 
                     process.env.VERBOSE_MODE !== 'true';
    
    this.superQuietMode = process.env.QUIET_MODE === 'true'; 
    
    // ログディレクトリの設定
    this.logDir = './test-results/logs';
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // テスト実行のログファイル
    this.logFile = `${this.logDir}/nerv-test-${new Date().toISOString().replace(/:/g, '-').slice(0, 19)}.log`;
    this.errorLogFile = `${this.logDir}/nerv-error-${new Date().toISOString().replace(/:/g, '-').slice(0, 19)}.log`;
    
    // 初期ログ
    fs.writeFileSync(this.logFile, `=== NERV TEST SYSTEM ACTIVATED: ${new Date().toISOString()} ===\n\n`);
    fs.writeFileSync(this.errorLogFile, `=== NERV ERROR MONITORING SYSTEM: ${new Date().toISOString()} ===\n\n`);
    
    // オリジナルのコンソール出力を保存
    this.originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error
    };
    
    // 色の設定 - エヴァ風のカラースキーム
    this.colors = {
      green: '\x1b[38;5;46m',    // NERV緑（明るい緑）
      orange: '\x1b[38;5;208m',  // NERV橙（明るいオレンジ）
      red: '\x1b[38;5;196m',     // 警告用赤
      blue: '\x1b[38;5;39m',     // 淡い青（MAGI系）
      cyan: '\x1b[38;5;51m',     // 明るい水色
      yellow: '\x1b[38;5;226m',  // 明るい黄色
      purple: '\x1b[38;5;93m',   // 紫（SEELE関連）
      dim: '\x1b[2m',
      bold: '\x1b[1m',
      blink: '\x1b[5m',          // 点滅（警告用）
      inverse: '\x1b[7m',        // 反転（重要警告用）
      reset: '\x1b[0m'
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
   * コンソールに出力
   * @param {string} message メッセージ
   * @param {string} type メッセージタイプ
   */
  print(message, type = 'info') {
    // ログにも記録
    this.log(message, type.toUpperCase());
    
    // 超静音モードでは最小限の出力のみ
    if (this.superQuietMode && type !== 'error' && type !== 'success' && type !== 'result') {
      return;
    }
    
    let color = this.colors.reset;
    let prefix = '';
    
    switch (type) {
      case 'success':
        color = this.colors.green;
        prefix = '[PASS] ';
        break;
      case 'warning':
        color = this.colors.orange;
        prefix = '[WARNING] ';
        break;
      case 'error':
        color = this.colors.red;
        prefix = '[CRITICAL] ';
        break;
      case 'info':
        color = this.colors.blue;
        prefix = '[NERV] ';
        break;
      case 'step':
        color = this.colors.cyan;
        prefix = '[MAGI] ';
        break;
      case 'result':
        // 結果出力は常に表示
        this.originalConsole.log(message);
        return;
      default:
        color = this.colors.reset;
        break;
    }
    
    this.originalConsole.log(`${color}${prefix}${message}${this.colors.reset}`);
  }
  
  /**
   * HTMLビジュアルレポートを生成
   * @param {string} outputDir 出力ディレクトリ
   */
  generateEvaVisualReport(outputDir) {
    try {
      // 基本的なHTMLテンプレート - エヴァンゲリオン風
      let html = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>NERV MAGI SYSTEM - テスト結果解析</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet">
          <style>
            :root {
              --nerv-black: #000000;
              --nerv-dark: #111111;
              --nerv-green: #00FF00;
              --nerv-orange: #FF6600;
              --nerv-red: #FF0000;
              --nerv-blue: #3399FF;
              --nerv-purple: #9933CC;
              --nerv-white: #CCCCCC;
              --grid-line: #333333;
            }
            
            @keyframes scanline {
              0% { transform: translateY(0px); }
              100% { transform: translateY(100vh); }
            }
            
            @keyframes blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.3; }
            }
            
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            
            @keyframes glitch {
              0%, 100% { transform: translate(0); }
              25% { transform: translate(-2px, 2px); }
              50% { transform: translate(2px, -2px); }
              75% { transform: translate(-1px, -1px); }
            }
            
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              font-family: 'Share Tech Mono', monospace;
            }
            
            body {
              background-color: var(--nerv-black);
              color: var(--nerv-white);
              line-height: 1.6;
              padding: 0;
              margin: 0;
              overflow-x: hidden;
              position: relative;
            }
            
            body::before {
              content: "";
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: 
                repeating-linear-gradient(
                  0deg, 
                  rgba(0,0,0, 0.15), 
                  rgba(0,0,0, 0.15) 1px, 
                  transparent 1px, 
                  transparent 2px
                );
              pointer-events: none;
              z-index: 10;
            }
            
            body::after {
              content: "";
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 2px;
              background-color: rgba(0, 255, 0, 0.5);
              animation: scanline 8s linear infinite;
              pointer-events: none;
              z-index: 11;
            }
            
            .container {
              max-width: 95%;
              margin: 0 auto;
              padding: 20px;
              position: relative;
              animation: fadeIn 1s ease-in;
            }
            
            h1, h2, h3 {
              color: var(--nerv-orange);
              text-transform: uppercase;
              letter-spacing: 2px;
              margin-top: 30px;
              margin-bottom: 20px;
              border-bottom: 1px solid var(--nerv-orange);
              padding-bottom: 5px;
              position: relative;
            }
            
            h1 {
              color: var(--nerv-green);
              font-size: 2rem;
              text-align: center;
              margin-top: 10px;
              border-bottom: 2px solid var(--nerv-green);
            }
            
            h1::before, h1::after {
              content: "//";
              color: var(--nerv-green);
              margin: 0 10px;
            }
            
            h2::before {
              content: ">";
              color: var(--nerv-orange);
              margin-right: 10px;
            }
            
            p {
              margin-bottom: 15px;
              position: relative;
            }
            
            .timestamp {
              color: var(--nerv-blue);
              font-size: 0.9rem;
              margin-bottom: 30px;
              text-align: center;
            }
            
            .nerv-logo {
              text-align: center;
              margin: 20px 0;
              color: var(--nerv-red);
              font-size: 24px;
              font-weight: bold;
              letter-spacing: 8px;
              text-shadow: 0 0 5px var(--nerv-red);
              animation: blink 4s infinite;
            }
            
            .nerv-logo .half-leaf {
              display: inline-block;
              transform: scale(1.2);
              margin: 0 5px;
            }
            
            .summary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
              margin: 30px 0;
            }
            
            .summary-box {
              border: 1px solid var(--grid-line);
              padding: 15px;
              text-align: center;
              background-color: rgba(0, 0, 0, 0.7);
              position: relative;
              box-shadow: 0 0 10px rgba(0, 255, 0, 0.2);
            }
            
            .summary-box::before {
              content: "";
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: 
                linear-gradient(45deg, transparent 48%, var(--grid-line) 49%, var(--grid-line) 51%, transparent 52%),
                linear-gradient(-45deg, transparent 48%, var(--grid-line) 49%, var(--grid-line) 51%, transparent 52%);
              background-size: 30px 30px;
              pointer-events: none;
              opacity: 0.3;
            }
            
            .summary-box h2 {
              font-size: 2.5rem;
              margin: 0;
              border: none;
            }
            
            .summary-box p {
              margin: 5px 0 0;
              font-size: 1rem;
              text-transform: uppercase;
            }
            
            .summary-box.total h2, .summary-box.total p {
              color: var(--nerv-blue);
            }
            
            .summary-box.passed h2, .summary-box.passed p {
              color: var(--nerv-green);
            }
            
            .summary-box.failed h2, .summary-box.failed p {
              color: var(--nerv-red);
              animation: blink 2s infinite;
            }
            
            .summary-box.skipped h2, .summary-box.skipped p {
              color: var(--nerv-orange);
            }
            
            .magi-system {
              margin: 40px 0;
              background-color: rgba(0, 0, 0, 0.7);
              border: 1px solid var(--grid-line);
              padding: 20px;
              position: relative;
            }
            
            .magi-system::before {
              content: "MAGI SYSTEM";
              position: absolute;
              top: -12px;
              left: 20px;
              background-color: var(--nerv-black);
              padding: 0 10px;
              color: var(--nerv-green);
              font-size: 0.9rem;
            }
            
            .magi-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
              border-bottom: 1px solid var(--grid-line);
              padding-bottom: 10px;
            }
            
            .magi-title {
              color: var(--nerv-green);
              font-size: 1.2rem;
            }
            
            .magi-status {
              color: var(--nerv-green);
              background-color: rgba(0, 255, 0, 0.1);
              padding: 3px 8px;
              border-radius: 3px;
              font-size: 0.9rem;
            }
            
            .coverage-row {
              display: flex;
              align-items: center;
              margin: 15px 0;
              position: relative;
            }
            
            .coverage-label {
              width: 150px;
              font-weight: bold;
              color: var(--nerv-white);
              text-transform: uppercase;
              font-size: 0.9rem;
            }
            
            .coverage-bar {
              flex: 1;
              height: 25px;
              background-color: rgba(51, 51, 51, 0.5);
              position: relative;
              margin: 0 15px;
              overflow: hidden;
            }
            
            .coverage-bar::before {
              content: "";
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: 
                repeating-linear-gradient(
                  -45deg, 
                  transparent, 
                  transparent 10px, 
                  rgba(0, 0, 0, 0.1) 10px, 
                  rgba(0, 0, 0, 0.1) 20px
                );
              pointer-events: none;
            }
            
            .coverage-bar-fill {
              height: 100%;
              animation: fadeIn 1.5s ease-out;
            }
            
            .coverage-bar-fill.success {
              background-color: var(--nerv-green);
            }
            
            .coverage-bar-fill.warning {
              background-color: var(--nerv-orange);
            }
            
            .coverage-bar-fill.critical {
              background-color: var(--nerv-red);
              animation: blink 2s infinite;
            }
            
            .coverage-percentage {
              width: 70px;
              font-weight: bold;
              text-align: right;
              color: var(--nerv-white);
            }
            
            .coverage-counts {
              width: 100px;
              text-align: right;
              font-size: 0.9rem;
              color: var(--nerv-blue);
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
              background-color: rgba(0, 0, 0, 0.7);
              animation: fadeIn 1s ease-in;
            }
            
            table, th, td {
              border: 1px solid var(--grid-line);
            }
            
            th, td {
              padding: 10px 15px;
              text-align: left;
            }
            
            th {
              background-color: rgba(255, 102, 0, 0.2);
              color: var(--nerv-orange);
              text-transform: uppercase;
              font-size: 0.9rem;
            }
            
            tr:nth-child(even) {
              background-color: rgba(0, 0, 0, 0.3);
            }
            
            tr:hover {
              background-color: rgba(0, 255, 0, 0.1);
            }
            
            .file-path {
              font-family: monospace;
              font-size: 0.9rem;
              color: var(--nerv-blue);
            }
            
            .error-section {
              margin: 30px 0;
              padding: 20px;
              background-color: rgba(255, 0, 0, 0.1);
              border: 1px solid var(--nerv-red);
              position: relative;
              animation: glitch 0.5s ease-in-out infinite alternate;
            }
            
            .error-section h2 {
              color: var(--nerv-red);
              border-color: var(--nerv-red);
              animation: blink 1s infinite;
            }
            
            .error-message {
              font-family: monospace;
              padding: 15px;
              background-color: rgba(0, 0, 0, 0.7);
              color: var(--nerv-red);
              overflow-x: auto;
              max-height: 300px;
              border: 1px solid var(--nerv-red);
            }
            
            .footer {
              margin-top: 50px;
              text-align: center;
              color: var(--nerv-white);
              font-size: 0.9rem;
              border-top: 1px solid var(--grid-line);
              padding-top: 20px;
            }
            
            .footer .magi-sign {
              color: var(--nerv-orange);
              animation: blink 4s infinite;
            }
            
            .pattern-bg {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background-image: 
                linear-gradient(to right, rgba(0, 255, 0, 0.05) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0, 255, 0, 0.05) 1px, transparent 1px);
              background-size: 20px 20px;
              pointer-events: none;
              z-index: -1;
            }
            
            /* カバレッジチャートのスタイル */
            .coverage-charts {
              margin-top: 30px;
              border-top: 1px solid #eee;
              padding-top: 20px;
            }
            .coverage-charts h2 {
              text-align: center;
              margin-bottom: 20px;
            }
            .chart-container {
              display: flex;
              justify-content: center;
              margin-bottom: 30px;
            }
            
            /* レスポンシブ対応 */
            @media (max-width: 768px) {
              .summary {
                grid-template-columns: repeat(2, 1fr);
              }
              
              .coverage-row {
                flex-direction: column;
                align-items: flex-start;
              }
              
              .coverage-bar {
                width: 100%;
                margin: 10px 0;
              }
              
              .coverage-percentage, .coverage-counts {
                text-align: left;
                width: auto;
                margin-top: 5px;
              }
            }
          </style>
        </head>
        <body>
          <div class="pattern-bg"></div>
          <div class="container">
            <div class="nerv-logo">
              <span class="half-leaf">◢</span>NERV<span class="half-leaf">◣</span>
            </div>
            <h1>MAGI システム解析結果</h1>
            <div class="timestamp">実行日時: ${new Date().toLocaleString('ja-JP')}</div>
            <p style="text-align: center; color: var(--nerv-green);">実行時間: ${((this.endTime - this.startTime) / 1000).toFixed(2)}秒</p>
            
            <div class="summary">
              <div class="summary-box total">
                <h2>${this.results.numTotalTests}</h2>
                <p>総テスト数</p>
              </div>
              <div class="summary-box passed">
                <h2>${this.results.numPassedTests}</h2>
                <p>成功</p>
              </div>
              <div class="summary-box failed">
                <h2>${this.results.numFailedTests}</h2>
                <p>失敗</p>
              </div>
              <div class="summary-box skipped">
                <h2>${this.results.numPendingTests}</h2>
                <p>保留</p>
              </div>
            </div>
      `;
      
      // カバレッジ情報がある場合
      if (this.results.coverageMap) {
        try {
          const total = this.results.coverageMap.getCoverageSummary().toJSON();
          const targetLevel = process.env.COVERAGE_TARGET || 'initial';
          const targetThresholds = this.getCoverageThresholds(targetLevel);
          
          html += `
            <div class="magi-system">
              <div class="magi-header">
                <div class="magi-title">MAGI-SYSTEM/MELCHIOR - カバレッジ解析</div>
                <div class="magi-status">OPERATIONAL</div>
              </div>
              
              <div class="coverage-row">
                <div class="coverage-label">ステートメント</div>
                <div class="coverage-bar">
                  <div class="coverage-bar-fill ${this.getCoverageBarClass(total.statements.pct, targetThresholds.statements)}" style="width: ${total.statements.pct}%;"></div>
                </div>
                <div class="coverage-percentage">${total.statements.pct.toFixed(2)}%</div>
                <div class="coverage-counts">${total.statements.covered}/${total.statements.total}</div>
              </div>
              
              <div class="coverage-row">
                <div class="coverage-label">ブランチ</div>
                <div class="coverage-bar">
                  <div class="coverage-bar-fill ${this.getCoverageBarClass(total.branches.pct, targetThresholds.branches)}" style="width: ${total.branches.pct}%;"></div>
                </div>
                <div class="coverage-percentage">${total.branches.pct.toFixed(2)}%</div>
                <div class="coverage-counts">${total.branches.covered}/${total.branches.total}</div>
              </div>
              
              <div class="coverage-row">
                <div class="coverage-label">関数</div>
                <div class="coverage-bar">
                  <div class="coverage-bar-fill ${this.getCoverageBarClass(total.functions.pct, targetThresholds.functions)}" style="width: ${total.functions.pct}%;"></div>
                </div>
                <div class="coverage-percentage">${total.functions.pct.toFixed(2)}%</div>
                <div class="coverage-counts">${total.functions.covered}/${total.functions.total}</div>
              </div>
              
              <div class="coverage-row">
                <div class="coverage-label">コード行</div>
                <div class="coverage-bar">
                  <div class="coverage-bar-fill ${this.getCoverageBarClass(total.lines.pct, targetThresholds.lines)}" style="width: ${total.lines.pct}%;"></div>
                </div>
                <div class="coverage-percentage">${total.lines.pct.toFixed(2)}%</div>
                <div class="coverage-counts">${total.lines.covered}/${total.lines.total}</div>
              </div>
            </div>
            
            <div class="magi-system">
              <div class="magi-header">
                <div class="magi-title">MAGI-SYSTEM/BALTHASAR - 目標達成度解析</div>
                <div class="magi-status">OPERATIONAL</div>
              </div>
              
              <table>
                <thead>
                  <tr>
                    <th>メトリクス</th>
                    <th>現在値</th>
                    <th>目標値</th>
                    <th>ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>ステートメント</td>
                    <td>${total.statements.pct.toFixed(2)}%</td>
                    <td>${targetThresholds.statements}%</td>
                    <td>${this.getNervStatusSymbol(total.statements.pct, targetThresholds.statements)}</td>
                  </tr>
                  <tr>
                    <td>ブランチ</td>
                    <td>${total.branches.pct.toFixed(2)}%</td>
                    <td>${targetThresholds.branches}%</td>
                    <td>${this.getNervStatusSymbol(total.branches.pct, targetThresholds.branches)}</td>
                  </tr>
                  <tr>
                    <td>関数</td>
                    <td>${total.functions.pct.toFixed(2)}%</td>
                    <td>${targetThresholds.functions}%</td>
                    <td>${this.getNervStatusSymbol(total.functions.pct, targetThresholds.functions)}</td>
                  </tr>
                  <tr>
                    <td>コード行</td>
                    <td>${total.lines.pct.toFixed(2)}%</td>
                    <td>${targetThresholds.lines}%</td>
                    <td>${this.getNervStatusSymbol(total.lines.pct, targetThresholds.lines)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div class="magi-system">
              <div class="magi-header">
                <div class="magi-title">MAGI-SYSTEM/CASPER - ファイル詳細解析</div>
                <div class="magi-status">OPERATIONAL</div>
              </div>
              
              <table>
                <thead>
                  <tr>
                    <th>ファイル</th>
                    <th>ステートメント</th>
                    <th>ブランチ</th>
                    <th>関数</th>
                    <th>コード行</th>
                  </tr>
                </thead>
                <tbody>
          `;
          
          const fileCoverage = this.results.coverageMap.getFileCoverageInfo();
          fileCoverage.sort((a, b) => a.filename.localeCompare(b.filename));
          
          fileCoverage.forEach(file => {
            const filename = path.relative(process.cwd(), file.filename);
            html += `
              <tr>
                <td class="file-path">${filename}</td>
                <td>${file.statements.pct.toFixed(2)}%</td>
                <td>${file.branches.pct.toFixed(2)}%</td>
                <td>${file.functions.pct.toFixed(2)}%</td>
                <td>${file.lines.pct.toFixed(2)}%</td>
              </tr>
            `;
          });
          
          html += `
                </tbody>
              </table>
            </div>
          `;
        } catch (error) {
          html += `
            <div class="error-section">
              <h2>カバレッジデータ解析エラー</h2>
              <p>エラーコード: ${error.message}</p>
              <p>MAGIシステム: データ解析不能</p>
            </div>
          `;
        }
      } else {
        html += `
          <div class="magi-system">
            <div class="magi-header">
              <div class="magi-title">MAGI-SYSTEM - 警告</div>
              <div class="magi-status" style="color: var(--nerv-orange);">WARNING</div>
            </div>
            <p style="color: var(--nerv-orange);">カバレッジデータが取得できません。テスト実行時に--coverageオプションを有効化してください。</p>
          </div>
        `;
      }
      
      // エラーがある場合
      if (this.results.numFailedTests > 0) {
        html += `
          <div class="error-section">
            <h2>シナリオ実行エラー ［パターンブルー］</h2>
        `;
        
        const failedTests = this.results.testResults.flatMap(fileResult =>
          fileResult.testResults
            .filter(test => test.status === 'failed')
            .map(test => ({
              testFilePath: fileResult.testFilePath,
              title: test.title,
              failureMessages: test.failureMessages
            }))
        );
        
        failedTests.forEach((test, index) => {
          const relativePath = path.relative(process.cwd(), test.testFilePath);
          html += `
            <h3>${index + 1}. ${test.title}</h3>
            <p class="file-path">場所: ${relativePath}</p>
            <div class="error-message">
              <pre>${test.failureMessages.join('\n')}</pre>
            </div>
          `;
        });
        
        html += `
          </div>
        `;
      }
      
      // カバレッジチャート用のプレースホルダー - ID追加
      html += `
        <div id="coverage-charts" class="coverage-charts">
          <h2>コードカバレッジチャート</h2>
          <div id="bar-chart-container" class="chart-container">
            <!-- バーチャートはここに挿入されます -->
            <p style="color: var(--nerv-green);">グラフデータ解析中...</p>
          </div>
          <div id="line-chart-container" class="chart-container">
            <!-- 折れ線チャートはここに挿入されます -->
            <p style="color: var(--nerv-green);">履歴データ解析中...</p>
          </div>
        </div><!-- end coverage-charts -->
      `;
      
      // フッターと終了タグ
      html += `
            <div class="footer">
              <p>テスト実行: ${new Date().toLocaleString('ja-JP')}</p>
              <p class="magi-sign">MAGI SYSTEM v.1.15 - AT FIELD STABILITY: 100%</p>
              <p>NERV HQ - 第3新東京市</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      // ファイルに書き込み - eva-nerv-report.htmlではなくvisual-report.htmlに出力
      fs.writeFileSync(path.join(outputDir, 'visual-report.html'), html);
      this.log('エヴァンゲリオン風レポートを生成しました: ' + path.join(outputDir, 'visual-report.html'), 'INFO');
    } catch (error) {
      this.log('ビジュアルレポート生成中にエラーが発生しました: ' + error.message, 'ERROR');
      
      // 最小限のエラーレポートを生成
      const basicHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>NERV SYSTEM ERROR</title>
          <style>
            body { 
              font-family: monospace; 
              background-color: black; 
              color: red;
              margin: 20px;
            }
            .error { 
              animation: blink 1s infinite; 
            }
            @keyframes blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          </style>
        </head>
        <body>
          <h1>NERV SYSTEM CRITICAL ERROR</h1>
          <p class="error">${error.message}</p>
          <p>詳細結果は ./test-results/detailed-results.json を確認してください。</p>
          <p>エラーコード: 601 - MAGI SYSTEM FAILURE</p>
        </body>
        </html>
      `;
      
      fs.writeFileSync(path.join(outputDir, 'visual-report.html'), basicHtml);
    }
  }
  
  /**
   * カバレッジバーのクラスを取得
   * @param {number} value 現在の値
   * @param {number} threshold 目標値
   * @returns {string} クラス名
   */
  getCoverageBarClass(value, threshold) {
    if (value >= threshold) {
      return 'success';
    } else if (value >= threshold * 0.7) {
      return 'warning';
    }
    return 'critical';
  }
  
  /**
   * NERV風のステータス記号を取得
   * @param {number} value 現在の値
   * @param {number} threshold 目標値
   * @returns {string} ステータス記号
   */
  getNervStatusSymbol(value, threshold) {
    if (value >= threshold) {
      return '<span style="color: var(--nerv-green);">ACCEPTABLE [◯]</span>';
    }
    return '<span style="color: var(--nerv-red); animation: blink 1s infinite;">CRITICAL [×]</span>';
  }
  
  /**
   * カバレッジ目標値を取得
   * @param {string} level 目標レベル
   * @returns {Object} しきい値設定
   */
  getCoverageThresholds(level) {
    // デフォルトのしきい値設定
    const thresholds = {
      initial: {
        statements: 30,
        branches: 20,
        functions: 25,
        lines: 30
      },
      mid: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60
      },
      final: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80
      }
    };
    
    // 設定ファイルからしきい値を取得（可能であれば）
    try {
      const reporterConfig = require('./jest-reporter.config.js');
      if (reporterConfig && reporterConfig.baseOptions && 
          reporterConfig.baseOptions.coverageReport && 
          reporterConfig.baseOptions.coverageReport.thresholds) {
        return reporterConfig.baseOptions.coverageReport.thresholds[level] || thresholds[level];
      }
    } catch (error) {
      this.log('レポーター設定の読み込みに失敗しました: ' + error.message, 'WARNING');
    }
    
    return thresholds[level] || thresholds.initial;
  }
  
  // これ以下にEvaNervReporterクラスの他のメソッドを追加...
}

module.exports = EvaNervReporter;
