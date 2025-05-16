/**
 * ファイルパス: scripts/parse-test-results.js
 * 
 * テスト結果をJSON形式から正確に抽出するためのヘルパースクリプト
 * run-tests.shから呼び出して使用
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-25
 */

const fs = require('fs');
const path = require('path');

try {
  const resultsPath = path.resolve('./test-results/detailed-results.json');
  
  if (!fs.existsSync(resultsPath)) {
    console.log('TOTAL_TESTS=0');
    console.log('PASSED_TESTS=0');
    console.log('FAILED_TESTS=0');
    console.log('PENDING_TESTS=0');
    console.log('STATEMENTS_COVERAGE=0');
    console.log('BRANCHES_COVERAGE=0');
    console.log('FUNCTIONS_COVERAGE=0');
    console.log('LINES_COVERAGE=0');
    process.exit(0);
  }
  
  const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  
  // テスト結果を出力
  console.log(`TOTAL_TESTS=${data.numTotalTests || 0}`);
  console.log(`PASSED_TESTS=${data.numPassedTests || 0}`);
  console.log(`FAILED_TESTS=${data.numFailedTests || 0}`);
  console.log(`PENDING_TESTS=${data.numPendingTests || 0}`);
  
  // カバレッジ情報があれば出力
  if (data.coverageMap && data.coverageMap.total) {
    console.log(`STATEMENTS_COVERAGE=${data.coverageMap.total.statements.pct || 0}`);
    console.log(`BRANCHES_COVERAGE=${data.coverageMap.total.branches.pct || 0}`);
    console.log(`FUNCTIONS_COVERAGE=${data.coverageMap.total.functions.pct || 0}`);
    console.log(`LINES_COVERAGE=${data.coverageMap.total.lines.pct || 0}`);
  } else {
    console.log('STATEMENTS_COVERAGE=0');
    console.log('BRANCHES_COVERAGE=0');
    console.log('FUNCTIONS_COVERAGE=0');
    console.log('LINES_COVERAGE=0');
  }
} catch (error) {
  console.error(`エラー: ${error.message}`);
  // エラー時はデフォルト値を出力
  console.log('TOTAL_TESTS=0');
  console.log('PASSED_TESTS=0');
  console.log('FAILED_TESTS=0');
  console.log('PENDING_TESTS=0');
  console.log('STATEMENTS_COVERAGE=0');
  console.log('BRANCHES_COVERAGE=0');
  console.log('FUNCTIONS_COVERAGE=0');
  console.log('LINES_COVERAGE=0');
  process.exit(1);
}
