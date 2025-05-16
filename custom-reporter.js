/**
 * ファイルパス: custom-reporter.js
 * 
 * Jestカスタムレポーター - エヴァンゲリオン風NERV視覚化システム
 * テスト結果の詳細情報を収集し、エヴァンゲリオン風ビジュアルレポートを生成
 * 
 * @author Portfolio Manager Team / NERV
 * @created 2025-05-26
 * @updated 2025-05-15 - 出力ファイル名を visual-report.html に変更
 * @updated 2025-05-16 - グラフ部分をCSS/HTMLのみで実装し、外部スクリプト不要に変更
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

    // カバレッジ履歴データ
    this.coverageHistory = [];
    // 履歴データファイルを確認して読み込む
    this.loadCoverageHistory();
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

  /**
   * カバレッジ履歴データを読み込む
   * @returns {void}
   */
  loadCoverageHistory() {
    const historyFile = path.resolve('./test-results/coverage-history.json');
    
    if (!fs.existsSync(historyFile)) {
      // 履歴ファイルがない場合は空配列をセット
      this.coverageHistory = [];
      return;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      this.coverageHistory = Array.isArray(data) ? data : [];
      this.log(`カバレッジ履歴データを読み込みました: ${this.coverageHistory.length}件`, 'INFO');
    } catch (error) {
      this.log('カバレッジ履歴データの読み込みに失敗しました: ' + error.message, 'WARNING');
      this.coverageHistory = [];
    }
  }

  /**
   * カバレッジ履歴データを保存する
   * @param {Object} currentData 現在のカバレッジデータ
   */
  saveCoverageHistory(currentData) {
    const historyFile = path.resolve('./test-results/coverage-history.json');
    
    // 現在の日付
    const today = new Date().toISOString().split('T')[0];
    
    // 同じ日付のデータがあれば上書き、なければ追加
    const existingIndex = this.coverageHistory.findIndex(item => item.date === today);
    
    const newDataPoint = {
      date: today,
      statements: currentData.statements.pct,
      branches: currentData.branches.pct,
      functions: currentData.functions.pct,
      lines: currentData.lines.pct
    };
    
    if (existingIndex >= 0) {
      this.coverageHistory[existingIndex] = newDataPoint;
    } else {
      this.coverageHistory.push(newDataPoint);
    }
    
    // 履歴を最大30日分に制限
    const limitedHistory = this.coverageHistory.slice(-30);
    
    try {
      fs.writeFileSync(historyFile, JSON.stringify(limitedHistory, null, 2));
      this.log('カバレッジ履歴データを保存しました', 'INFO');
    } catch (error) {
      this.log('カバレッジ履歴データの保存に失敗しました: ' + error.message, 'WARNING');
    }
  }

  /**
   * 数値を小数点以下2桁に丸める
   * @param {number} num 丸める数値
   * @returns {number} 丸められた数値
   */
  roundToTwo(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
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
              --statements-color: #4285F4;
              --branches-color: #34A853;
              --functions-color: #FBBC05;
              --lines-color: #EA4335;
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

            @keyframes growRight {
              from { width: 0; }
              to { width: 100%; }
            }

            @keyframes appear {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
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
              animation: growRight 1.5s ease-out;
            }
            
            .coverage-bar-fill.success {
              background-color: var(--nerv-green);
            }
            
            .coverage-bar-fill.warning {
              background-color: var(--nerv-orange);
            }
            
            .coverage-bar-fill.critical {
              background-color: var(--nerv-red);
              animation: blink 2s infinite, growRight 1.5s ease-out;
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
              border-top: 1px solid var(--grid-line);
              padding-top: 20px;
            }
            .coverage-charts h2 {
              text-align: center;
              margin-bottom: 20px;
            }
            .chart-container {
              display: flex;
              flex-direction: column;
              justify-content: center;
              margin-bottom: 30px;
              padding: 20px;
              background-color: rgba(0, 0, 0, 0.6);
              border: 1px solid var(--grid-line);
            }

            /* バーチャートのスタイル（CSSのみ） */
            .css-bar-chart {
              display: grid;
              grid-template-columns: 160px 1fr 80px 100px;
              gap: 10px;
              margin-bottom: 20px;
            }

            .css-bar-chart-header {
              grid-column: 1 / -1;
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding-bottom: 10px;
              border-bottom: 1px solid var(--grid-line);
              margin-bottom: 15px;
            }

            .css-bar-chart-title {
              font-size: 1.2rem;
              color: var(--nerv-green);
            }

            .css-bar-chart-date {
              font-size: 0.9rem;
              color: var(--nerv-blue);
            }

            .css-bar-label {
              color: var(--nerv-white);
              font-weight: bold;
              padding: 5px;
              text-transform: uppercase;
            }

            .css-bar-container {
              position: relative;
              height: 40px;
              background-color: rgba(20, 20, 20, 0.5);
              border: 1px solid var(--grid-line);
            }

            .css-bar-fill {
              height: 100%;
              width: 0;
              position: absolute;
              top: 0;
              left: 0;
              z-index: 1;
              transition: width 1.5s ease-out;
              animation: growRight 1.5s ease-out forwards;
            }

            .css-bar-target {
              position: absolute;
              top: 0;
              height: 100%;
              border-right: 2px dashed rgba(255, 255, 255, 0.3);
              z-index: 2;
            }

            .css-bar-target::after {
              content: attr(data-target);
              position: absolute;
              top: -20px;
              right: -15px;
              font-size: 0.8rem;
              color: var(--nerv-white);
            }

            .css-bar-fill.statements {
              background-color: var(--statements-color);
            }

            .css-bar-fill.branches {
              background-color: var(--branches-color);
            }

            .css-bar-fill.functions {
              background-color: var(--functions-color);
            }

            .css-bar-fill.lines {
              background-color: var(--lines-color);
            }

            .css-bar-percentage {
              font-weight: bold;
              text-align: right;
              color: var(--nerv-white);
              padding: 5px;
            }

            .css-bar-counts {
              font-size: 0.9rem;
              text-align: right;
              color: var(--nerv-blue);
              padding: 5px;
            }

            /* ラインチャートのスタイル（CSSのみ） */
            .css-line-chart {
              height: 300px;
              position: relative;
              border: 1px solid var(--grid-line);
              margin-top: 40px;
              background-color: rgba(20, 20, 20, 0.5);
              padding: 20px 30px 30px 60px;
            }

            .css-line-chart-header {
              position: absolute;
              top: -30px;
              left: 0;
              width: 100%;
              display: flex;
              justify-content: space-between;
              padding: 5px 30px 5px 60px;
            }

            .css-line-chart-title {
              font-size: 1.2rem;
              color: var(--nerv-green);
            }

            .css-line-chart-legend {
              display: flex;
              gap: 20px;
            }

            .css-legend-item {
              display: flex;
              align-items: center;
              gap: 5px;
              font-size: 0.9rem;
            }

            .css-legend-color {
              width: 12px;
              height: 12px;
              border-radius: 2px;
            }

            .css-legend-color.statements {
              background-color: var(--statements-color);
            }

            .css-legend-color.branches {
              background-color: var(--branches-color);
            }

            .css-legend-color.functions {
              background-color: var(--functions-color);
            }

            .css-legend-color.lines {
              background-color: var(--lines-color);
            }

            .css-line-chart-grid {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              z-index: 1;
            }

            .css-line-chart-y-axis {
              position: absolute;
              top: 0;
              left: 0;
              height: 100%;
              width: 60px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              padding: 20px 0;
            }

            .css-line-chart-y-label {
              position: relative;
              font-size: 0.8rem;
              color: var(--nerv-white);
              text-align: right;
              width: 100%;
              padding-right: 10px;
            }

            .css-line-chart-x-axis {
              position: absolute;
              bottom: 0;
              left: 60px;
              width: calc(100% - 60px);
              height: 30px;
              display: flex;
              justify-content: space-between;
            }

            .css-line-chart-x-label {
              font-size: 0.8rem;
              color: var(--nerv-white);
              text-align: center;
              transform: rotate(-45deg);
              transform-origin: top left;
              position: absolute;
              bottom: -25px;
              width: 100px;
            }

            .css-line-chart-horizontal-line {
              position: absolute;
              left: 60px;
              width: calc(100% - 60px);
              height: 1px;
              background-color: rgba(255, 255, 255, 0.1);
              z-index: 1;
            }

            .css-line-chart-vertical-line {
              position: absolute;
              top: 20px;
              height: calc(100% - 50px);
              width: 1px;
              background-color: rgba(255, 255, 255, 0.1);
              z-index: 1;
            }

            .css-line-chart-line {
              position: absolute;
              z-index: 2;
              stroke-width: 2px;
              fill: none;
              animation: appear 1s ease-out forwards;
            }

            .css-line-chart-dot {
              position: absolute;
              width: 6px;
              height: 6px;
              border-radius: 50%;
              z-index: 3;
              transform: translate(-3px, -3px);
              animation: appear 1s ease-out forwards;
            }

            .css-line-chart-target-line {
              position: absolute;
              left: 60px;
              width: calc(100% - 60px);
              height: 1px;
              background-color: rgba(255, 255, 255, 0.3);
              z-index: 2;
              border-top: 1px dashed;
            }

            .css-line-chart-target-line.statements {
              border-color: var(--statements-color);
            }

            .css-line-chart-target-line.branches {
              border-color: var(--branches-color);
            }

            .css-line-chart-target-line.functions {
              border-color: var(--functions-color);
            }

            .css-line-chart-target-line.lines {
              border-color: var(--lines-color);
            }

            .css-line-chart-target-label {
              position: absolute;
              right: 10px;
              font-size: 0.8rem;
              transform: translateY(-50%);
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

              .css-bar-chart {
                grid-template-columns: 100px 1fr;
                grid-template-rows: auto auto;
              }

              .css-bar-percentage, .css-bar-counts {
                grid-column: 2;
                text-align: left;
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

          // 現在のカバレッジデータを保存
          const currentData = {
            statements: {
              pct: total.statements.pct,
              covered: total.statements.covered,
              total: total.statements.total
            },
            branches: {
              pct: total.branches.pct,
              covered: total.branches.covered,
              total: total.branches.total
            },
            functions: {
              pct: total.functions.pct,
              covered: total.functions.covered,
              total: total.functions.total
            },
            lines: {
              pct: total.lines.pct,
              covered: total.lines.covered,
              total: total.lines.total
            }
          };

          // 履歴データを保存
          this.saveCoverageHistory(currentData);

          // CSSのみのバーチャートを作成
          html += `
            <div id="coverage-charts" class="coverage-charts">
              <h2>コードカバレッジチャート</h2>
              <div id="bar-chart-container" class="chart-container">
                <div class="css-bar-chart">
                  <div class="css-bar-chart-header">
                    <div class="css-bar-chart-title">コードカバレッジ詳細</div>
                    <div class="css-bar-chart-date">${new Date().toLocaleDateString('ja-JP')}</div>
                  </div>

                  <div class="css-bar-label">ステートメント</div>
                  <div class="css-bar-container">
                    <div class="css-bar-fill statements" style="width: ${total.statements.pct}%;"></div>
                    <div class="css-bar-target" style="left: ${targetThresholds.statements}%;" data-target="${targetThresholds.statements}%"></div>
                  </div>
                  <div class="css-bar-percentage">${total.statements.pct.toFixed(2)}%</div>
                  <div class="css-bar-counts">${total.statements.covered}/${total.statements.total}</div>

                  <div class="css-bar-label">ブランチ</div>
                  <div class="css-bar-container">
                    <div class="css-bar-fill branches" style="width: ${total.branches.pct}%;"></div>
                    <div class="css-bar-target" style="left: ${targetThresholds.branches}%;" data-target="${targetThresholds.branches}%"></div>
                  </div>
                  <div class="css-bar-percentage">${total.branches.pct.toFixed(2)}%</div>
                  <div class="css-bar-counts">${total.branches.covered}/${total.branches.total}</div>

                  <div class="css-bar-label">関数</div>
                  <div class="css-bar-container">
                    <div class="css-bar-fill functions" style="width: ${total.functions.pct}%;"></div>
                    <div class="css-bar-target" style="left: ${targetThresholds.functions}%;" data-target="${targetThresholds.functions}%"></div>
                  </div>
                  <div class="css-bar-percentage">${total.functions.pct.toFixed(2)}%</div>
                  <div class="css-bar-counts">${total.functions.covered}/${total.functions.total}</div>

                  <div class="css-bar-label">コード行</div>
                  <div class="css-bar-container">
                    <div class="css-bar-fill lines" style="width: ${total.lines.pct}%;"></div>
                    <div class="css-bar-target" style="left: ${targetThresholds.lines}%;" data-target="${targetThresholds.lines}%"></div>
                  </div>
                  <div class="css-bar-percentage">${total.lines.pct.toFixed(2)}%</div>
                  <div class="css-bar-counts">${total.lines.covered}/${total.lines.total}</div>
                </div>
              </div>
          `;

          // 履歴データがある場合はラインチャートを追加
          if (this.coverageHistory.length > 0) {
            // Y軸の最大値を計算（最大値 + 10％ または 100％のいずれか大きい方）
            const allValues = [
              ...this.coverageHistory.map(d => d.statements),
              ...this.coverageHistory.map(d => d.branches),
              ...this.coverageHistory.map(d => d.functions),
              ...this.coverageHistory.map(d => d.lines),
              total.statements.pct,
              total.branches.pct, 
              total.functions.pct,
              total.lines.pct
            ];
            
            const maxValue = Math.max(100, Math.ceil((Math.max(...allValues) + 10) / 10) * 10);
            
            // 表示する日付データを制限（最新の7件）
            const displayedHistory = [...this.coverageHistory].slice(-6);
            
            // 現在のデータを追加
            displayedHistory.push({
              date: new Date().toISOString().split('T')[0],
              statements: total.statements.pct,
              branches: total.branches.pct,
              functions: total.functions.pct,
              lines: total.lines.pct
            });

            // Y軸のラベルを生成
            let yAxisHtml = '';
            for (let i = 0; i <= 100; i += 20) {
              yAxisHtml += `
                <div class="css-line-chart-y-label" style="bottom: ${i}%;">${i}%</div>
                <div class="css-line-chart-horizontal-line" style="bottom: ${i}%;"></div>
              `;
            }

            // X軸のラベルとデータポイントの生成
            let xAxisHtml = '';
            const pointsStatements = [];
            const pointsBranches = [];
            const pointsFunctions = [];
            const pointsLines = [];
            
            displayedHistory.forEach((item, index) => {
              const xPercentage = (index / (displayedHistory.length - 1)) * 100;
              xAxisHtml += `
                <div class="css-line-chart-x-label" style="left: ${xPercentage}%;">${item.date.substring(5)}</div>
                <div class="css-line-chart-vertical-line" style="left: calc(60px + ${xPercentage}% * (100% - 60px) / 100);"></div>
              `;
              
              // データポイント座標の計算
              const xPos = `calc(60px + ${xPercentage}% * (100% - 60px) / 100)`;
              pointsStatements.push({
                x: xPos,
                y: `calc(100% - ${item.statements / maxValue * 100}% - 30px)`,
                value: item.statements
              });
              
              pointsBranches.push({
                x: xPos,
                y: `calc(100% - ${item.branches / maxValue * 100}% - 30px)`,
                value: item.branches
              });
              
              pointsFunctions.push({
                x: xPos,
                y: `calc(100% - ${item.functions / maxValue * 100}% - 30px)`,
                value: item.functions
              });
              
              pointsLines.push({
                x: xPos,
                y: `calc(100% - ${item.lines / maxValue * 100}% - 30px)`,
                value: item.lines
              });
            });

            // ターゲットラインの位置を計算
            const targetStatementsPos = `calc(100% - ${targetThresholds.statements / maxValue * 100}% - 30px)`;
            const targetBranchesPos = `calc(100% - ${targetThresholds.branches / maxValue * 100}% - 30px)`;
            const targetFunctionsPos = `calc(100% - ${targetThresholds.functions / maxValue * 100}% - 30px)`;
            const targetLinesPos = `calc(100% - ${targetThresholds.lines / maxValue * 100}% - 30px)`;

            // ラインチャートのHTMLを生成
            html += `
              <div id="line-chart-container" class="chart-container">
                <div class="css-line-chart">
                  <div class="css-line-chart-header">
                    <div class="css-line-chart-title">カバレッジ履歴</div>
                    <div class="css-line-chart-legend">
                      <div class="css-legend-item">
                        <div class="css-legend-color statements"></div>
                        <div>ステートメント</div>
                      </div>
                      <div class="css-legend-item">
                        <div class="css-legend-color branches"></div>
                        <div>ブランチ</div>
                      </div>
                      <div class="css-legend-item">
                        <div class="css-legend-color functions"></div>
                        <div>関数</div>
                      </div>
                      <div class="css-legend-item">
                        <div class="css-legend-color lines"></div>
                        <div>コード行</div>
                      </div>
                    </div>
                  </div>
                  
                  <div class="css-line-chart-y-axis">
                    ${yAxisHtml}
                  </div>
                  
                  <div class="css-line-chart-x-axis">
                    ${xAxisHtml}
                  </div>
                  
                  <!-- ターゲットライン -->
                  <div class="css-line-chart-target-line statements" style="top: ${targetStatementsPos};">
                    <span class="css-line-chart-target-label" style="color: var(--statements-color);">
                      ステートメント: ${targetThresholds.statements}%
                    </span>
                  </div>
                  <div class="css-line-chart-target-line branches" style="top: ${targetBranchesPos};">
                    <span class="css-line-chart-target-label" style="color: var(--branches-color);">
                      ブランチ: ${targetThresholds.branches}%
                    </span>
                  </div>
                  <div class="css-line-chart-target-line functions" style="top: ${targetFunctionsPos};">
                    <span class="css-line-chart-target-label" style="color: var(--functions-color);">
                      関数: ${targetThresholds.functions}%
                    </span>
                  </div>
                  <div class="css-line-chart-target-line lines" style="top: ${targetLinesPos};">
                    <span class="css-line-chart-target-label" style="color: var(--lines-color);">
                      コード行: ${targetThresholds.lines}%
                    </span>
                  </div>
            `;

            // データポイントとライン描画
            function generatePoints(points, colorClass) {
              let html = '';
              
              // 点を描画
              points.forEach((point, index) => {
                html += `
                  <div class="css-line-chart-dot ${colorClass}"
                       style="left: ${point.x}; top: ${point.y}; background-color: var(--${colorClass}-color);"
                       title="${point.value.toFixed(2)}%">
                  </div>
                `;
              });
              
              return html;
            }

            // 各指標のデータポイントを描画
            html += generatePoints(pointsStatements, 'statements');
            html += generatePoints(pointsBranches, 'branches');
            html += generatePoints(pointsFunctions, 'functions');
            html += generatePoints(pointsLines, 'lines');

            // ラインチャートのHTMLを閉じる
            html += `
                </div>
              </div>
            `;
          } else {
            html += `
              <div id="line-chart-container" class="chart-container">
                <p style="color: var(--nerv-orange); text-align: center;">
                  履歴データがありません。複数回テストを実行すると履歴が表示されます。
                </p>
              </div>
            `;
          }

          // カバレッジチャート部分を閉じる
          html += `</div><!-- end coverage-charts -->`;
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
      
      // ファイルに書き込み - visual-report.htmlに出力
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
  
  // これ以下にEvaNervReporterクラスの他のメソッドを追加...
}

module.exports = EvaNervReporter;
