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

describe('run-tests.sh cross-env fallback', () => {
  const resultsDir = path.resolve(__dirname, '../../../test-results');

  beforeAll(() => {
    if (!fs.existsSync(fakeBinDir)) {
      fs.mkdirSync(fakeBinDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(resultsDir)) fs.rmdirSync(resultsDir, { recursive: true });
  });

  test('falls back to env when cross-env is missing', () => {
    const result = runScript(['all']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('cross-env が見つかりません');
  });
});
