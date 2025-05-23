const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const scriptPath = path.resolve(__dirname, '../../../scripts/run-tests.sh');
const fakeBinDir = path.resolve(__dirname, 'fakebin');

function runScript(args = [], env = {}) {
  return spawnSync('bash', [scriptPath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${fakeBinDir}:${process.env.PATH}`, ...env }
  });
}

describe('run-tests.sh --ignore-coverage-errors', () => {
  const resultsDir = path.resolve(__dirname, '../../../test-results');
  const resultsFile = path.join(resultsDir, 'detailed-results.json');

  beforeAll(() => {
    if (!fs.existsSync(fakeBinDir)) {
      fs.mkdirSync(fakeBinDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(resultsDir)) fs.rmSync(resultsDir, { recursive: true, force: true });
  });

  test('ignores coverage failures when option is provided', () => {
    fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(resultsFile, JSON.stringify({ numFailedTests: 0 }));

    const result = runScript(['--ignore-coverage-errors', 'all'], { DEBUG: 'true' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('カバレッジエラーを無視するモードが有効です');
    expect(result.stdout).toContain('テスト自体は成功していますが');
    expect(result.stdout).toContain('テスト成功として扱います');
  });
});
