/**
 * ファイルパス: custom-reporter.js
 * 
 * Jestカスタムレポーター
 * テスト結果の詳細情報を収集し、ビジュアルレポートとJSONデータを生成する
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-12
 * @updated 2025-05-16 - チャート生成サポートとカバレッジ目標ステータス表示を追加
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
  }
  
  /**
   * テスト実行開始時に呼び出される
   */
  onRunStart(results, options) {
    this.startTime = Date.now();
    console.log('\n🚀 テスト実行を開始します...');
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
  }
  
  /**
   * テスト実行完了時に呼び出される
   */
  onRunComplete(contexts, results) {
    this.endTime = Date.now();
    
    // 結果の集計
    this.results.numTotalTests = results.numTotalTests;
    this.results.numFailedTests = results.numFailedTests;
    this.results.numPassedTests = results.numPassedTests;
    this.results.numPendingTests = results.numPendingTests;
    
    // カバレッジ情報を含める
    if (results.coverageMap) {
      this.results.coverageMap = results.coverageMap;
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
    // レポートのスタイルとスクリプト
    const styles = `
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
        background-color: #f9f9f9;
      }
      h1, h2, h3 {
        color: #333;
      }
      .header {
        background-color: #4285F4;
        color: white;
        padding: 20px;
        border-radius: 5px;
        margin-bottom: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .header h1 {
        color: white;
        margin: 0;
      }
      .datetime {
        font-size: 0.9em;
        color: rgba(255, 255, 255, 0.8);
      }
      .summary-cards {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        margin-bottom: 30px;
      }
      .card {
        flex: 1;
        min-width: 200px;
        padding: 20px;
        border-radius: 5px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        text-align: center;
        background-color: white;
      }
      .card h3 {
        margin-top: 0;
        color: #666;
        font-weight: normal;
      }
      .card .number {
        font-size: 2.5em;
        font-weight: bold;
      }
      .success { color: #34A853; }
      .failure { color: #EA4335; }
      .pending { color: #FBBC05; }
      .total { color: #4285F4; }
      
      .coverage-summary {
        margin-bottom: 30px;
      }
      .progress-container {
        margin-bottom: 10px;
      }
      .progress-label {
        display: flex;
        justify-content: space-between;
        margin-bottom: 5px;
      }
      .progress-bar {
        height: 20px;
        border-radius: 10px;
        background-color: #f0f0f0;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        border-radius: 10px;
        transition: width 0.5s ease;
      }
      .target-marker {
        position: relative;
        top: -20px;
        width: 2px;
        height: 20px;
        background-color: #333;
      }
      .target-label {
        position: relative;
        top: -20px;
        font-size: 0.8em;
        color: #333;
      }
      
      .statements-fill { background-color: #4285F4; }
      .branches-fill { background-color: #34A853; }
      .functions-fill { background-color: #FBBC05; }
      .lines-fill { background-color: #EA4335; }
      
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 30px;
        background-color: white;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 8px 12px;
        text-align: left;
      }
      th {
        background-color: #f2f2f2;
        font-weight: bold;
      }
      tr:nth-child(even) {
        background-color: #f9f9f9;
      }
      .numeric {
        text-align: right;
      }
      
      .error-panel {
        background-color: #fff;
        border-left: 5px solid #EA4335;
        padding: 15px;
        margin-bottom: 20px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      }
      .error-title {
        font-size: 1.1em;
        font-weight: bold;
        margin-bottom: 10px;
      }
      .error-location {
        font-family: monospace;
        color: #666;
        margin-bottom: 10px;
      }
      .error-message {
        font-family: monospace;
        white-space: pre-wrap;
        background-color: #f5f5f5;
        padding: 10px;
        border-radius: 3px;
        overflow-x: auto;
      }
      
      .footer {
        margin-top: 50px;
        text-align: center;
        color: #666;
        font-size: 0.9em;
      }
      
      @media (max-width: 768px) {
        .summary-cards {
          flex-direction: column;
        }
      }
      
      .status-passed { color: #34A853; }
      .status-failed { color: #EA4335; }
      .status-pending { color: #FBBC05; }
    `;
    
    // レポートの基本構造
    let html = `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Portfolio Market Data API テスト結果</title>
      <style>${styles}</style>
    </head>
    <body>
      <div class="header">
        <h1>テスト結果レポート</h1>
        <div class="datetime">${new Date().toLocaleString('ja-JP')}</div>
      </div>
      
      <div class="summary-cards">
        <div class="card">
          <h3>合計テスト</h3>
          <div class="number total">${this.results.numTotalTests}</div>
        </div>
        <div class="card">
          <h3>成功</h3>
          <div class="number success">${this.results.numPassedTests}</div>
        </div>
        <div class="card">
          <h3>失敗</h3>
          <div class="number failure">${this.results.numFailedTests}</div>
        </div>
        <div class="card">
          <h3>スキップ</h3>
          <div class="number pending">${this.results.numPendingTests}</div>
        </div>
        <div class="card">
          <h3>実行時間</h3>
          <div class="number">${((this.endTime - this.startTime) / 1000).toFixed(2)}秒</div>
        </div>
      </div>
    `;
    
    // カバレッジ情報を追加
    if (this.results.coverageMap) {
      try {
        const total = this.results.coverageMap.getCoverageSummary().toJSON();
        const targetLevel = process.env.COVERAGE_TARGET || 'initial';
        const targetThresholds = this.getCoverageThresholds(targetLevel);
        
        html += `
        <h2>カバレッジサマリー</h2>
        <p>目標段階: <strong>${this.getTargetLevelName(targetLevel)}</strong></p>
        
        <div class="coverage-summary">
          <div class="progress-container">
            <div class="progress-label">
              <span>ステートメント (${total.statements.covered}/${total.statements.total})</span>
              <span>${total.statements.pct.toFixed(2)}% ${this.getStatusEmoji(total.statements.pct, targetThresholds.statements)}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill statements-fill" style="width: ${total.statements.pct}%"></div>
            </div>
            <div class="target-marker" style="margin-left: ${targetThresholds.statements}%"></div>
            <div class="target-label" style="margin-left: ${targetThresholds.statements - 3}%">目標: ${targetThresholds.statements}%</div>
          </div>
          
          <div class="progress-container">
            <div class="progress-label">
              <span>ブランチ (${total.branches.covered}/${total.branches.total})</span>
              <span>${total.branches.pct.toFixed(2)}% ${this.getStatusEmoji(total.branches.pct, targetThresholds.branches)}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill branches-fill" style="width: ${total.branches.pct}%"></div>
            </div>
            <div class="target-marker" style="margin-left: ${targetThresholds.branches}%"></div>
            <div class="target-label" style="margin-left: ${targetThresholds.branches - 3}%">目標: ${targetThresholds.branches}%</div>
          </div>
          
          <div class="progress-container">
            <div class="progress-label">
              <span>関数 (${total.functions.covered}/${total.functions.total})</span>
              <span>${total.functions.pct.toFixed(2)}% ${this.getStatusEmoji(total.functions.pct, targetThresholds.functions)}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill functions-fill" style="width: ${total.functions.pct}%"></div>
            </div>
            <div class="target-marker" style="margin-left: ${targetThresholds.functions}%"></div>
            <div class="target-label" style="margin-left: ${targetThresholds.functions - 3}%">目標: ${targetThresholds.functions}%</div>
          </div>
          
          <div class="progress-container">
            <div class="progress-label">
              <span>行 (${total.lines.covered}/${total.lines.total})</span>
              <span>${total.lines.pct.toFixed(2)}% ${this.getStatusEmoji(total.lines.pct, targetThresholds.lines)}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill lines-fill" style="width: ${total.lines.pct}%"></div>
            </div>
            <div class="target-marker" style="margin-left: ${targetThresholds.lines}%"></div>
            <div class="target-label" style="margin-left: ${targetThresholds.lines - 3}%">目標: ${targetThresholds.lines}%</div>
          </div>
        </div>
        
        <h2>ファイルごとのカバレッジ</h2>
        <table>
          <thead>
            <tr>
              <th>ファイル</th>
              <th class="numeric">ステートメント</th>
              <th class="numeric">ブランチ</th>
              <th class="numeric">関数</th>
              <th class="numeric">行</th>
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
              <td>${filename}</td>
              <td class="numeric">${file.statements.pct.toFixed(2)}%</td>
              <td class="numeric">${file.branches.pct.toFixed(2)}%</td>
              <td class="numeric">${file.functions.pct.toFixed(2)}%</td>
              <td class="numeric">${file.lines.pct.toFixed(2)}%</td>
            </tr>
          `;
        });
        
        html += `
          </tbody>
        </table>
        `;
      } catch (error) {
        html += `<p>カバレッジ情報の取得に失敗しました: ${error.message}</p>`;
      }
    }
    
    // テスト結果の詳細を追加
    html += `<h2>テスト結果詳細</h2>`;
    
    this.results.testResults.forEach(fileResult => {
      const relativePath = path.relative(process.cwd(), fileResult.testFilePath);
      
      html += `
        <h3>${relativePath}</h3>
        <table>
          <thead>
            <tr>
              <th>テスト</th>
              <th>ステータス</th>
              <th class="numeric">時間</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      fileResult.testResults.forEach(test => {
        const statusClass = 
          test.status === 'passed' ? 'status-passed' :
          test.status === 'failed' ? 'status-failed' :
          'status-pending';
        
        const statusText = 
          test.status === 'passed' ? '✓ 成功' :
          test.status === 'failed' ? '✗ 失敗' :
          '◯ スキップ';
        
        html += `
          <tr>
            <td>${test.title}</td>
            <td class="${statusClass}">${statusText}</td>
            <td class="numeric">${(test.duration / 1000).toFixed(3)}秒</td>
          </tr>
        `;
      });
      
      html += `
          </tbody>
        </table>
      `;
    });
    
    // エラーがある場合はエラー詳細を追加
    if (this.results.numFailedTests > 0) {
      html += `<h2>エラー詳細</h2>`;
      
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
          <div class="error-panel">
            <div class="error-title">${index + 1}. ${test.title}</div>
            <div class="error-location">ファイル: ${relativePath}</div>
            <div class="error-message">${test.failureMessages.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          </div>
        `;
      });
    }
    
    // フッターを追加
    html += `
      <div class="footer">
        <p>Portfolio Market Data API テスト実行レポート - ${new Date().toISOString()}</p>
      </div>
    `;
    
    // チャートのプレースホルダーを追加（スクリプトで動的に生成される）
    html += `<div class="coverage-charts"></div><!-- プレースホルダー -->`;
    
    // HTMLを閉じる
    html += `
    </body>
    </html>
    `;
    
    // HTMLファイルに書き込み
    fs.writeFileSync(path.join(outputDir, 'visual-report.html'), html);
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
    const green = '\x1b[32m';
    const red = '\x1b[31m';
    const yellow = '\x1b[33m';
    const blue = '\x1b[34m';
    const reset = '\x1b[0m';
    
    console.log('\n========================================');
    console.log(`${blue}テスト実行結果${reset}`);
    console.log('========================================');
    
    // 基本情報
    console.log(`実行時間: ${((this.endTime - this.startTime) / 1000).toFixed(2)}秒`);
    console.log(`テスト数: ${results.numTotalTests}`);
    console.log(`成功: ${green}${results.numPassedTests}${reset}`);
    
    if (results.numFailedTests > 0) {
      console.log(`失敗: ${red}${results.numFailedTests}${reset}`);
    } else {
      console.log(`失敗: ${results.numFailedTests}`);
    }
    
    if (results.numPendingTests > 0) {
      console.log(`スキップ: ${yellow}${results.numPendingTests}${reset}`);
    } else {
      console.log(`スキップ: ${results.numPendingTests}`);
    }
    
    console.log('----------------------------------------');
    
    // カバレッジ情報
    if (results.coverageMap) {
      try {
        const total = results.coverageMap.getCoverageSummary().toJSON();
        
        console.log(`${blue}カバレッジ情報:${reset}`);
        console.log(`ステートメント: ${total.statements.pct.toFixed(2)}% (${total.statements.covered}/${total.statements.total})`);
        console.log(`ブランチ: ${total.branches.pct.toFixed(2)}% (${total.branches.covered}/${total.branches.total})`);
        console.log(`関数: ${total.functions.pct.toFixed(2)}% (${total.functions.covered}/${total.functions.total})`);
        console.log(`行: ${total.lines.pct.toFixed(2)}% (${total.lines.covered}/${total.lines.total})`);
        
        // 目標ステータス
        const targetLevel = process.env.COVERAGE_TARGET || 'initial';
        const targetThresholds = this.getCoverageThresholds(targetLevel);
        console.log(`\n${blue}カバレッジ目標 (${this.getTargetLevelName(targetLevel)}):${reset}`);
        
        const statementsStatus = total.statements.pct >= targetThresholds.statements;
        const branchesStatus = total.branches.pct >= targetThresholds.branches;
        const functionsStatus = total.functions.pct >= targetThresholds.functions;
        const linesStatus = total.lines.pct >= targetThresholds.lines;
        
        console.log(`ステートメント: ${statementsStatus ? green + '✓' : red + '✗'} ${total.statements.pct.toFixed(2)}% / 目標 ${targetThresholds.statements}%${reset}`);
        console.log(`ブランチ: ${branchesStatus ? green + '✓' : red + '✗'} ${total.branches.pct.toFixed(2)}% / 目標 ${targetThresholds.branches}%${reset}`);
        console.log(`関数: ${functionsStatus ? green + '✓' : red + '✗'} ${total.functions.pct.toFixed(2)}% / 目標 ${targetThresholds.functions}%${reset}`);
        console.log(`行: ${linesStatus ? green + '✓' : red + '✗'} ${total.lines.pct.toFixed(2)}% / 目標 ${targetThresholds.lines}%${reset}`);
        
        // 目標達成状況
        const allTargetsMet = statementsStatus && branchesStatus && functionsStatus && linesStatus;
        
        if (allTargetsMet) {
          console.log(`\n${green}✓ 現在の目標段階(${targetLevel})のすべての目標を達成しています！${reset}`);
          
          // 次の目標を提案
          if (targetLevel === 'initial') {
            console.log(`${blue}次のステップ: ${yellow}-t mid${reset} オプションで中間段階の目標に挑戦しましょう`);
          } else if (targetLevel === 'mid') {
            console.log(`${blue}次のステップ: ${yellow}-t final${reset} オプションで最終段階の目標に挑戦しましょう`);
          } else if (targetLevel === 'final') {
            console.log(`${green}おめでとうございます！最終段階の目標を達成しました！${reset}`);
          }
        } else {
          console.log(`\n${yellow}⚠ 現在の目標段階(${targetLevel})のいくつかの目標がまだ達成されていません${reset}`);
        }
      } catch (error) {
        console.log(`${red}カバレッジ情報の取得に失敗しました: ${error.message}${reset}`);
      }
    }
    
    console.log('========================================');
    
    // レポートファイルの場所
    console.log(`詳細結果は以下のファイルで確認できます:`);
    console.log(`- ビジュアルレポート: ${blue}./test-results/visual-report.html${reset}`);
    console.log(`- マークダウンログ: ${blue}./test-results/test-log.md${reset}`);
    console.log(`- JSONデータ: ${blue}./test-results/detailed-results.json${reset}`);
    
    if (results.numFailedTests > 0) {
      console.log(`\n${red}⚠ テスト失敗があります。上記のレポートファイルで詳細を確認してください。${reset}`);
    } else {
      console.log(`\n${green}✓ すべてのテストが成功しました！${reset}`);
    }
  }
}

module.exports = CustomReporter;

