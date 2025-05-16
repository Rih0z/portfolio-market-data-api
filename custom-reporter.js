/**
 * ファイルパス: custom-reporter.js
 * 
 * Jestカスタムレポーター
 * テスト結果の詳細情報を収集し、ビジュアルレポートとJSONデータを生成する
 * コンソール出力を最小限に抑えて、ログファイルに詳細情報を出力する
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-12
 * @updated 2025-05-17 - カバレッジデータをファイルから直接読み込む機能を追加
 * @updated 2025-05-20 - コンソール出力を最小限に抑える機能を追加
 * @updated 2025-05-21 - コンソール出力をさらに最適化し、ログファイルへの出力を強化
 */

const fs = require('fs');
const path = require('path');

// ログディレクトリの設定
const LOG_DIR = './test-results/logs';
const LOG_FILE = `${LOG_DIR}/custom-reporter-${new Date().toISOString().replace(/:/g, '-')}.log`;

// ログディレクトリが存在しない場合は作成
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ログファイルの初期化
fs.writeFileSync(LOG_FILE, `=== CustomReporter Log: ${new Date().toISOString()} ===\n\n`);

// ロガー関数
function logToFile(message) {
  fs.appendFileSync(LOG_FILE, `${message}\n`);
}

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
    
    // コンソール出力の設定
    this.quietMode = process.env.CI !== 'true' && 
                     process.env.DEBUG !== 'true' && 
                     process.env.VERBOSE_MODE !== 'true';
    
    // 強制的に最小限出力を有効化
    this.superQuietMode = process.env.QUIET_MODE === 'true'; 
    
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
    
    logToFile(`Reporter initialized with quietMode=${this.quietMode}, superQuietMode=${this.superQuietMode}`);
  }
  
  /**
   * 進捗状況を表示（最小限の出力）
   * @param {string} message メッセージ
   * @param {string} type メッセージのタイプ（info, success, warn, error）
   */
  printProgress(message, type = 'info') {
    // ログファイルには常に出力
    logToFile(`[${type.toUpperCase()}] ${message}`);
    
    if (this.quietMode) {
      // 最小限モードでも失敗と重要なメッセージは表示
      if (type === 'error' || (this.superQuietMode && type === 'error')) {
        let color = this.colors.reset;
        let prefix = '';
        
        switch (type) {
          case 'success':
            color = this.colors.green;
            prefix = '✓ ';
            break;
          case 'warn':
            color = this.colors.yellow;
            prefix = '⚠ ';
            break;
          case 'error':
            color = this.colors.red;
            prefix = '✗ ';
            break;
          case 'info':
          default:
            color = this.colors.blue;
            prefix = '• ';
            break;
        }
        
        this.originalConsole.log(`${color}${prefix}${message}${this.colors.reset}`);
      }
    } else {
      // 通常モードでは全て表示
      this.originalConsole.log(message);
    }
  }
  
  /**
   * テスト実行開始時に呼び出される
   */
  onRunStart(results, options) {
    this.startTime = Date.now();
    logToFile("==== Test Run Started ====");
    logToFile(`Time: ${new Date().toISOString()}`);
    logToFile(`Configuration: ${JSON.stringify(this.globalConfig, null, 2)}`);
    
    // コンソールの動作を制御
    if (this.superQuietMode) {
      // 完全に静かなモードの場合、Jest内部の出力も抑制
      process.stdout.write = ((write) => {
        return (chunk, encoding, callback) => {
          // 進捗バーと最終結果のみ表示
          if (typeof chunk === 'string') {
            // ログファイルに出力
            logToFile(`[STDOUT] ${chunk}`);
            
            // 重要なメッセージのみコンソールに表示
            if (chunk.startsWith('[') || 
                chunk.includes('テスト実行') ||
                chunk.includes('Test Suites:')) {
              return write.call(process.stdout, chunk, encoding, callback);
            }
          }
          // その他は無視
          if (callback) callback();
          return true;
        };
      })(process.stdout.write);
      
      // エラー出力も同様に処理
      process.stderr.write = ((write) => {
        return (chunk, encoding, callback) => {
          // ログファイルに出力
          if (typeof chunk === 'string') {
            logToFile(`[STDERR] ${chunk}`);
            
            // エラーメッセージのみコンソールに表示
            if (chunk.includes('ERROR') || chunk.includes('FAIL')) {
              return write.call(process.stderr, chunk, encoding, callback);
            }
          }
          if (callback) callback();
          return true;
        };
      })(process.stderr.write);
    }
    
    // 進捗状況を表示するためのカウンター初期化
    this.progressCount = 0;
    this.totalTestCount = 0;
    this.testFiles = [];
    this.lastProgressLine = '';
    
    // 進捗バーの初期表示
    this.updateProgressBar(0, 0);
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
    
    // ログにテスト結果を記録
    logToFile(`Test file completed: ${testResult.testFilePath}`);
    logToFile(`  Passing: ${testResult.numPassingTests}, Failing: ${testResult.numFailingTests}, Pending: ${testResult.numPendingTests}`);
    
    // 失敗したテストの詳細をログに記録
    if (testResult.numFailingTests > 0) {
      logToFile("  Failed tests:");
      testResult.testResults
        .filter(test => test.status === 'failed')
        .forEach(test => {
          logToFile(`    - ${test.title}`);
          logToFile(`      ${test.failureMessages.join('\n      ')}`);
        });
    }
    
    this.results.testResults.push(formattedResult);
    
    // テストファイルの数をカウント
    this.testFiles.push(testResult.testFilePath);
    this.totalTestCount = aggregatedResult.numTotalTests || 0;
    this.passedCount = aggregatedResult.numPassedTests || 0;
    this.failedCount = aggregatedResult.numFailedTests || 0;
    this.pendingCount = aggregatedResult.numPendingTests || 0;
    this.progressCount = this.passedCount + this.failedCount + this.pendingCount;
    
    // 進捗バーを更新
    this.updateProgressBar(this.progressCount, this.totalTestCount);
    
    // 失敗したテストがある場合は進捗バーのみを表示（QuietModeでなければ）
    if (testResult.numFailingTests > 0 && !this.superQuietMode && !this.quietMode) {
      const relativePath = path.relative(process.cwd(), testResult.testFilePath);
      process.stdout.write(`\r${this.colors.red}✗ ${relativePath}: ${testResult.numFailingTests}件失敗${this.colors.reset}\n`);
      // 進捗バーを再表示
      process.stdout.write(this.lastProgressLine);
    }
  }
  
  /**
   * 進捗バーを更新
   * @param {number} current 現在のテスト数
   * @param {number} total 全テスト数
   */
  updateProgressBar(current, total) {
    const percent = total ? Math.floor((current / total) * 100) : 0;
    const width = 30; // 進捗バーの幅
    const completed = Math.floor((width * current) / (total || 1));
    const remaining = width - completed;
    
    // バーを作成
    const bar = 
      this.colors.green + '■'.repeat(completed) + 
      this.colors.reset + '□'.repeat(remaining) + 
      this.colors.reset;
    
    // 進捗情報
    let status = '';
    if (this.passedCount > 0) status += `${this.colors.green}✓ ${this.passedCount}${this.colors.reset} `;
    if (this.failedCount > 0) status += `${this.colors.red}✗ ${this.failedCount}${this.colors.reset} `;
    if (this.pendingCount > 0) status += `${this.colors.yellow}- ${this.pendingCount}${this.colors.reset} `;
    
    // 進捗行を作成
    this.lastProgressLine = `\r[${bar}] ${percent}% (${current}/${total || 0}) ${status}`;
    
    // superQuietModeが無効かつquietModeが無効な場合に表示
    if (!this.superQuietMode && !this.quietMode) {
      // 前の行を上書き
      process.stdout.write(this.lastProgressLine);
    }
    
    // ログに記録
    logToFile(`Progress: ${percent}% (${current}/${total || 0}) - Passed: ${this.passedCount}, Failed: ${this.failedCount}, Pending: ${this.pendingCount}`);
  }
  
  /**
   * テスト実行完了時に呼び出される
   */
  onRunComplete(contexts, results) {
    this.endTime = Date.now();
    
    // 進捗バーを完了させる
    if (!this.superQuietMode && !this.quietMode) {
      // 改行を追加（進捗バーの後）
      process.stdout.write('\n\n');
    }
    
    // 結果の集計
    this.results.numTotalTests = results.numTotalTests;
    this.results.numFailedTests = results.numFailedTests;
    this.results.numPassedTests = results.numPassedTests;
    this.results.numPendingTests = results.numPendingTests;
    
    // ログに結果を記録
    logToFile("==== Test Run Completed ====");
    logToFile(`Total: ${results.numTotalTests}, Passed: ${results.numPassedTests}, Failed: ${results.numFailedTests}, Pending: ${results.numPendingTests}`);
    logToFile(`Time: ${((this.endTime - this.startTime) / 1000).toFixed(2)}s`);
    
    // カバレッジ情報を含める
    if (results.coverageMap) {
      this.results.coverageMap = results.coverageMap;
      logToFile("Coverage data available from Jest");
    } else {
      // カバレッジマップがない場合は、ファイルから直接読み込む
      logToFile("Attempting to load coverage data from file");
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
    logToFile(`Saved detailed results to ${path.join(outputDir, 'detailed-results.json')}`);
    
    // マークダウン形式のレポートを生成
    this.generateMarkdownReport(outputDir);
    
    // HTMLビジュアルレポートを生成
    this.generateVisualReport(outputDir);
    
    // 結果サマリーを表示
    this.printSummary(results);
  }
  
  /**
   * カバレッジ情報をファイルから読み込む
   */
  loadCoverageFromFile() {
    try {
      logToFile('Loading coverage information from file...');
      
      // カバレッジデータファイルのパス
      const coveragePath = path.resolve('./coverage/coverage-final.json');
      
      // ファイルが存在するか確認
      if (!fs.existsSync(coveragePath)) {
        logToFile(`Coverage data file not found: ${coveragePath}`);
        
        // 別の可能性のあるファイルを探す
        const alternateFiles = [
          './coverage/lcov.info',
          './coverage/coverage-summary.json',
          './coverage/clover.xml'
        ];
        
        let foundAlternate = false;
        for (const file of alternateFiles) {
          const filePath = path.resolve(file);
          if (fs.existsSync(filePath)) {
            logToFile(`Found alternative coverage file: ${file}`);
            foundAlternate = true;
            
            // summaryファイルからの読み込みを試みる
            if (file === './coverage/coverage-summary.json') {
              try {
                const summaryData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                // 簡易的なカバレッジマップを構築
                this.createSimpleCoverageMap(summaryData);
                logToFile('Loaded coverage data from summary');
                return;
              } catch (e) {
                logToFile(`Failed to parse summary file: ${e.message}`);
              }
            }
            break;
          }
        }
        
        if (!foundAlternate) {
          logToFile('No alternative coverage files found.');
          logToFile('Make sure --coverage option is specified when running Jest.');
        }
        
        return;
      }
      
      // カバレッジデータを読み込む
      const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      
      // カバレッジマップを作成
      this.createCoverageMapFromData(coverageData);
      logToFile('Successfully loaded coverage data from file');
    } catch (error) {
      logToFile(`Failed to load coverage data: ${error.message}`);
      logToFile(error.stack);
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
    
    // ログにカバレッジサマリーを出力
    logToFile(`Coverage summary: Statements: ${totalStatements.pct.toFixed(2)}%, Branches: ${totalBranches.pct.toFixed(2)}%, Functions: ${totalFunctions.pct.toFixed(2)}%, Lines: ${totalLines.pct.toFixed(2)}%`);
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
    
    // ログにカバレッジサマリーを出力
    const statements = total.statements || { pct: 0 };
    const branches = total.branches || { pct: 0 };
    const functions = total.functions || { pct: 0 };
    const lines = total.lines || { pct: 0 };
    
    logToFile(`Coverage summary: Statements: ${statements.pct.toFixed(2)}%, Branches: ${branches.pct.toFixed(2)}%, Functions: ${functions.pct.toFixed(2)}%, Lines: ${lines.pct.toFixed(2)}%`);
  }
  
  /**
   * マークダウン形式のレポートを生成
   * @param {string} outputDir 出力ディレクトリ
   */
  generateMarkdownReport(outputDir) {
    logToFile("Generating Markdown report...");
    
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
        logToFile(`Error generating coverage report: ${error.message}`);
        logToFile(error.stack);
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
    const mdFilePath = path.join(outputDir, 'test-log.md');
    fs.writeFileSync(mdFilePath, md);
    logToFile(`Markdown report saved to ${mdFilePath}`);
  }
  
  /**
   * HTMLビジュアルレポートを生成
   * @param {string} outputDir 出力ディレクトリ
   */
  generateVisualReport(outputDir) {
    logToFile("Generating visual HTML report...");
    
    try {
      // 簡易的なHTMLレポートを生成（実際の実装はさらに高度になる）
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>テスト結果レポート</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              max-width: 1200px;
              margin: 0 auto;
              background-color: #fff;
              padding: 20px;
              border-radius: 5px;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            h1 {
              color: #2c3e50;
              border-bottom: 2px solid #3498db;
              padding-bottom: 10px;
            }
            h2 {
              color: #3498db;
              margin-top: 30px;
            }
            .summary {
              display: flex;
              justify-content: space-between;
              background-color: #f8f9fa;
              padding: 15px;
              border-radius: 4px;
              margin-bottom: 20px;
            }
            .summary-item {
              text-align: center;
            }
            .summary-label {
              font-size: 0.9em;
              color: #7f8c8d;
            }
            .summary-value {
              font-size: 1.8em;
              font-weight: bold;
            }
            .success { color: #27ae60; }
            .warn { color: #f39c12; }
            .error { color: #e74c3c; }
            .coverage-table, .files-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            .coverage-table th, .coverage-table td,
            .files-table th, .files-table td {
              padding: 12px 15px;
              border-bottom: 1px solid #ddd;
              text-align: left;
            }
            .coverage-table th, .files-table th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            .bar-container {
              background-color: #ecf0f1;
              height: 10px;
              width: 100%;
              border-radius: 5px;
              overflow: hidden;
            }
            .bar {
              height: 100%;
              border-radius: 5px;
            }
            .threshold-initial { background-color: #e74c3c; }
            .threshold-mid { background-color: #f39c12; }
            .threshold-final { background-color: #27ae60; }
            .error-box {
              background-color: #fff0f0;
              border-left: 4px solid #e74c3c;
              padding: 15px;
              margin: 15px 0;
            }
            .error-title {
              font-weight: bold;
              margin-bottom: 10px;
            }
            .error-message {
              font-family: monospace;
              white-space: pre-wrap;
              background-color: #f8f8f8;
              padding: 10px;
              overflow-x: auto;
              border-radius: 3px;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              color: #7f8c8d;
              font-size: 0.9em;
            }
            code {
              font-family: monospace;
              background-color: #f8f8f8;
              padding: 2px 4px;
              border-radius: 3px;
            }
            
            /* カバレッジチャート用のスタイル */
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
          </style>
        </head>
        <body>
          <div class="container">
            <h1>テスト実行結果</h1>
            <p>実行日時: ${new Date().toLocaleString('ja-JP')}</p>
            <p>合計時間: ${((this.endTime - this.startTime) / 1000).toFixed(2)}秒</p>
            
            <div class="summary">
              <div class="summary-item">
                <div class="summary-label">合計テスト</div>
                <div class="summary-value">${this.results.numTotalTests}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">成功</div>
                <div class="summary-value success">${this.results.numPassedTests}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">失敗</div>
                <div class="summary-value ${this.results.numFailedTests > 0 ? 'error' : ''}">${this.results.numFailedTests}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">スキップ</div>
                <div class="summary-value ${this.results.numPendingTests > 0 ? 'warn' : ''}">${this.results.numPendingTests}</div>
              </div>
            </div>
            
            ${this.results.coverageMap ? this.generateCoverageHTML() : `
            <h2>カバレッジ</h2>
            <p>カバレッジ情報が利用できません。テスト実行時に--coverageオプションを付けてください。</p>
            `}
            
            ${this.results.numFailedTests > 0 ? this.generateErrorsHTML() : ''}
            
            <div class="footer">
              <p>生成日時: ${new Date().toLocaleString('ja-JP')}</p>
              <p>Portfolio Market Data API テスト実行レポート</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      const htmlFilePath = path.join(outputDir, 'visual-report.html');
      fs.writeFileSync(htmlFilePath, htmlContent);
      logToFile(`Visual HTML report saved to ${htmlFilePath}`);
    } catch (error) {
      logToFile(`Error generating visual report: ${error.message}`);
      logToFile(error.stack);
      
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
      
      const errorHtmlPath = path.join(outputDir, 'visual-report.html');
      fs.writeFileSync(errorHtmlPath, basicHtml);
      logToFile(`Error HTML report saved to ${errorHtmlPath}`);
    }
  }
  
  /**
   * カバレッジHTML部分を生成
   * @returns {string} HTML文字列
   */
  generateCoverageHTML() {
    try {
      const total = this.results.coverageMap.getCoverageSummary().toJSON();
      const targetLevel = process.env.COVERAGE_TARGET || 'initial';
      const targetThresholds = this.getCoverageThresholds(targetLevel);
      
      return `
        <h2>カバレッジサマリー</h2>
        <table class="coverage-table">
          <tr>
            <th>メトリクス</th>
            <th>カバード</th>
            <th>合計</th>
            <th>パーセント</th>
            <th>目標値</th>
            <th>ステータス</th>
          </tr>
          <tr>
            <td>ステートメント</td>
            <td>${total.statements.covered}</td>
            <td>${total.statements.total}</td>
            <td>${total.statements.pct.toFixed(2)}%</td>
            <td>${targetThresholds.statements}%</td>
            <td>${this.getStatusSymbol(total.statements.pct, targetThresholds.statements)}</td>
          </tr>
          <tr>
            <td>ブランチ</td>
            <td>${total.branches.covered}</td>
            <td>${total.branches.total}</td>
            <td>${total.branches.pct.toFixed(2)}%</td>
            <td>${targetThresholds.branches}%</td>
            <td>${this.getStatusSymbol(total.branches.pct, targetThresholds.branches)}</td>
          </tr>
          <tr>
            <td>関数</td>
            <td>${total.functions.covered}</td>
            <td>${total.functions.total}</td>
            <td>${total.functions.pct.toFixed(2)}%</td>
            <td>${targetThresholds.functions}%</td>
            <td>${this.getStatusSymbol(total.functions.pct, targetThresholds.functions)}</td>
          </tr>
          <tr>
            <td>行</td>
            <td>${total.lines.covered}</td>
            <td>${total.lines.total}</td>
            <td>${total.lines.pct.toFixed(2)}%</td>
            <td>${targetThresholds.lines}%</td>
            <td>${this.getStatusSymbol(total.lines.pct, targetThresholds.lines)}</td>
          </tr>
        </table>
        
        <h2>ファイルごとのカバレッジ</h2>
        <table class="files-table">
          <tr>
            <th>ファイル</th>
            <th>ステートメント</th>
            <th>ブランチ</th>
            <th>関数</th>
            <th>行</th>
          </tr>
          ${this.results.coverageMap.getFileCoverageInfo().map(file => {
            const filename = path.relative(process.cwd(), file.filename);
            return `
              <tr>
                <td>${filename}</td>
                <td>${file.statements.pct.toFixed(2)}%</td>
                <td>${file.branches.pct.toFixed(2)}%</td>
                <td>${file.functions.pct.toFixed(2)}%</td>
                <td>${file.lines.pct.toFixed(2)}%</td>
              </tr>
            `;
          }).join('')}
        </table>
      `;
    } catch (error) {
      logToFile(`Error generating coverage HTML: ${error.message}`);
      return `<h2>カバレッジ</h2><p>カバレッジ情報の取得に失敗しました: ${error.message}</p>`;
    }
  }
  
  /**
   * エラーHTML部分を生成
   * @returns {string} HTML文字列
   */
  generateErrorsHTML() {
    const failedTests = this.results.testResults.flatMap(fileResult =>
      fileResult.testResults
        .filter(test => test.status === 'failed')
        .map(test => ({
          testFilePath: fileResult.testFilePath,
          title: test.title,
          failureMessages: test.failureMessages
        }))
    );
    
    return `
      <h2>エラーサマリー</h2>
      ${failedTests.map((test, index) => {
        const relativePath = path.relative(process.cwd(), test.testFilePath);
        return `
          <div class="error-box">
            <div class="error-title">${index + 1}. ${test.title}</div>
            <div>ファイル: <code>${relativePath}</code></div>
            <div class="error-message">${test.failureMessages.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          </div>
        `;
      }).join('')}
    `;
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
   * ステータス絵文字を取得
   * @param {number} value 現在の値
   * @param {number} threshold 目標値
   * @returns {string} ステータス絵文字
   */
  getStatusEmoji(value, threshold) {
    return value >= threshold ? '✅' : '❌';
  }
  
  /**
   * 結果サマリーをコンソールに表示
   * @param {Object} results テスト結果
   */
  printSummary(results) {
    // 完全静音モードの場合、出力を最小限に抑える
    if (this.superQuietMode) {
      this.printMinimalSummary(results);
      return;
    }
    
    // テキスト装飾
    const green = this.colors.green;
    const red = this.colors.red;
    const yellow = this.colors.yellow;
    const blue = this.colors.blue;
    const bold = this.colors.bold;
    const reset = this.colors.reset;
    
    // スペースを追加
    this.originalConsole.log('');
    
    // 簡潔な結果表示
    this.originalConsole.log(`${blue}${bold}========== テスト実行結果 ==========${reset}`);
    this.originalConsole.log(`実行時間: ${((this.endTime - this.startTime) / 1000).toFixed(2)}秒`);
    
    // テスト結果の概要
    const testResultSummary = `テスト数: ${results.numTotalTests}  |  ` +
      `${green}成功: ${results.numPassedTests}${reset}  |  ` +
      `${results.numFailedTests > 0 ? red : ''}失敗: ${results.numFailedTests}${reset}  |  ` +
      `${results.numPendingTests > 0 ? yellow : ''}スキップ: ${results.numPendingTests}${reset}`;
    
    this.originalConsole.log(testResultSummary);
    
    // カバレッジ情報（簡潔に表示）
    if (this.results.coverageMap) {
      try {
        const total = this.results.coverageMap.getCoverageSummary().toJSON();
        const targetLevel = process.env.COVERAGE_TARGET || 'initial';
        const targetThresholds = this.getCoverageThresholds(targetLevel);
        
        // カバレッジ結果を簡潔に表示
        const statementsStatus = total.statements.pct >= targetThresholds.statements;
        const branchesStatus = total.branches.pct >= targetThresholds.branches;
        const functionsStatus = total.functions.pct >= targetThresholds.functions;
        const linesStatus = total.lines.pct >= targetThresholds.lines;
        
        const coverageSummary = 
          `カバレッジ目標 (${this.getTargetLevelName(targetLevel)}): ` +
          `ステートメント: ${statementsStatus ? green + '✓' : red + '✗'} ${total.statements.pct.toFixed(1)}%${reset} | ` +
          `ブランチ: ${branchesStatus ? green + '✓' : red + '✗'} ${total.branches.pct.toFixed(1)}%${reset} | ` +
          `関数: ${functionsStatus ? green + '✓' : red + '✗'} ${total.functions.pct.toFixed(1)}%${reset} | ` +
          `行: ${linesStatus ? green + '✓' : red + '✗'} ${total.lines.pct.toFixed(1)}%${reset}`;
        
        this.originalConsole.log(coverageSummary);
        
        // 目標達成状況
        const allTargetsMet = statementsStatus && branchesStatus && functionsStatus && linesStatus;
        
        if (allTargetsMet) {
          this.originalConsole.log(`${green}✓ すべてのカバレッジ目標を達成しています！${reset}`);
        } else if (!this.quietMode) {
          this.originalConsole.log(`${yellow}⚠ いくつかのカバレッジ目標が未達成です${reset}`);
        }
      } catch (error) {
        logToFile(`Error displaying coverage summary: ${error.message}`);
        if (!this.quietMode) {
          this.originalConsole.log(`${red}カバレッジ情報の取得に失敗しました${reset}`);
        }
      }
    } else if (!this.quietMode) {
      this.originalConsole.log(`${yellow}⚠ カバレッジデータが利用できません${reset}`);
    }
    
    // 最終結果（成功/失敗）
    if (results.numFailedTests > 0) {
      this.originalConsole.log(`${red}${bold}⚠ テスト失敗があります${reset}`);
      
      // 最小限モードでは失敗件数だけを表示
      if (!this.quietMode) {
        // 簡潔な失敗情報（最大3件まで）
        const failedTests = this.results.testResults.flatMap(fileResult =>
          fileResult.testResults
            .filter(test => test.status === 'failed')
            .map(test => ({
              file: path.relative(process.cwd(), fileResult.testFilePath),
              title: test.title
            }))
        ).slice(0, 3);
        
        if (failedTests.length > 0) {
          this.originalConsole.log(`${red}失敗したテスト（最大3件）:${reset}`);
          failedTests.forEach((test, i) => {
            this.originalConsole.log(`${i+1}. ${test.file}: ${test.title}`);
          });
          
          if (this.results.numFailedTests > 3) {
            this.originalConsole.log(`${yellow}... 他 ${this.results.numFailedTests - 3} 件${reset}`);
          }
        }
      }
    } else {
      this.originalConsole.log(`${green}${bold}✓ すべてのテストが成功しました！${reset}`);
    }
    
    // レポートファイルの場所（簡潔に表示）
    this.originalConsole.log(`${blue}詳細レポート:${reset} ./test-results/visual-report.html`);
    this.originalConsole.log(`${blue}レポートログ:${reset} ./test-results/test-log.md`);
    this.originalConsole.log(`${blue}詳細なログ:${reset} ${LOG_FILE}`);
  }
  
  /**
   * 最小限のサマリーを表示（完全静音モード用）
   * @param {Object} results テスト結果
   */
  printMinimalSummary(results) {
    // テキスト装飾
    const green = this.colors.green;
    const red = this.colors.red;
    const bold = this.colors.bold;
    const reset = this.colors.reset;
    
    // 最小限の結果表示
    if (results.numFailedTests > 0) {
      this.originalConsole.log(`${red}${bold}テスト結果: ${results.numFailedTests}件失敗 / ${results.numTotalTests}件中${reset}`);
    } else {
      this.originalConsole.log(`${green}${bold}テスト結果: 全${results.numTotalTests}件成功${reset}`);
    }
    
    // レポートファイルの場所
    this.originalConsole.log(`詳細: ./test-results/visual-report.html`);
  }
}

module.exports = CustomReporter;
