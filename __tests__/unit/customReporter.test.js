const CustomReporter = require('../../custom-reporter');

describe('CustomReporter utility methods', () => {
  test('getCoverageThresholds returns expected values', () => {
    const reporter = new CustomReporter({}, {});
    expect(reporter.getCoverageThresholds('mid')).toEqual({
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60
    });
    // unknown level falls back to initial
    expect(reporter.getCoverageThresholds('unknown')).toEqual({
      statements: 30,
      branches: 20,
      functions: 25,
      lines: 30
    });
  });

  test('getTargetLevelName returns human friendly name', () => {
    const reporter = new CustomReporter({}, {});
    expect(reporter.getTargetLevelName('mid')).toBe('中間段階 (40-60%)');
    expect(reporter.getTargetLevelName('other')).toBe('初期段階 (20-30%)');
  });

  test('status helpers return correct indicators', () => {
    const reporter = new CustomReporter({}, {});
    expect(reporter.getStatusSymbol(80, 70)).toBe('✅ 達成');
    expect(reporter.getStatusSymbol(50, 70)).toBe('❌ 未達成');
    expect(reporter.getStatusEmoji(80, 70)).toBe('✅');
    expect(reporter.getStatusEmoji(50, 60)).toBe('❌');
  });

  test('createDemoCoverageMap builds coverageMap based on target', () => {
    process.env.COVERAGE_TARGET = 'final';
    const reporter = new CustomReporter({}, {});
    reporter.createDemoCoverageMap();
    const summary = reporter.results.coverageMap.getCoverageSummary().toJSON();
    expect(summary.statements.pct).toBe(64); // 80 * 0.8
    expect(summary.branches.pct).toBe(56);   // 70 * 0.8
    expect(summary.functions.pct).toBe(64);  // 80 * 0.8
    expect(summary.lines.pct).toBe(64);      // 80 * 0.8
    delete process.env.COVERAGE_TARGET;
  });
});
