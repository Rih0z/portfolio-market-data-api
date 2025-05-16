/**
 * ファイルパス: custom-reporter.js
 * 
 * Jestカスタムレポーター - 最適化版
 * テスト結果の詳細情報を収集し、ビジュアルレポートとJSONデータを生成する
 * コマンドライン出力を最適化
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-12
 * @updated 2025-05-22 - コマンドライン出力とエラー表示を大幅に改善
 */

const fs = require('fs');
const path = require('path');

/**
 * カスタムJestレポータークラス
 */
class CustomReporter {
  constructor(globalConfig, options = {}) {
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
    
    // 出力設定 - 環境変数から取得
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
    this.logFile = `${this.logDir}/test-run-${new Date().toISOString().replace(/:/g, '-').slice(0, 19)}.log`;
    this.errorLogFile = `${this.logDir}/test-errors-${new Date().toISOString().replace(/:/g, '-').slice(0, 19)}.log`;
    
    // 初期ログ
    fs.writeFileSync(this.logFile, `=== テスト実行開始: ${new Date().toISOString()} ===\n\n`);
    fs.writeFileSync(this.errorLogFile, `=== エラーログ: ${new Date().toISOString()} ===\n\n`);
    
    // オリジナルのコンソール出力を保存
    this.originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error
    };
    
    // 色の設定
    this.colors = {
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m',
      magenta: '\x1b[35m',
      dim: '\x1b[2m',
      bold: '\x1b[1m',
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
   * テスト実行開始時に呼び出される
   */
  onRunStart(results, options) {
    this.startTime = Date.now();
    
    this.print('テスト実行を開始します...', 'step');
    
    // 進捗状況を表示するためのカウンター初期化
    this.progressCount = 0;
    this.totalTestCount = 0;
    this.testFiles = [];
    this.lastProgressLine = '';
    
    // テスト環境情報を記録
    this.log(`テスト環境: Node.js ${process.version}`, 'INFO');
    this.log(`Jest バージョン: ${results.jestVersion || 'unknown'}`, 'INFO');
    this.log(`テストモード: ${process.env.NODE_ENV}`, 'INFO');
    this.log(`出力モード: ${this.superQuietMode ? '最小限' : this.quietMode ? '標準' : '詳細'}`, 'INFO');
    
    // 進捗バーの初期表示
    this.updateProgressBar(0, 0);
  }
  
  /**
   * テストファイル実行開始時に呼び出される
   */
  onTestFileStart(test) {
    const relativePath = path.relative(process.cwd(), test.path);
    this.log(`テストファイル開始: ${relativePath}`, 'INFO');
    
    // ファイル名のみを取得（パスなし）
    const fileName = path.basename(test.path);
    
    // 進捗バーに現在のファイル名を表示
    if (!this.superQuietMode) {
      this.updateProgressBar(this.progressCount, this.totalTestCount, `実行中: ${fileName}`);
    }
  }
  
  /**
   * テストファイル実行完了時に呼び出される
   */
  onTestFileResult(test, testResult, aggregatedResult) {
    // カバレッジ情報が利用可能な場合は保存
    if (testResult.coverage) {
      this.results.coverageMap = aggregatedResult.coverageMap;
    }
    
    // テスト結果を整形して保存
    const formattedResult = {
      testFilePath: testResult.testFilePath,
      testResults: testResult.testResults.map(result => ({
        title: result.title,
        status: result.status,
        duration: result.duration,
        failureMessages: result.failureMessages
      })),
      numFailingTests: testResult.numFailingTests,
      numPassingTests: testResult.numPassingTests,
      numPendingTests: testResult.numPendingTests
    };
    
    this.results.testResults.push(formattedResult);
    
    // ファイル相対パス
    const relativePath = path.relative(process.cwd(), testResult.testFilePath);
    
    // ファイル実行結果をログに記録
    this.log(`テストファイル完了: ${relativePath} (成功: ${testResult.numPassingTests}, 失敗: ${testResult.numFailingTests}, スキップ: ${testResult.numPendingTests})`, testResult.numFailingTests > 0 ? 'ERROR' : 'INFO');
    
    // テストファイルの数をカウント
    this.testFiles.push(testResult.testFilePath);
    this.totalTestCount = aggregatedResult.numTotalTests || 0;
    this.passedCount = aggregatedResult.numPassedTests || 0;
    this.failedCount = aggregatedResult.numFailedTests || 0;
    this.pendingCount = aggregatedResult.numPendingTests || 0;
    this.progressCount = this.passedCount + this.failedCount + this.pendingCount;
    
    // 進捗バーを更新
    this.updateProgressBar(this.progressCount, this.totalTestCount);
    
    // 失敗したテストがある場合は詳細を表示（静音モードでなければ）
    if (testResult.numFailingTests > 0 && !this.superQuietMode) {
      // 失敗したテストの情報を表示
      this.print(`ファイル: ${relativePath} - ${testResult.numFailingTests}件のテストが失敗`, 'error');
      
      if (!this.quietMode) {
        // 失敗したテストのタイトルを表示
        testResult.testResults
          .filter(r => r.status === 'failed')
          .forEach((r, i) => {
            this.print(`  ${i+1}. ${r.title}`, 'error');
          });
      }
      
      // 進捗バーを再表示
      process.stdout.write(this.lastProgressLine);
    }
  }
  
  /**
   * 進捗バーを更新
   * @param {number} current 現在のテスト数
   * @param {number} total 全テスト数
   * @param {string} status ステータスメッセージ
   */
  updateProgressBar(current, total, status = '') {
    if (this.superQuietMode) {
      return; // 超静音モードでは進捗バーを表示しない
    }
    
    const percent = total ? Math.floor((current / total) * 100) : 0;
    const width = 30; // 進捗バーの幅
    const completed = Math.floor((width * current) / (total || 1));
    const remaining = width - completed;
    
    // バーを作成
    const bar = 
      this.colors.green + '█'.repeat(completed) + 
      this.colors.reset + '░'.repeat(remaining) + 
      this.colors.reset;
    
    // 進捗情報
    let statusInfo = '';
    if (this.passedCount > 0) statusInfo += `${this.colors.green}✓ ${this.passedCount}${this.colors.reset} `;
    if (this.failedCount > 0) statusInfo += `${this.colors.red}✗ ${this.failedCount}${this.colors.reset} `;
    if (this.pendingCount > 0) statusInfo += `${this.colors.yellow}- ${this.pendingCount}${this.colors.reset} `;
    
    // ステータスメッセージ
    const statusText = status ? ` ${this.colors.cyan}${status}${this.colors.reset}` : '';
    
    // 進捗行を作成
    this.lastProgressLine = `\r[${bar}] ${percent}% (${current}/${total || 0}) ${statusInfo}${statusText}`;
    
    // 前の行を上書き
    process.stdout.write(this.lastProgressLine);
  }
  
  /**
   * テスト実行完了時に呼び出される
   */
  onRunComplete(contexts, results) {
    this.endTime = Date.now();
    
    // 進捗バーを完了させる
    if (!this.superQuietMode) {
      // 改行を追加（進捗バーの後）
      process.stdout.write('\n\n');
    }
    
    // 結果の集計
    this.results.numTotalTests = results.numTotalTests;
    this.results.numFailedTests = results.numFailedTests;
    this.results.numPassedTests = results.numPassedTests;
    this.results.numPendingTests = results.numPendingTests;
    
    // カバレッジ情報を含める
    if (results.coverageMap) {
      this.results.coverageMap = results.coverageMap;
    } else {
      // カバレッジマップがない場合は、ファイルから直接読み込む
      this.loadCoverageFromFile();
    }
    
    // テスト結果ディレクトリを作成
    const outputDir = path.resolve('./test-results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 詳細結果をJSONファイルに保存
    fs.writeFileSync(
      path.join(outputDir, 'detailed-results.json'),
      JSON.stringify(this.results, null, 2)
    );
    
    // マークダウン形式のレポートを生成
    this.generateMarkdownReport(outputDir);
    
    // HTMLビジュアルレポートを生成
    this.generateVisualReport(outputDir);
    
    // 結果サマリーを表示
    this.printSummary(results);
    
    // カバレッジチャートを生成（環境変数が設定されている場合）
    if (process.env.GENERATE_COVERAGE_CHART === 'true') {
      try {
        this.print('カバレッジチャートを生成しています...', 'info');
        
        // チャート生成スクリプトを実行
        require('../scripts/generate-coverage-chart');
        
        this.print('カバレッジチャートが生成されました', 'success');
      } catch (error) {
        this.print(`カバレッジチャートの生成に失敗しました: ${error.message}`, 'error');
      }
    }
  }
  
  /**
   * カバレッジ情報をファイルから読み込む
   */
  loadCoverageFromFile() {
    try {
      this.log('カバレッジ情報をファイルから読み込みます...', 'INFO');
      
      // カバレッジデータファイルのパス
      const coveragePath = path.resolve('./coverage/coverage-final.json');
      
      // ファイルが存在するか確認
      if (!fs.existsSync(coveragePath)) {
        this.log('カバレッジデータファイルが見つかりません:', 'WARNING');
        
        // 代替ファイルのチェック
        const alternateFiles = [
          './coverage/lcov.info',
          './coverage/coverage-summary.json',
          './coverage/clover.xml'
        ];
        
        for (const file of alternateFiles) {
          const filePath = path.resolve(file);
          if (fs.existsSync(filePath)) {
            this.log(`代替カバレッジファイルが見つかりました: ${file}`, 'INFO');
            
            // summaryファイルからの読み込みを試みる
            if (file === './coverage/coverage-summary.json') {
              try {
                const summaryData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                this.createSimpleCoverageMap(summaryData);
                this.log('カバレッジサマリーからデータを読み込みました', 'INFO');
                return;
              } catch (e) {
                this.log(`サマリーファイルの解析に失敗しました: ${e.message}`, 'ERROR');
              }
            }
            return;
          }
        }
        
        this.log('代替カバレッジファイルも見つかりません', 'WARNING');
        this.log('Jest実行時に --coverage オプションが指定されているか確認してください', 'WARNING');
        return;
      }
      
      // カバレッジデータを読み込む
      const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      
      // カバレッジマップを作成
      this.createCoverageMapFromData(coverageData);
      this.log('カバレッジデータをファイルから読み込みました', 'INFO');
    } catch (error) {
      this.log(`カバレッジデータの読み込みに失敗しました: ${error.message}`, 'ERROR');
    }
  }
  
  /**
   * カバレッジデータからカバレッジマップを作成
   * @param {Object} coverageData 
   */
  createCoverageMapFromData(coverageData) {
    // 簡易的なカバレッジマップを構築
    const fileCoverageInfo = [];
    let totalStatements = { covered: 0, total: 0, pct: 0 };
    let totalBranches = { covered: 0, total: 0, pct: 0 };
    let totalFunctions = { covered: 0, total: 0, pct: 0 };
    let totalLines = { covered: 0, total: 0, pct: 0 };
    
    // 各ファイルのカバレッジデータを処理
    for (const [filePath, fileData] of Object.entries(coverageData)) {
      // ステートメント
      const statementCovered = Object.values(fileData.s).filter(v => v > 0).length;
      const statementTotal = Object.keys(fileData.s).length;
      const statementPct = statementTotal ? (statementCovered / statementTotal) * 100 : 0;
      
      // ブランチ
      const branchData = fileData.b || {};
      let branchCovered = 0;
      let branchTotal = 0;
      
      for (const counts of Object.values(branchData)) {
        branchTotal += counts.length;
        branchCovered += counts.filter(c => c > 0).length;
      }
      
      const branchPct = branchTotal ? (branchCovered / branchTotal) * 100 : 0;
      
      // 関数
      const functionCovered = Object.values(fileData.f).filter(v => v > 0).length;
      const functionTotal = Object.keys(fileData.f).length;
      const functionPct = functionTotal ? (functionCovered / functionTotal) * 100 : 0;
      
      // 行
      const lineCovered = Object.values(fileData.l || {}).filter(v => v > 0).length;
      const lineTotal = Object.keys(fileData.l || {}).length;
      const linePct = lineTotal ? (lineCovered / lineTotal) * 100 : 0;
      
      // ファイル情報を追加
      fileCoverageInfo.push({
        filename: filePath,
        statements: { covered: statementCovered, total: statementTotal, pct: statementPct },
        branches: { covered: branchCovered, total: branchTotal, pct: branchPct },
        functions: { covered: functionCovered, total: functionTotal, pct: functionPct },
        lines: { covered: lineCovered, total: lineTotal, pct: linePct }
      });
      
      // 合計に加算
      totalStatements.covered += statementCovered;
      totalStatements.total += statementTotal;
      
      totalBranches.covered += branchCovered;
      totalBranches.total += branchTotal;
      
      totalFunctions.covered += functionCovered;
      totalFunctions.total += functionTotal;
      
      totalLines.covered += lineCovered;
      totalLines.total += lineTotal;
    }
    
    // パーセンテージを計算
    totalStatements.pct = totalStatements.total ? (totalStatements.covered / totalStatements.total) * 100 : 0;
    totalBranches.pct = totalBranches.total ? (totalBranches.covered / totalBranches.total) * 100 : 0;
    totalFunctions.pct = totalFunctions.total ? (totalFunctions.covered / totalFunctions.total) * 100 : 0;
    totalLines.pct = totalLines.total ? (totalLines.covered / totalLines.total) * 100 : 0;
    
    // カバレッジマップを設定
    this.results.coverageMap = {
      getFileCoverageInfo: () => fileCoverageInfo,
      getCoverageSummary: () => ({
        toJSON: () => ({
          statements: totalStatements,
          branches: totalBranches,
          functions: totalFunctions,
          lines: totalLines
        })
      }),
      total: {
        statements: totalStatements,
        branches: totalBranches,
        functions: totalFunctions,
        lines: totalLines
      }
    };
  }
  
  /**
   * サマリーデータから簡易的なカバレッジマップを作成
   * @param {Object} summaryData 
   */
  createSimpleCoverageMap(summaryData) {
    const fileCoverageInfo = [];
    
    // totalデータを取得
    const total = summaryData.total || {};
    
    // ファイルデータを処理
    for (const [filePath, fileData] of Object.entries(summaryData)) {
      if (filePath === 'total') continue;
      
      fileCoverageInfo.push({
        filename: filePath,
        statements: fileData.statements || { covered: 0, total: 0, pct: 0 },
        branches: fileData.branches || { covered: 0, total: 0, pct: 0 },
        functions: fileData.functions || { covered: 0, total: 0, pct: 0 },
        lines: fileData.lines || { covered: 0, total: 0, pct: 0 }
      });
    }
    
    // カバレッジマップを設定
    this.results.coverageMap = {
      getFileCoverageInfo: () => fileCoverageInfo,
      getCoverageSummary: () => ({
        toJSON: () => ({
          statements: total.statements || { covered: 0, total: 0, pct: 0 },
          branches: total.branches || { covered: 0, total: 0, pct: 0 },
          functions: total.functions || { covered: 0, total: 0, pct: 0 },
          lines: total.lines || { covered: 0, total: 0, pct: 0 }
        })
      }),
      total: {
        statements: total.statements || { covered: 0, total: 0, pct: 0 },
        branches: total.branches || { covered: 0, total: 0, pct: 0 },
        functions: total.functions || { covered: 0, total: 0, pct: 0 },
        lines: total.lines || { covered: 0, total: 0, pct: 0 }
      }
    };
  }
  
  /**
   * マークダウン形式のレポートを生成
   * @param {string} outputDir 出力ディレクトリ
   */
  generateMarkdownReport(outputDir) {
    let md = `# テスト実行結果\n\n`;
    md += `実行日時: ${new Date().toLocaleString('ja-JP')}\n\n`;
    md += `合計時間: ${((this.endTime - this.startTime) / 1000).toFixed(2)}秒\n\n`;
    
    // 結果サマリー
    md += `## サマリー\n\n`;
    md += `- 合計テスト数: ${this.results.numTotalTests}\n`;
    md += `- 成功: ${this.results.numPassedTests}\n`;
    md += `- 失敗: ${this.results.numFailedTests}\n`;
    md += `- スキップ: ${this.results.numPendingTests}\n\n`;
    
    // カバレッジ情報
    if (this.results.coverageMap) {
      md += `## カバレッジ\n\n`;
      
      try {
        const total = this.results.coverageMap.getCoverageSummary().toJSON();
        
        md += `| メトリクス     | カバード | 合計 | パーセント |\n`;
        md += `|--------------|------:|-----:|--------:|\n`;
        md += `| ステートメント | ${total.statements.covered} | ${total.statements.total} | ${total.statements.pct.toFixed(2)}% |\n`;
        md += `| ブランチ      | ${total.branches.covered} | ${total.branches.total} | ${total.branches.pct.toFixed(2)}% |\n`;
        md += `| 関数         | ${total.functions.covered} | ${total.functions.total} | ${total.functions.pct.toFixed(2)}% |\n`;
        md += `| 行           | ${total.lines.covered} | ${total.lines.total} | ${total.lines.pct.toFixed(2)}% |\n\n`;
        
        // カバレッジ目標ステータス
        const targetLevel = process.env.COVERAGE_TARGET || 'initial';
        
        md += `### カバレッジ目標ステータス (${targetLevel})\n\n`;
        
        const targetThresholds = this.getCoverageThresholds(targetLevel);
        
        md += `| メトリクス     | 現在    | 目標    | ステータス |\n`;
        md += `|--------------|-------:|-------:|----------|\n`;
        md += `| ステートメント | ${total.statements.pct.toFixed(2)}% | ${targetThresholds.statements}% | ${this.getStatusSymbol(total.statements.pct, targetThresholds.statements)} |\n`;
        md += `| ブランチ      | ${total.branches.pct.toFixed(2)}% | ${targetThresholds.branches}% | ${this.getStatusSymbol(total.branches.pct, targetThresholds.branches)} |\n`;
        md += `| 関数         | ${total.functions.pct.toFixed(2)}% | ${targetThresholds.functions}% | ${this.getStatusSymbol(total.functions.pct, targetThresholds.functions)} |\n`;
        md += `| 行           | ${total.lines.pct.toFixed(2)}% | ${targetThresholds.lines}% | ${this.getStatusSymbol(total.lines.pct, targetThresholds.lines)} |\n\n`;
        
        // ファイルごとのカバレッジ情報
        md += `### ファイルごとのカバレッジ\n\n`;
        
        const fileCoverage = this.results.coverageMap.getFileCoverageInfo();
        fileCoverage.sort((a, b) => a.filename.localeCompare(b.filename));
        
        md += `| ファイル | ステートメント | ブランチ | 関数 | 行 |\n`;
        md += `|---------|------------:|-------:|-----:|----:|\n`;
        
        fileCoverage.forEach(file => {
          const filename = path.relative(process.cwd(), file.filename);
          md += `| ${filename} | ${file.statements.pct.toFixed(2)}% | ${file.branches.pct.toFixed(2)}% | ${file.functions.pct.toFixed(2)}% | ${file.lines.pct.toFixed(2)}% |\n`;
        });
        
        md += `\n`;
      } catch (error) {
        md += `カバレッジ情報の取得に失敗しました: ${error.message}\n\n`;
      }
    } else {
      md += `## カバレッジ\n\n`;
      md += `カバレッジ情報が利用できません。テスト実行時に--coverageオプションを付けてください。\n\n`;
    }
    
    // エラーがある場合はエラーサマリーを追加
    if (this.results.numFailedTests > 0) {
      md += `## エラーサマリー\n\n`;
      
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
        md += `### ${index + 1}. ${test.title}\n\n`;
        md += `ファイル: \`${relativePath}\`\n\n`;
        md += `エラーメッセージ:\n\n`;
        md += `\`\`\`\n${test.failureMessages.join('\n')}\n\`\`\`\n\n`;
      });
    }
    
    // マークダウンファイルに書き込み
    fs.writeFileSync(path.join(outputDir, 'test-log.md'), md);
  }
  
  /**
   * HTMLビジュアルレポートを生成
   * @param {string} outputDir 出力ディレクトリ
   */
  generateVisualReport(outputDir) {
    try {
      // 基本的なHTMLテンプレート
      let html = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Portfolio Market Data API テスト結果</title>
          <style>
            :root {
              --primary-color: #4285F4;
              --success-color: #34A853;
              --warning-color: #FBBC05;
              --error-color: #EA4335;
              --background-color: #F8F9FA;
              --text-color: #202124;
              --border-color: #DADCE0;
            }
            
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: var(--text-color);
              background-color: var(--background-color);
              margin: 0;
              padding: 20px;
            }
            
            .container {
              max-width: 1200px;
              margin: 0 auto;
              background-color: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            
            h1, h2, h3 {
              color: var(--primary-color);
            }
            
            .summary {
              display: flex;
              justify-content: space-between;
              flex-wrap: wrap;
              margin: 20px 0;
              gap: 10px;
            }
            
            .summary-box {
              flex: 1;
              min-width: 200px;
              padding: 15px;
              border-radius: 8px;
              text-align: center;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
              color: white;
            }
            
            .summary-box.total {
              background-color: var(--primary-color);
            }
            
            .summary-box.passed {
              background-color: var(--success-color);
            }
            
            .summary-box.failed {
              background-color: var(--error-color);
            }
            
            .summary-box.skipped {
              background-color: var(--warning-color);
            }
            
            .summary-box h2 {
              margin: 0;
              color: white;
              font-size: 2.5rem;
            }
            
            .summary-box p {
              margin: 5px 0 0;
              font-size: 1.1rem;
            }
            
            .coverage-section {
              margin: 30px 0;
              padding: 20px;
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            
            th, td {
              padding: 12px 15px;
              text-align: left;
              border-bottom: 1px solid var(--border-color);
            }
            
            th {
              background-color: var(--primary-color);
              color: white;
            }
            
            tr:nth-child(even) {
              background-color: rgba(0, 0, 0, 0.03);
            }
            
            .coverage-row {
              display: flex;
              align-items: center;
              margin: 10px 0;
            }
            
            .coverage-label {
              width: 150px;
              font-weight: bold;
            }
            
            .coverage-bar {
              flex: 1;
              height: 30px;
              background-color: #e0e0e0;
              border-radius: 4px;
              overflow: hidden;
              margin: 0 10px;
            }
            
            .coverage-bar-fill {
              height: 100%;
              background-color: var(--success-color);
            }
            
            .coverage-percentage {
              width: 70px;
              font-weight: bold;
              text-align: right;
            }
            
            .file-path {
              font-family: monospace;
              font-size: 0.9rem;
              color: var(--primary-color);
            }
            
            .error-section {
              margin: 30px 0;
              padding: 20px;
              background-color: #FFF3F3;
              border-radius: 8px;
              border-left: 5px solid var(--error-color);
            }
            
            .error-message {
              font-family: monospace;
              padding: 15px;
              background-color: #333;
              color: #fff;
              border-radius: 4px;
              overflow-x: auto;
              max-height: 300px;
            }
            
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
            
            .footer {
              margin-top: 30px;
              text-align: center;
              color: #666;
              font-size: 0.9rem;
              border-top: 1px solid var(--border-color);
              padding-top: 20px;
            }
            
            @media (max-width: 768px) {
              .summary-box {
                min-width: 100%;
                margin-bottom: 10px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Portfolio Market Data API テスト結果</h1>
            <p>実行日時: ${new Date().toLocaleString('ja-JP')}</p>
            <p>実行時間: ${((this.endTime - this.startTime) / 1000).toFixed(2)}秒</p>
            
            <div class="summary">
              <div class="summary-box total">
                <h2>${this.results.numTotalTests}</h2>
                <p>合計テスト数</p>
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
                <p>スキップ</p>
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
            <div class="coverage-section">
              <h2>カバレッジ情報</h2>
              
              <div class="coverage-row">
                <div class="coverage-label">ステートメント</div>
                <div class="coverage-bar">
                  <div class="coverage-bar-fill" style="width: ${total.statements.pct}%;"></div>
                </div>
                <div class="coverage-percentage">${total.statements.pct.toFixed(2)}%</div>
                <div>${total.statements.covered}/${total.statements.total}</div>
              </div>
              
              <div class="coverage-row">
                <div class="coverage-label">ブランチ</div>
                <div class="coverage-bar">
                  <div class="coverage-bar-fill" style="width: ${total.branches.pct}%;"></div>
                </div>
                <div class="coverage-percentage">${total.branches.pct.toFixed(2)}%</div>
                <div>${total.branches.covered}/${total.branches.total}</div>
              </div>
              
              <div class="coverage-row">
                <div class="coverage-label">関数</div>
                <div class="coverage-bar">
                  <div class="coverage-bar-fill" style="width: ${total.functions.pct}%;"></div>
                </div>
                <div class="coverage-percentage">${total.functions.pct.toFixed(2)}%</div>
                <div>${total.functions.covered}/${total.functions.total}</div>
              </div>
              
              <div class="coverage-row">
                <div class="coverage-label">行</div>
                <div class="coverage-bar">
                  <div class="coverage-bar-fill" style="width: ${total.lines.pct}%;"></div>
                </div>
                <div class="coverage-percentage">${total.lines.pct.toFixed(2)}%</div>
                <div>${total.lines.covered}/${total.lines.total}</div>
              </div>
              
              <h3>カバレッジ目標ステータス (${targetLevel})</h3>
              <table>
                <thead>
                  <tr>
                    <th>メトリクス</th>
                    <th>現在</th>
                    <th>目標</th>
                    <th>ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>ステートメント</td>
                    <td>${total.statements.pct.toFixed(2)}%</td>
                    <td>${targetThresholds.statements}%</td>
                    <td>${this.getStatusSymbol(total.statements.pct, targetThresholds.statements)}</td>
                  </tr>
                  <tr>
                    <td>ブランチ</td>
                    <td>${total.branches.pct.toFixed(2)}%</td>
                    <td>${targetThresholds.branches}%</td>
                    <td>${this.getStatusSymbol(total.branches.pct, targetThresholds.branches)}</td>
                  </tr>
                  <tr>
                    <td>関数</td>
                    <td>${total.functions.pct.toFixed(2)}%</td>
                    <td>${targetThresholds.functions}%</td>
                    <td>${this.getStatusSymbol(total.functions.pct, targetThresholds.functions)}</td>
                  </tr>
                  <tr>
                    <td>行</td>
                    <td>${total.lines.pct.toFixed(2)}%</td>
                    <td>${targetThresholds.lines}%</td>
                    <td>${this.getStatusSymbol(total.lines.pct, targetThresholds.lines)}</td>
                  </tr>
                </tbody>
              </table>
              
              <h3>ファイルごとのカバレッジ</h3>
              <table>
                <thead>
                  <tr>
                    <th>ファイル</th>
                    <th>ステートメント</th>
                    <th>ブランチ</th>
                    <th>関数</th>
                    <th>行</th>
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
              <h2>カバレッジ情報の取得に失敗しました</h2>
              <p>${error.message}</p>
            </div>
          `;
        }
      } else {
        html += `
          <div class="coverage-section">
            <h2>カバレッジ情報</h2>
            <p>カバレッジ情報が利用できません。テスト実行時に--coverageオプションを付けてください。</p>
          </div>
        `;
      }
      
      // エラーがある場合
      if (this.results.numFailedTests > 0) {
        html += `
          <div class="error-section">
            <h2>エラーサマリー</h2>
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
            <p class="file-path">ファイル: ${relativePath}</p>
            <div class="error-message">
              <pre>${test.failureMessages.join('\n')}</pre>
            </div>
          `;
        });
        
        html += `
          </div>
        `;
      }
      
      // カバレッジチャート用のプレースホルダー
      html += `
        <div class="coverage-charts">
          <h2>コードカバレッジチャート</h2>
          <div class="chart-container">
            <!-- カバレッジチャートがここに挿入されます -->
          </div>
        </div><!-- end coverage-charts -->
      `;
      
      // フッターと終了タグ
      html += `
            <div class="footer">
              <p>テスト実行: ${new Date().toLocaleString('ja-JP')}</p>
              <p>レポート生成: custom-reporter.js</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      // ファイルに書き込み
      fs.writeFileSync(path.join(outputDir, 'visual-report.html'), html);
      this.log('ビジュアルレポートを生成しました: ' + path.join(outputDir, 'visual-report.html'), 'INFO');
    } catch (error) {
      this.log('ビジュアルレポート生成中にエラーが発生しました: ' + error.message, 'ERROR');
      
      // 最小限のエラーレポートを生成
      const basicHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>テスト結果 - エラー</title>
          <style>
            body { font-family: sans-serif; margin: 20px; }
            .error { color: red; }
          </style>
        </head>
        <body>
          <h1>テスト結果レポート生成エラー</h1>
          <p class="error">${error.message}</p>
          <p>詳細結果は ./test-results/detailed-results.json を確認してください。</p>
        </body>
        </html>
      `;
      
      fs.writeFileSync(path.join(outputDir, 'visual-report.html'), basicHtml);
    }
  }
  
  /**
   * カバレッジ目標値を取得
   * @param {string} targetLevel 目標レベル（'initial', 'mid', 'final'）
   * @returns {Object} 閾値オブジェクト
   */
  getCoverageThresholds(targetLevel) {
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
    
    return thresholds[targetLevel] || thresholds.initial;
  }
  
  /**
   * 目標レベルの名前を取得
   * @param {string} targetLevel 目標レベル
   * @returns {string} 目標レベルの名前
   */
  getTargetLevelName(targetLevel) {
    const names = {
      initial: '初期段階 (20-30%)',
      mid: '中間段階 (40-60%)',
      final: '最終段階 (70-80%)'
    };
    
    return names[targetLevel] || names.initial;
  }
  
  /**
   * ステータス記号を取得
   * @param {number} value 現在の値
   * @param {number} threshold 目標値
   * @returns {string} ステータス記号
   */
  getStatusSymbol(value, threshold) {
    return value >= threshold ? '✅ 達成' : '❌ 未達成';
  }
  
  /**
   * 結果サマリーをコンソールに表示
   * @param {Object} results テスト結果
   */
  printSummary(results) {
    // テキスト装飾
    const green = this.colors.green;
    const red = this.colors.red;
    const yellow = this.colors.yellow;
    const blue = this.colors.blue;
    const cyan = this.colors.cyan;
    const bold = this.colors.bold;
    const reset = this.colors.reset;
    
    // ヘッダーを表示
    this.print('', 'result');
    this.print(`${blue}${bold}========== テスト実行結果 ==========${reset}`, 'result');
    
    // 基本情報
    const elapsedTime = ((this.endTime - this.startTime) / 1000).toFixed(1);
    this.print(`実行時間: ${elapsedTime}秒`, 'result');
    
    // テスト結果の概要
    this.print(`テスト結果: ${results.numTotalTests} 件のテスト`, 'result');
    
    // 詳細結果
    const passedText = `${green}${results.numPassedTests} 件成功${reset}`;
    const failedText = results.numFailedTests > 0 
      ? `${red}${results.numFailedTests} 件失敗${reset}` 
      : `${results.numFailedTests} 件失敗`;
    const pendingText = results.numPendingTests > 0 
      ? `${yellow}${results.numPendingTests} 件スキップ${reset}` 
      : `${results.numPendingTests} 件スキップ`;
    
    this.print(`  ${passedText}, ${failedText}, ${pendingText}`, 'result');
    
    // カバレッジ情報（簡潔に表示）
    if (this.results.coverageMap) {
      try {
        const total = this.results.coverageMap.getCoverageSummary().toJSON();
        const targetLevel = process.env.COVERAGE_TARGET || 'initial';
        const targetThresholds = this.getCoverageThresholds(targetLevel);
        
        this.print('', 'result');
        this.print(`${cyan}${bold}カバレッジ状況:${reset}`, 'result');
        
        // 各カバレッジメトリクスを表示
        const statementsStatus = total.statements.pct >= targetThresholds.statements;
        const branchesStatus = total.branches.pct >= targetThresholds.branches;
        const functionsStatus = total.functions.pct >= targetThresholds.functions;
        const linesStatus = total.lines.pct >= targetThresholds.lines;
        
        const statementsSymbol = statementsStatus ? `${green}✓${reset}` : `${red}✗${reset}`;
        const branchesSymbol = branchesStatus ? `${green}✓${reset}` : `${red}✗${reset}`;
        const functionsSymbol = functionsStatus ? `${green}✓${reset}` : `${red}✗${reset}`;
        const linesSymbol = linesStatus ? `${green}✓${reset}` : `${red}✗${reset}`;
        
        this.print(`  ${statementsSymbol} ステートメント: ${total.statements.pct.toFixed(1)}% (目標: ${targetThresholds.statements}%)`, 'result');
        this.print(`  ${branchesSymbol} ブランチ:       ${total.branches.pct.toFixed(1)}% (目標: ${targetThresholds.branches}%)`, 'result');
        this.print(`  ${functionsSymbol} 関数:         ${total.functions.pct.toFixed(1)}% (目標: ${targetThresholds.functions}%)`, 'result');
        this.print(`  ${linesSymbol} 行:           ${total.lines.pct.toFixed(1)}% (目標: ${targetThresholds.lines}%)`, 'result');
        
        // 目標達成状況
        const allTargetsMet = statementsStatus && branchesStatus && functionsStatus && linesStatus;
        
        if (allTargetsMet) {
          this.print(`${green}✓ すべてのカバレッジ目標を達成しています！${reset}`, 'result');
        } else {
          this.print(`${yellow}⚠ いくつかのカバレッジ目標が未達成です${reset}`, 'result');
        }
      } catch (error) {
        this.print(`${red}カバレッジ情報の取得に失敗しました${reset}`, 'result');
      }
    } else {
      this.print(`${yellow}⚠ カバレッジデータが利用できません${reset}`, 'result');
    }
    
    // 最終結果（成功/失敗）
    this.print('', 'result');
    if (results.numFailedTests > 0) {
      this.print(`${red}${bold}✗ テスト失敗${reset}`, 'result');
      
      // 失敗したテストの情報（最大5件まで）
      const failedTests = this.results.testResults.flatMap(fileResult =>
        fileResult.testResults
          .filter(test => test.status === 'failed')
          .map(test => ({
            file: path.relative(process.cwd(), fileResult.testFilePath),
            title: test.title
          }))
      ).slice(0, 5);
      
      this.print(`失敗したテスト:`, 'result');
      failedTests.forEach((test, i) => {
        this.print(`  ${i+1}. ${red}${test.title}${reset}`, 'result');
        this.print(`     ${this.colors.dim}(${test.file})${reset}`, 'result');
      });
      
      if (this.results.numFailedTests > 5) {
        this.print(`  ${yellow}... 他 ${this.results.numFailedTests - 5} 件${reset}`, 'result');
      }
    } else {
      this.print(`${green}${bold}✓ すべてのテストが成功しました！${reset}`, 'result');
    }
    
    // レポートファイルの場所
    this.print('', 'result');
    this.print(`${blue}詳細レポート:${reset}`, 'result');
    this.print(`  HTMLレポート: ./test-results/visual-report.html`, 'result');
    this.print(`  テストログ:   ./test-results/test-log.md`, 'result');
    this.print(`  エラーログ:   ${this.errorLogFile}`, 'result');
  }
}

module.exports = CustomReporter;

