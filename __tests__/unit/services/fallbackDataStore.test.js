/**
 * ファイルパス: __tests__/unit/services/fallbackDataStore.test.js
 * 
 * フォールバックデータストアサービスのユニットテスト
 * データソースが利用できない場合のフォールバックデータ管理機能をテストします
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-18
 * @updated 2025-05-21 非推奨機能のテスト調整
 */

// テスト対象モジュールのインポート
const fallbackDataStore = require('../../../src/services/fallbackDataStore');

// 依存モジュールのインポート
const axios = require('axios');
const cacheService = require('../../../src/services/cache');
const alertService = require('../../../src/services/alerts');
const awsConfig = require('../../../src/utils/awsConfig');
const logger = require('../../../src/utils/logger');
const { ENV } = require('../../../src/config/envConfig');
const { DATA_TYPES } = require('../../../src/config/constants');

// モジュールのモック化
jest.mock('axios');
jest.mock('../../../src/services/cache');
jest.mock('../../../src/services/alerts');
jest.mock('../../../src/utils/awsConfig');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/config/envConfig', () => ({
  ENV: {
    NODE_ENV: 'test'
  }
}));

describe('Fallback Data Store Service', () => {
  // DynamoDBのモック
  const mockDynamoDb = {
    get: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({})
    }),
    put: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({})
    }),
    update: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({})
    }),
    query: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Items: [] })
    })
  };
  
  // テスト用データ
  const TEST_SYMBOL = 'AAPL';
  const TEST_TYPE = DATA_TYPES.US_STOCK;
  const MOCK_DATE = '2025-05-18T12:00:00Z';
  
  // 各テスト前の準備
  beforeEach(() => {
    // モックをリセット
    jest.resetAllMocks();
    
    // DynamoDBモックを設定
    awsConfig.getDynamoDb.mockReturnValue(mockDynamoDb);
    
    // Date.nowとtoISOStringをモック
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(MOCK_DATE);
    
    // キャッシュのモック初期化
    fallbackDataStore.cache = {
      lastFetched: 0,
      data: {
        stocks: {},
        etfs: {},
        mutualFunds: {},
        exchangeRates: {}
      }
    };

    // cacheService.getの返り値を設定
    cacheService.get.mockImplementation((key) => {
      if (key.includes(TEST_SYMBOL)) {
        return Promise.resolve({
          data: {
            ticker: TEST_SYMBOL,
            price: 150,
            name: 'Apple Inc.'
          }
        });
      }
      return Promise.resolve(null);
    });

    // GitHubからの応答をモック
    axios.get.mockImplementation((url) => {
      if (url.includes('fallback-stocks.json')) {
        return Promise.resolve({
          data: {
            [TEST_SYMBOL]: {
              price: 150,
              change: 1.5,
              name: 'Apple Inc.'
            }
          }
        });
      }
      return Promise.resolve({ data: {} });
    });
  });
  
  describe('getFallbackData', () => {
    test('キャッシュが有効な場合はキャッシュからデータを返す', async () => {
      // キャッシュデータを設定
      const mockCacheData = {
        stocks: { 
          [TEST_SYMBOL]: { price: 150 } 
        },
        etfs: {},
        mutualFunds: {},
        exchangeRates: {}
      };
      
      // fallbackDataCacheを直接設定する
      fallbackDataStore.cache = {
        lastFetched: Date.now() - 1000, // 1秒前
        data: mockCacheData
      };
      
      // 関数実行
      const result = await fallbackDataStore.getFallbackData();
      
      // 検証
      expect(result).toEqual(mockCacheData);
      expect(axios.get).not.toHaveBeenCalled(); // APIは呼ばれない
      expect(logger.debug).toHaveBeenCalledWith('Using cached fallback data');
    });
    
    test('強制更新フラグが設定されている場合はGitHubからデータを取得', async () => {
      // GitHubからの応答をモック
      axios.get.mockImplementation((url) => {
        if (url.includes('fallback-stocks.json')) {
          return Promise.resolve({ data: { [TEST_SYMBOL]: { price: 150 } } });
        }
        return Promise.resolve({ data: {} });
      });
      
      // 関数実行
      const result = await fallbackDataStore.getFallbackData(true);
      
      // 検証
      expect(result).toHaveProperty('stocks');
      expect(result.stocks).toHaveProperty(TEST_SYMBOL);
      expect(axios.get).toHaveBeenCalledTimes(4); // 4つのJSONファイルを取得
      expect(logger.info).toHaveBeenCalledWith('Fallback data updated from GitHub');
    });
    
    test('GitHub APIエラー時はキャッシュを使用する', async () => {
      // キャッシュデータを設定
      const mockCacheData = {
        stocks: { 
          [TEST_SYMBOL]: { price: 150 }
        },
        etfs: {},
        mutualFunds: {},
        exchangeRates: {}
      };
      
      // fallbackDataCacheを直接設定する
      fallbackDataStore.cache = {
        lastFetched: Date.now() - 3600000, // 1時間前
        data: mockCacheData
      };
      
      // GitHubからの応答をモック（エラー）
      axios.get.mockRejectedValue(new Error('API error'));
      
      // 関数実行
      const result = await fallbackDataStore.getFallbackData(true);
      
      // 検証
      expect(result).toEqual(mockCacheData);
      expect(axios.get).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Error fetching fallback data from GitHub:',
        expect.any(Error)
      );
      expect(logger.warn).toHaveBeenCalledWith('Using stale fallback data from cache');
    });
  });
  
  describe('getFallbackForSymbol', () => {
    test('特定の銘柄のフォールバックデータを取得する', async () => {
      // 関数実行
      const result = await fallbackDataStore.getFallbackForSymbol(TEST_SYMBOL, TEST_TYPE);
      
      // 検証
      expect(result).toBeDefined();
      expect(result.ticker).toBe(TEST_SYMBOL);
      expect(result.price).toBe(150);
      // 最終更新日時が設定されていることを確認
      expect(result.lastUpdated).toBeDefined();
      // ソースが設定されていることを確認
      expect(result.source).toBeDefined();
    });
    
    test('非推奨のデータタイプを使用した場合、警告を表示して正しく動作する', async () => {
      // 関数実行（非推奨データタイプ 'stock' を使用）
      const result = await fallbackDataStore.getFallbackForSymbol(TEST_SYMBOL, 'stock');
      
      // 検証
      expect(result).toBeDefined();
      expect(result.ticker).toBe(TEST_SYMBOL);
      expect(result.price).toBe(150);
      
      // 警告が出たことを確認
      expect(logger.warn).toHaveBeenCalled();
      const warnArgs = logger.warn.mock.calls[0];
      expect(warnArgs[0]).toContain("DEPRECATED: 'データタイプ 'stock'' は非推奨です");
    });
    
    test('存在しない銘柄の場合はnullを返す', async () => {
      // GitHubからの応答をモック（空のデータ）
      axios.get.mockResolvedValue({ data: {} });
      
      // デフォルトフォールバックデータをnullに設定
      jest.spyOn(fallbackDataStore, 'getDefaultFallbackData').mockReturnValueOnce(null);
      
      // 関数実行
      const result = await fallbackDataStore.getFallbackForSymbol('NONEXISTENT', TEST_TYPE);
      
      // 検証
      expect(result).toBeNull();
    });
  });
  
  describe('recordFailedFetch', () => {
    test('データ取得失敗を記録する', async () => {
      // エラー情報
      const errorInfo = new Error('API timeout');
      
      // 関数実行
      const result = await fallbackDataStore.recordFailedFetch(TEST_SYMBOL, TEST_TYPE, errorInfo);
      
      // 検証
      expect(result).toBe(true);
      expect(mockDynamoDb.put).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: expect.any(String),
          Item: expect.objectContaining({
            symbol: TEST_SYMBOL,
            type: TEST_TYPE,
            reason: 'API timeout',
            dateKey: expect.any(String)
          })
        })
      );
      expect(mockDynamoDb.update).toHaveBeenCalled(); // カウンター更新
    });
    
    test('エラー文字列を受け取った場合も正しく処理する', async () => {
      // エラー情報（文字列）
      const errorInfo = 'Rate limit exceeded';
      
      // 関数実行
      await fallbackDataStore.recordFailedFetch(TEST_SYMBOL, TEST_TYPE, errorInfo);
      
      // 検証
      expect(mockDynamoDb.put).toHaveBeenCalledWith(
        expect.objectContaining({
          Item: expect.objectContaining({
            reason: errorInfo
          })
        })
      );
    });
  });
  
  describe('getFailedSymbols', () => {
    test('特定の日付と型のフェイル済み銘柄一覧を取得する', async () => {
      // テストデータ
      const dateKey = '2025-05-18';
      const expectedSymbols = [TEST_SYMBOL, 'MSFT', 'GOOG'];
      
      // DynamoDBの応答を設定
      mockDynamoDb.get.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValueOnce({
          Item: {
            id: `count:${dateKey}:${TEST_TYPE}`,
            count: expectedSymbols.length,
            symbols: expectedSymbols
          }
        })
      });
      
      // 関数実行
      const symbols = await fallbackDataStore.getFailedSymbols(dateKey, TEST_TYPE);
      
      // 検証
      expect(symbols).toEqual(expectedSymbols);
      expect(mockDynamoDb.get).toHaveBeenCalledWith({
        TableName: expect.any(String),
        Key: { id: `count:${dateKey}:${TEST_TYPE}` }
      });
    });
    
    test('型が指定されていない場合は全ての型の銘柄を取得', async () => {
      // テストデータ
      const dateKey = '2025-05-18';
      const stocks = [TEST_SYMBOL, 'MSFT'];
      const funds = ['2931113C'];
      
      // DynamoDBの応答を設定
      mockDynamoDb.query.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValueOnce({
          Items: [
            {
              id: `count:${dateKey}:us-stock`,
              symbols: stocks
            },
            {
              id: `count:${dateKey}:mutual-fund`,
              symbols: funds
            }
          ]
        })
      });
      
      // 関数実行
      const symbols = await fallbackDataStore.getFailedSymbols(dateKey);
      
      // 検証
      expect(symbols).toEqual([...stocks, ...funds]);
      expect(mockDynamoDb.query).toHaveBeenCalledWith(
        expect.objectContaining({
          KeyConditionExpression: 'begins_with(id, :prefix)',
          ExpressionAttributeValues: { ':prefix': `count:${dateKey}` }
        })
      );
    });
  });
  
  describe('getFailureStatistics', () => {
    test('失敗記録の統計を取得する', async () => {
      // テストデータ
      const days = 3;
      const dateKeys = ['2025-05-18', '2025-05-17', '2025-05-16'];
      
      // 各日付のクエリ応答をモック
      dateKeys.forEach((dateKey, index) => {
        mockDynamoDb.query.mockReturnValueOnce({
          promise: jest.fn().mockResolvedValueOnce({
            Items: [
              {
                id: `count:${dateKey}:us-stock`,
                count: 5,
                symbols: [TEST_SYMBOL, 'MSFT']
              },
              {
                id: `count:${dateKey}:jp-stock`,
                count: 3,
                symbols: ['7203', '9984']
              }
            ]
          })
        });
      });
      
      // 関数実行
      const stats = await fallbackDataStore.getFailureStatistics(days);
      
      // 検証
      expect(stats).toBeDefined();
      expect(stats.totalFailures).toBe(24); // (5+3) × 3
      expect(stats.byDate).toHaveProperty(dateKeys[0]);
      expect(stats.byType).toBeDefined();
      expect(stats.mostFailedSymbols).toBeDefined();
      expect(Array.isArray(stats.mostFailedSymbols)).toBe(true);
    });
    
    test('エラー発生時はデフォルト統計を返す', async () => {
      // DynamoDBがエラーをスローするようにモック
      mockDynamoDb.query.mockReturnValueOnce({
        promise: jest.fn().mockRejectedValueOnce(new Error('DB error'))
      });
      
      // 関数実行
      const stats = await fallbackDataStore.getFailureStatistics(1);
      
      // 検証
      expect(stats).toEqual({
        error: expect.any(String),
        totalFailures: 0
      });
      expect(logger.error).toHaveBeenCalledWith(
        'Error getting failure statistics:',
        expect.any(Error)
      );
    });
  });
  
  describe('exportCurrentFallbacksToGitHub', () => {
    const GITHUB_TOKEN = 'test-token';
    
    beforeEach(() => {
      // GitHub関連の環境変数をモック
      process.env.GITHUB_TOKEN = GITHUB_TOKEN;
      
      // 失敗した銘柄のモックデータを用意
      mockDynamoDb.query.mockImplementation(() => ({
        promise: jest.fn().mockResolvedValue({
          Items: [
            {
              id: `failure:${TEST_SYMBOL}:us-stock`,
              type: 'us-stock',
              symbol: TEST_SYMBOL
            }
          ]
        })
      }));
      
      // GitHubのファイル情報取得APIをモック
      axios.get.mockResolvedValue({
        data: {
          sha: 'test-sha'
        }
      });
      
      // GitHubのファイル更新APIをモック
      axios.put.mockResolvedValue({
        data: {
          content: {
            sha: 'new-sha'
          }
        }
      });
    });
    
    afterEach(() => {
      // 環境変数をリセット
      delete process.env.GITHUB_TOKEN;
    });
    
    test('現在のフォールバックデータをGitHubに書き出す', async () => {
      // モックの設定を調整
      axios.put.mockResolvedValueOnce({
        data: {
          content: { sha: 'new-sha-1' }
        }
      }).mockResolvedValueOnce({
        data: {
          content: { sha: 'new-sha-2' }
        }
      }).mockResolvedValueOnce({
        data: {
          content: { sha: 'new-sha-3' }
        }
      }).mockResolvedValueOnce({
        data: {
          content: { sha: 'new-sha-4' }
        }
      });
      
      // 関数実行
      const result = await fallbackDataStore.exportCurrentFallbacksToGitHub();
      
      // 検証
      expect(result).toBe(true);
      expect(axios.put).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Successfully updated fallback data on GitHub');
    });
    
    test('GitHub APIエラー時はfalseを返す', async () => {
      // モックの設定を調整
      const mockError = new Error('API error');
      axios.get.mockRejectedValue(mockError);
      
      // 関数実行
      const result = await fallbackDataStore.exportCurrentFallbacksToGitHub();
      
      // 検証
      expect(result).toBe(false);
      // logger.errorのcallの引数を検証する
      expect(logger.error).toHaveBeenCalled();
      const errorArgs = logger.error.mock.calls[0];
      expect(errorArgs[0]).toBe('Error exporting fallbacks to GitHub:');
      expect(errorArgs[1]).toEqual(mockError);
    });
    
    test('GitHub tokenがない場合はfalseを返す', async () => {
      // GitHub tokenを削除
      delete process.env.GITHUB_TOKEN;
      
      // 関数実行
      const result = await fallbackDataStore.exportCurrentFallbacksToGitHub();
      
      // 検証
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('GitHub token not provided');
    });
  });
  
  describe('非推奨機能', () => {
    test('getSymbolFallbackData は警告を表示して正しく動作する (テスト環境)', async () => {
      // 環境がテスト環境であることを確認
      expect(ENV.NODE_ENV).toBe('test');
      expect(fallbackDataStore._shouldThrowDeprecationError()).toBe(false);
      
      // 関数実行（非推奨関数を使用）
      const result = await fallbackDataStore.getSymbolFallbackData(TEST_SYMBOL, TEST_TYPE);
      
      // 検証
      expect(result).toBeDefined();
      expect(result.ticker).toBe(TEST_SYMBOL);
      
      // 警告が出たことを確認
      expect(logger.warn).toHaveBeenCalled();
      const warnArgs = logger.warn.mock.calls[0];
      expect(warnArgs[0]).toContain("DEPRECATED: 'getSymbolFallbackData' は非推奨です");
    });
    
    test('exportFallbacks は警告を表示して正しく動作する (テスト環境)', async () => {
      // モックの設定を調整
      axios.put.mockResolvedValueOnce({
        data: {
          content: { sha: 'new-sha-1' }
        }
      }).mockResolvedValueOnce({
        data: {
          content: { sha: 'new-sha-2' }
        }
      }).mockResolvedValueOnce({
        data: {
          content: { sha: 'new-sha-3' }
        }
      }).mockResolvedValueOnce({
        data: {
          content: { sha: 'new-sha-4' }
        }
      });
      
      // 関数実行（非推奨関数を使用）
      const result = await fallbackDataStore.exportFallbacks();
      
      // 検証
      expect(result).toBe(true);
      
      // 警告が出たことを確認
      expect(logger.warn).toHaveBeenCalled();
      const warnArgs = logger.warn.mock.calls[0];
      expect(warnArgs[0]).toContain("DEPRECATED: 'exportFallbacks' は非推奨です");
    });
    
    test('getStats は警告を表示して正しく動作する (テスト環境)', async () => {
      // 日付の応答をモック
      mockDynamoDb.query.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValueOnce({
          Items: [
            {
              id: `count:2025-05-18:us-stock`,
              count: 5,
              symbols: [TEST_SYMBOL, 'MSFT']
            }
          ]
        })
      });
      
      // 関数実行（非推奨関数を使用）
      const result = await fallbackDataStore.getStats(1);
      
      // 検証
      expect(result).toBeDefined();
      
      // 警告が出たことを確認
      expect(logger.warn).toHaveBeenCalled();
      const warnArgs = logger.warn.mock.calls[0];
      expect(warnArgs[0]).toContain("DEPRECATED: 'getStats' は非推奨です");
    });
    
    test('cache プロパティにアクセスすると警告を表示する (テスト環境)', () => {
      // 非推奨プロパティにアクセス
      const cache = fallbackDataStore.cache;
      
      // 警告が出たことを確認
      expect(logger.warn).toHaveBeenCalled();
      const warnArgs = logger.warn.mock.calls[0];
      expect(warnArgs[0]).toContain("DEPRECATED: 'cache プロパティの直接参照' は非推奨です");
    });
    
    test('cache プロパティに値を設定すると警告を表示する (テスト環境)', () => {
      // 非推奨プロパティに設定
      fallbackDataStore.cache = { test: true };
      
      // 警告が出たことを確認
      expect(logger.warn).toHaveBeenCalled();
      const warnArgs = logger.warn.mock.calls[0];
      expect(warnArgs[0]).toContain("DEPRECATED: 'cache プロパティの直接設定' は非推奨です");
    });
  });
});
