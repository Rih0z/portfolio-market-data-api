const fs = require('fs');
const path = require('path');

jest.mock('fs');

const chart = require('../../../scripts/generate-coverage-chart');

describe('generate-coverage-chart script utilities', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('roundToTwo rounds numbers correctly', () => {
    expect(chart.roundToTwo(1.234)).toBe(1.23);
    expect(chart.roundToTwo(1.235)).toBe(1.24);
  });

  test('getCoverageTarget uses environment variable', () => {
    process.env.COVERAGE_TARGET = 'mid';
    expect(chart.getCoverageTarget()).toBe('mid');
    process.env.COVERAGE_TARGET = 'unknown';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(chart.getCoverageTarget()).toBe('initial');
    expect(warnSpy).toHaveBeenCalled();
    delete process.env.COVERAGE_TARGET;
    warnSpy.mockRestore();
  });

  test('loadCoverageData returns null when file missing', () => {
    fs.existsSync.mockReturnValue(false);
    expect(chart.loadCoverageData()).toBeNull();
  });

  test('generateBarChart returns svg string', () => {
    const coverageData = {
      statements: { pct: 90, covered: 90, total: 100 },
      branches: { pct: 80, covered: 40, total: 50 },
      functions: { pct: 70, covered: 7, total: 10 },
      lines: { pct: 85, covered: 85, total: 100 }
    };
    jest.useFakeTimers().setSystemTime(new Date('2025-05-18'));
    const svg = chart.generateBarChart(coverageData, 'final');
    expect(svg).toContain('<svg');
    expect(svg).toContain('テストカバレッジ');
    jest.useRealTimers();
  });
});
