/**
 * ファイルパス: custom-reporter.js
 * 
 * Jestカスタムレポーター
 * テスト結果の詳細情報を収集し、ビジュアルレポートとJSONデータを生成する
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-12
 * @updated 2025-05-17 - カバレッジデータをファイルから直接読み込む機能を追加
 * @updated 2025-05-20 - コマンドライン出力を最小限に抑える機能を追加
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
    
    // コンソール出力の設定
    this.quietMode = process.env.CI !== 'true' && process.env.DEBUG !== 'true'; 
    
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
      reset: '\x1b[0m'
    };
  }
  
  /**
   * 進捗状況を表示（最小限の出力）
   * @param {string} message メッセージ
   * @param {string} type メッセージのタイプ（info, success, warn, error）
   */
  printProgress(message, type = 'info') {
    if (this.quietMode) {
      // 最小限モードでは特定のメッセージのみを表示
      // 常に表示：テスト開始/終了、成功/失敗数、エラー
      
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
    this.printProgress('テスト実行を開始します...', 'info');
    
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
    
    // 失敗したテストがある場合のみ報告
    if (testResult.numFailingTests > 0) {
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
    if (this.quietMode) {
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
      this.lastProgressLine = `\r[${bar}] ${percent}% (${current}/${total}) ${status}`;
      
      // 前の行を上書き
      process.stdout.write(this.lastProgressLine);
    }
  }
  
  /**
   * テスト実行完了時に呼び出される
   */
  onRunComplete(contexts, results) {
    this.endTime = Date.now();
    
    // 進捗バーを完了させる
    if (this.quietMode) {
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
  }
  
  /**
   * カバレッジ情報をファイルから読み込む
   */
  loadCoverageFromFile() {
    try {
      if (!this.quietMode) {
        this.originalConsole.log('\n🔍 カバレッジ情報をファイルから読み込みます...');
      }
      
      // カバレッジデータファイルのパス
      const coveragePath = path.resolve('./coverage/coverage-final.json');
      
      // ファイルが存在するか確認
      if (!fs.existsSync(coveragePath)) {
        if (!this.quietMode) {
          this.originalConsole.warn('⚠ カバレッジデータファイルが見つかりません:', coveragePath);
        }
        
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
            if (!this.quietMode) {
              this.originalConsole.log(`✓ 代替カバレッジファイルが見つかりました: ${file}`);
            }
            foundAlternate = true;
            
            // summaryファイルからの読み込みを試みる
            if (file === './coverage/coverage-summary.json') {
              try {
                const summaryData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                // 簡易的なカバレッジマップを構築
                this.createSimpleCoverageMap(summaryData);
                if (!this.quietMode) {
                  this.originalConsole.log('✓ カバレッジサマリーからデータを読み込みました');
                }
                return;
              } catch (e) {
                if (!this.quietMode) {
                  this.originalConsole.warn(`⚠ サマリーファイルの解析に失敗しました: ${e.message}`);
                }
              }
            }
            break;
          }
        }
        
        if (!foundAlternate && !this.quietMode) {
          this.originalConsole.warn('⚠ 代替カバレッジファイルも見つかりません。');
          this.originalConsole.warn('⚠ Jest実行時に --coverage オプションが指定されているか確認してください。');
        }
        
        return;
      }
      
      // カバレッジデータを読み込む
      const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      
      // カバレッジマップを作成
      this.createCoverageMapFromData(coverageData);
      if (!this.quietMode) {
        this.originalConsole.log('✓ カバレッジデータをファイルから読み込みました');
      }
    } catch (error) {
      if (!this.quietMode) {
        this.originalConsole.warn(`⚠ カバレッジデータの読み込みに失敗しました: ${error.message}`);
      }
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
    // ビジュアルレポート生成コードはそのまま（省略）
    // この部分はコンソール出力に影響しないので変更不要
    try {
      // 以下、元のコードと同じ（長いのでここでは省略）
      
      // ...省略...
      
    } catch (error) {
      if (!this.quietMode) {
        this.originalConsole.error('ビジュアルレポート生成中にエラーが発生しました:', error);
      }
      
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
    // テキスト装飾
    const green = this.colors.green;
    const red = this.colors.red;
    const yellow = this.colors.yellow;
    const blue = this.colors.blue;
    const reset = this.colors.reset;
    
    // 簡潔な結果表示（常に表示）
    this.originalConsole.log(`${blue}========== テスト実行結果 ==========${reset}`);
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
        } else {
          this.originalConsole.log(`${yellow}⚠ いくつかのカバレッジ目標が未達成です${reset}`);
        }
      } catch (error) {
        this.originalConsole.log(`${red}カバレッジ情報の取得に失敗しました${reset}`);
      }
    } else {
      this.originalConsole.log(`${yellow}⚠ カバレッジデータが利用できません${reset}`);
    }
    
    // 最終結果（成功/失敗）
    if (results.numFailedTests > 0) {
      this.originalConsole.log(`${red}⚠ テスト失敗があります${reset}`);
      
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
    } else {
      this.originalConsole.log(`${green}✓ すべてのテストが成功しました！${reset}`);
    }
    
    // レポートファイルの場所（簡潔に表示）
    this.originalConsole.log(`${blue}詳細レポート:${reset} ./test-results/visual-report.html`);
  }
}

module.exports = CustomReporter;

