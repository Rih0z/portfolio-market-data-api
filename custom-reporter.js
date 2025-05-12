/**
 * カスタムJestレポーター
 * テスト結果をファイルに書き込みます
 */
const fs = require('fs');
const path = require('path');

class CustomReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
    this.results = [];
    this.errorLogs = [];
  }

  onRunStart() {
    this.results = [];
    this.errorLogs = [];
    this.startTime = new Date();
    
    // テスト結果ディレクトリが存在しない場合は作成
    if (!fs.existsSync('./test-results')) {
      fs.mkdirSync('./test-results', { recursive: true });
    }
  }

  onTestStart(test) {
    // テスト開始時の処理（必要に応じて）
  }

  onTestResult(test, testResult) {
    // 各テスト結果を収集
    const testInfo = {
      name: testResult.testResults[0]?.ancestorTitles.join(' > ') + ' > ' + testResult.testResults[0]?.title || testResult.testFilePath,
      path: testResult.testFilePath,
      status: testResult.numFailingTests > 0 ? 'failed' : 'passed',
      numPassingTests: testResult.numPassingTests,
      numFailingTests: testResult.numFailingTests,
      numPendingTests: testResult.numPendingTests,
      numTodoTests: testResult.numTodoTests,
      perfStats: testResult.perfStats,
    };

    // 失敗したテストのエラーメッセージを収集
    if (testResult.numFailingTests > 0) {
      testResult.testResults.forEach(result => {
        if (result.status === 'failed') {
          this.errorLogs.push({
            test: result.fullName,
            error: result.failureMessages
          });
        }
      });
    }

    this.results.push(testInfo);
  }

  onRunComplete(contexts, results) {
    const endTime = new Date();
    const duration = endTime - this.startTime;
    
    const summary = {
      numTotalTests: results.numTotalTests,
      numPassedTests: results.numPassedTests,
      numFailedTests: results.numFailedTests,
      numPendingTests: results.numPendingTests,
      startTime: this.startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: `${duration}ms`,
      success: results.success,
      testResults: this.results,
      errors: this.errorLogs
    };

    // 詳細なJSONレポートを作成
    fs.writeFileSync(
      path.resolve('./test-results/detailed-results.json'),
      JSON.stringify(summary, null, 2)
    );
    
    // テキスト形式の要約レポートを作成
    const textSummary = `
テスト実行結果要約
==================
テスト実行日時: ${this.startTime.toISOString()}
所要時間: ${duration}ms

テスト統計:
- 合計テスト数: ${results.numTotalTests}
- 成功: ${results.numPassedTests}
- 失敗: ${results.numFailedTests}
- 保留: ${results.numPendingTests}

失敗したテスト:
${this.errorLogs.map(err => `- ${err.test}`).join('\n')}

詳細なエラー:
${this.errorLogs.map(err => `
テスト: ${err.test}
エラー:
${err.error.join('\n')}
`).join('\n')}
    `;
    
    fs.writeFileSync(
      path.resolve('./test-results/test-summary.txt'),
      textSummary
    );

    // コンソールにも要約を出力
    console.log(`テスト実行完了:
- 合計テスト数: ${results.numTotalTests}
- 成功: ${results.numPassedTests}
- 失敗: ${results.numFailedTests}
- 保留: ${results.numPendingTests}
詳細なレポートは ./test-results/ ディレクトリに保存されました`);
  }
}

module.exports = CustomReporter;
