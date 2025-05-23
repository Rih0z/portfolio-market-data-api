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

describe('run-tests.sh additional flags', () => {
  beforeAll(() => {
    if (!fs.existsSync(fakeBinDir)) {
      fs.mkdirSync(fakeBinDir, { recursive: true });
    }
  });

  test('auto start flag enables server mode', () => {
    const result = runScript(['-a', 'all']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('APIサーバー自動起動モードが有効です');
  });

  test('mock flag enables mock mode', () => {
    const result = runScript(['-m', 'all']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('APIモック使用モードが有効です');
  });

  test('force flag enables forced execution', () => {
    const result = runScript(['-f', 'all']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('テスト強制実行モードが有効です');
  });

  test('watch flag adds watch option', () => {
    const result = runScript(['-w', 'all']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('監視モードが有効です');
  });
});
