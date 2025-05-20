/**
 * ファイルパス: __tests__/unit/services/usage.test.js
 * 
 * usage.js (非推奨プロキシモジュール)のユニットテスト
 * すべての機能が fallbackDataStore.js に委譲され、
 * 非推奨警告が出ることを確認するテスト
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-21
 */

// テスト対象モジュールのインポート
const usageService = require('../../../src/services/usage');
const fallbackDataStore = require('../../../src/services/fallbackDataStore');

// 依存モジュールのインポート
const logger = require('../../../src/utils/logger');
const { ENV } = require('../../../src/config/envConfig');
const { DATA_TYPES } = require('../../../src/config/constants');

// モジュールのモック化
jest.mock('../../../src/services/fallbackDataStore');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/config/envConfig', () => ({
  ENV: {
    NODE_ENV: 'test'
  }
}));

describe('Usage Service (非推奨プロキシモジュール)', () => {
  // テスト用データ
  const TEST_SYMBOL = 'AAPL';
  const TEST_TYPE = DATA_TYPES.US_STOCK;
  const ERROR_INFO = new Error('API timeout');
  const TEST_DATA = { ticker: TEST_SYMBOL, price: 150 };
  const TEST_DATA_ITEMS = [TEST_DATA, { ticker: 'MSFT', price: 280 }];
  
  // 各テスト前の準備
  beforeEach(() => {
    // モックをリセット
    jest.resetAllMocks();
    
    // fallbackDataStore モックの設定
    fallbackDataStore.getFallbackForSymbol.mockResolvedValue(TEST_DATA);
    fallbackDataStore.recordFailedFetch.mockResolvedValue(true);
    fallbackDataStore.getDefaultFallbackData.mockReturnValue(TEST_DATA);
    fallbackDataStore.saveFallbackData.mockResolvedValue(true);
    fallbackDataStore.updateFallbackData.mockResolvedValue({
      success: true,
      updated: 2
    });
  });
  
  describe('getFallbackForSymbol', () => {
    test('非推奨警告を表示してfallbackDataStoreに委譲する', async () => {
      // 関数実行
      const result = await usageService.getFallbackForSymbol(TEST_SYMBOL, TEST_TYPE);
      
      // 検証
      expect(result).toEqual(TEST_DATA);
      expect(fallbackDataStore.getFallbackForSymbol).toHaveBeenCalledWith(TEST_SYMBOL, TEST_TYPE);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("DEPRECATED: 'usage.js の getFallbackForSymbol' は非推奨です"),
        expect.any(String)
      );
    });
  });
  
  describe('recordFailedFetch', () => {
    test('非推奨警告を表示してfallbackDataStoreに委譲する', async () => {
      // 関数実行
      const result = await usageService.recordFailedFetch(TEST_SYMBOL, TEST_TYPE, ERROR_INFO);
      
      // 検証
      expect(result).toBe(true);
      expect(fallbackDataStore.recordFailedFetch).toHaveBeenCalledWith(TEST_SYMBOL, TEST_TYPE, ERROR_INFO);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("DEPRECATED: 'usage.js の recordFailedFetch' は非推奨です"),
        expect.any(String)
      );
    });
  });
  
  describe('getDefaultFallbackData', () => {
    test('非推奨警告を表示してfallbackDataStoreに委譲する', () => {
      // 関数実行
      const result = usageService.getDefaultFallbackData(TEST_SYMBOL, TEST_TYPE);
      
      // 検証
      expect(result).toEqual(TEST_DATA);
      expect(fallbackDataStore.getDefaultFallbackData).toHaveBeenCalledWith(TEST_SYMBOL, TEST_TYPE);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("DEPRECATED: 'usage.js の getDefaultFallbackData' は非推奨です"),
        expect.any(String)
      );
    });
  });
  
  describe('saveFallbackData', () => {
    test('非推奨警告を表示してfallbackDataStoreに委譲する', async () => {
      // 関数実行
      const result = await usageService.saveFallbackData(TEST_SYMBOL, TEST_TYPE, TEST_DATA);
      
      // 検証
      expect(result).toBe(true);
      expect(fallbackDataStore.saveFallbackData).toHaveBeenCalledWith(TEST_SYMBOL, TEST_TYPE, TEST_DATA);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("DEPRECATED: 'usage.js の saveFallbackData' は非推奨です"),
        expect.any(String)
      );
    });
  });
  
  describe('updateFallbackData', () => {
    test('非推奨警告を表示してfallbackDataStoreに委譲する', async () => {
      // 関数実行
      const result = await usageService.updateFallbackData(TEST_TYPE, TEST_DATA_ITEMS);
      
      // 検証
      expect(result).toEqual({ success: true, updated: 2 });
      expect(fallbackDataStore.updateFallbackData).toHaveBeenCalledWith(TEST_TYPE, TEST_DATA_ITEMS);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("DEPRECATED: 'usage.js の updateFallbackData' は非推奨です"),
        expect.any(String)
      );
    });
  });
  
  describe('環境による動作の違い', () => {
    test('テスト環境では例外をスローしない', () => {
      // 環境がテスト環境であることを確認
      expect(ENV.NODE_ENV).toBe('test');
      expect(usageService._shouldThrowDeprecationError()).toBe(false);
      
      // 関数実行 - 例外が発生しないことを確認
      expect(() => {
        usageService.getDefaultFallbackData(TEST_SYMBOL, TEST_TYPE);
      }).not.toThrow();
    });
    
    test('開発環境では例外をスローする', () => {
      // 一時的に環境を開発環境に変更
      const originalNodeEnv = ENV.NODE_ENV;
      ENV.NODE_ENV = 'development';
      
      // _shouldThrowDeprecationErrorの結果が変わることを確認
      expect(usageService._shouldThrowDeprecationError()).toBe(true);
      
      // 環境を元に戻す
      ENV.NODE_ENV = originalNodeEnv;
    });
  });
});
