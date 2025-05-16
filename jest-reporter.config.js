/**
 * ファイルパス: jest-reporter.config.js
 * 
 * Jest レポーター設定ファイル
 * テスト実行結果のレポート形式やオプションを定義
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-21
 */

module.exports = {
  // 基本設定
  baseOptions: {
    // ログの出力先
    logDirectory: './test-results/logs',
    
    // HTMLレポートの設定
    htmlReport: {
      outputPath: './test-results/visual-report.html',
      pageTitle: 'Portfolio Market Data API テスト結果',
      includeFailureMessages: true,
      dateFormat: 'yyyy/MM/dd HH:mm:ss',
      includeConsoleLog: true,
      includeCoverage: true,
    },
    
    // JUnitレポートの設定
    junitReport: {
      outputDirectory: './test-results/junit',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
    },
    
    // マークダウンレポートの設定
    markdownReport: {
      outputPath: './test-results/test-log.md',
      includeFailureMessages: true,
      includeConsoleLog: true,
      includeStackTrace: true,
    },
    
    // JSONレポートの設定
    jsonReport: {
      outputPath: './test-results/detailed-results.json',
      indent: 2,
    },
    
    // 出力制御
    quietMode: process.env.QUIET_MODE === 'true',
    verboseMode: process.env.VERBOSE_MODE === 'true',
    debugMode: process.env.DEBUG === 'true',
    
    // カバレッジレポートの設定
    coverageReport: {
      // カバレッジ目標値
      thresholds: {
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
      },
      
      // カバレッジレベル名
      targetLevelNames: {
        initial: '初期段階 (20-30%)',
        mid: '中間段階 (40-60%)',
        final: '最終段階 (70-80%)'
      },
      
      // カバレッジチャート設定
      chart: {
        enabled: process.env.GENERATE_COVERAGE_CHART === 'true',
        outputDirectory: './test-results',
        colors: {
          statements: '#4285F4', // Google Blue
          branches: '#34A853',   // Google Green
          functions: '#FBBC05',  // Google Yellow
          lines: '#EA4335',      // Google Red
          background: '#F8F9FA', // Light gray
          text: '#202124',       // Dark gray
          grid: '#DADCE0',       // Light gray for grid
        }
      }
    }
  },
  
  // テスト環境ごとの設定
  // CIサーバーではquietモードを無効化し、JUnitレポートを優先
  getEnvironmentConfig() {
    if (process.env.CI === 'true') {
      return {
        quietMode: false,
        verboseMode: true,
        junitReport: {
          enabled: true,
          priority: 'high'
        },
        jsonReport: {
          enabled: true,
          priority: 'high'
        },
        htmlReport: {
          enabled: true,
          priority: 'medium'
        }
      };
    }
    
    // 開発環境ではHTMLレポートを優先
    return {
      htmlReport: {
        enabled: true,
        priority: 'high'
      },
      markdownReport: {
        enabled: true,
        priority: 'medium'
      },
      jsonReport: {
        enabled: true,
        priority: 'low'
      },
      junitReport: {
        enabled: false
      }
    };
  },
  
  // 現在の設定を取得
  getConfig() {
    const baseOptions = this.baseOptions;
    const envConfig = this.getEnvironmentConfig();
    
    // 設定をマージ
    return {
      ...baseOptions,
      ...envConfig,
      coverageReport: {
        ...baseOptions.coverageReport,
        ...(envConfig.coverageReport || {})
      },
      htmlReport: {
        ...baseOptions.htmlReport,
        ...(envConfig.htmlReport || {})
      },
      junitReport: {
        ...baseOptions.junitReport,
        ...(envConfig.junitReport || {})
      },
      markdownReport: {
        ...baseOptions.markdownReport,
        ...(envConfig.markdownReport || {})
      },
      jsonReport: {
        ...baseOptions.jsonReport,
        ...(envConfig.jsonReport || {})
      }
    };
  }
};
