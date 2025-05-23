const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const scriptPath = path.resolve(__dirname, '../../../scripts/run-tests.sh');
const fakeBinDir = path.resolve(__dirname, 'fakebin');

function runScript(args = [], env = {}) {
  return spawnSync('bash', [scriptPath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${fakeBinDir}:${process.env.PATH}`, ...env }
  });
}

describe('run-tests.sh quick and specific modes', () => {
  beforeAll(() => {
    if (!fs.existsSync(fakeBinDir)) {
      fs.mkdirSync(fakeBinDir, { recursive: true });
    }
  });

  test('quick mode enables mocks and runs unit+integration', () => {
    const result = runScript(['quick'], { DEBUG: 'true' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('クイックテスト（単体+統合）を実行中');
    expect(result.stdout).toContain('APIモック使用モードが有効です');
  });

  test('specific mode runs with pattern', () => {
    const result = runScript(['-s', 'utils', 'specific']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('特定のパターンに一致するテストを実行中');
    expect(result.stdout).toContain('パターン: utils');
  });
});
