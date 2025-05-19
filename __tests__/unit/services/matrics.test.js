/**
 * ファイルパス: __tests__/unit/services/matrics.test.js
 * 
 * メトリクスサービスのユニットテスト
 * データソースのパフォーマンスとプロパティの追跡機能をテストします
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-18
 */

// テスト対象モジュールのインポート
const metricsService = require('../../../src/services/matrics');

// 依存モジュールのインポート
const awsConfig = require('../../../src/utils/awsConfig');
const logger = require('../../../src/utils/logger');
const { DATA_TYPES } = require('../../../src/config/constants');

// モジュールのモック化
jest.mock('../../../src/utils/awsConfig');
jest.mock('../../../src/utils/logger');

describe('Metrics Service', () => {
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
  const METRICS_TABLE = 'portfolio-market-data-metrics';
  const TEST_DATA_TYPE = DATA_TYPES.US_STOCK;
  const TEST_SOURCE = 'yahoo-finance-api';
  
  // 各テスト前の準備
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // グローバルリクエスト追跡をリセット
    global._metricsRequestsInProgress = undefined;
    global._metricsBatchRequestsInProgress = undefined;
    
    // DynamoDBモックを設定
    awsConfig.getDynamoDb.mockReturnValue(mockDynamoDb);
    
    // 初期化フラグをリセット（テスト対象モジュールの内部状態）
    // 注意: これは通常良い方法ではないが、状態を持つモジュールのテストには必要
    metricsService.initializeMetricsTable();
  });
  
  describe('initializeMetricsTable', () => {
    test('テーブルを初期化して成功を返す', async () => {
      // DynamoDBの応答を設定
      mockDynamoDb.get.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValueOnce({
          Item: {
            metricType: 'SOURCE_PRIORITIES',
            metricKey: 'current',
            priorities: {
              [TEST_DATA_TYPE]: ['source1', 'source2']
            }
          }
        })
      });
      
      // 関数実行
      const result = await metricsService.initializeMetricsTable();
      
      // 検証
      expect(result).toBe(true);
      expect(awsConfig.getDynamoDb).toHaveBeenCalled();
    });
    
    test('エラー発生時はデフォルト値を使用して初期化する', async () => {
      // DynamoDBがエラーをスローするようにモック
      mockDynamoDb.get.mockReturnValueOnce({
        promise: jest.fn().mockRejectedValueOnce(new Error('DB error'))
      });
      
      // スパイを設定
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // 関数実行
      const result = await metricsService.initializeMetricsTable();
      
      // 検証
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error initializing metrics table:',
        expect.any(Error)
      );
      
      // クリーンアップ
      consoleSpy.mockRestore();
    });
  });
  
  describe('getSourcePriority', () => {
    test('データタイプに対する優先順位を返す', async () => {
      // DynamoDBの応答を設定
      mockDynamoDb.get.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValueOnce({
          Item: {
            priorities: {
              [TEST_DATA_TYPE]: ['source1', 'source2', 'source3']
            }
          }
        })
      });
      
      // 関数実行
      const priorities = await metricsService.getSourcePriority(TEST_DATA_TYPE);
      
      // 検証
      expect(Array.isArray(priorities)).toBe(true);
    });
    
    test('データタイプのマッピングを正しく処理する', async () => {
      // テスト対象の関数
      await metricsService.getSourcePriority('jp-stock');
      
      // DynamoDBクエリが呼ばれたことを検証
      expect(mockDynamoDb.get).toHaveBeenCalled();
    });
  });
  
  describe('updateSourcePriority', () => {
    beforeEach(() => {
      // ソース優先順位の初期状態を設定
      mockDynamoDb.get.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValueOnce({
          Item: {
            priorities: {
              [TEST_DATA_TYPE]: ['source1', TEST_SOURCE, 'source3']
            }
          }
        })
      });
    });
    
    test('データソースの優先順位を上げる', async () => {
      // 関数実行
      const result = await metricsService.updateSourcePriority(
        TEST_DATA_TYPE, 
        TEST_SOURCE, 
        1 // 優先順位を上げる
      );
      
      // 検証
      expect(result).toBe(true);
      expect(mockDynamoDb.put).toHaveBeenCalled();
      
      // put呼び出しの引数を検証
      const putCallArgs = mockDynamoDb.put.mock.calls[0][0];
      expect(putCallArgs.TableName).toBe(METRICS_TABLE);
      expect(putCallArgs.Item.metricType).toBe('SOURCE_PRIORITIES');
    });
    
    test('データソースの優先順位を下げる', async () => {
      // 関数実行
      const result = await metricsService.updateSourcePriority(
        TEST_DATA_TYPE, 
        TEST_SOURCE, 
        -1 // 優先順位を下げる
      );
      
      // 検証
      expect(result).toBe(true);
      expect(mockDynamoDb.put).toHaveBeenCalled();
    });
    
    test('存在しないソースの場合は何もしない', async () => {
      // 関数実行
      const result = await metricsService.updateSourcePriority(
        TEST_DATA_TYPE, 
        'non-existent-source', 
        1
      );
      
      // 検証
      expect(result).toBe(false);
      // putは呼ばれないはず
      expect(mockDynamoDb.put).not.toHaveBeenCalled();
    });
    
    test('エラー発生時はfalseを返す', async () => {
      // DynamoDBのputがエラーをスローするようにモック
      mockDynamoDb.put.mockReturnValueOnce({
        promise: jest.fn().mockRejectedValueOnce(new Error('DB error'))
      });
      
      // スパイを設定
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // 関数実行
      const result = await metricsService.updateSourcePriority(
        TEST_DATA_TYPE, 
        TEST_SOURCE, 
        1
      );
      
      // 検証
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      
      // クリーンアップ
      consoleSpy.mockRestore();
    });
  });
  
  describe('startDataSourceRequest / recordDataSourceResult', () => {
    const TEST_SYMBOL = 'AAPL';
    
    test('リクエスト開始を記録し、リクエストIDを返す', async () => {
      // Date.nowをモック
      const mockTimestamp = 1621234567890;
      const realDateNow = Date.now;
      Date.now = jest.fn(() => mockTimestamp);
      
      // 関数実行
      const requestId = await metricsService.startDataSourceRequest(
        TEST_SOURCE,
        TEST_SYMBOL,
        TEST_DATA_TYPE
      );
      
      // 検証
      expect(requestId).toBe(`${TEST_SOURCE}:${TEST_SYMBOL}:${mockTimestamp}`);
      expect(global._metricsRequestsInProgress).toBeDefined();
      expect(global._metricsRequestsInProgress[requestId]).toEqual({
        source: TEST_SOURCE,
        symbol: TEST_SYMBOL,
        dataType: TEST_DATA_TYPE,
        startTime: mockTimestamp
      });
      
      // クリーンアップ
      Date.now = realDateNow;
    });
    
    test('リクエスト結果を正しく記録する（成功ケース）', async () => {
      // 関数実行
      await metricsService.recordDataSourceResult(
        TEST_SOURCE,
        true, // 成功
        150, // 応答時間（ミリ秒）
        TEST_DATA_TYPE,
        TEST_SYMBOL
      );
      
      // 検証
      expect(mockDynamoDb.put).toHaveBeenCalledTimes(3); // 3つのメトリクス更新
      
      // 各putリクエストの内容を検証
      mockDynamoDb.put.mock.calls.forEach(call => {
        const params = call[0];
        expect(params.TableName).toBe(METRICS_TABLE);
        
        // 成功フラグを確認
        if (params.Item.metricType === 'SYMBOL_RESULT') {
          expect(params.Item.success).toBe(true);
          expect(params.Item.responseTime).toBe(150);
        }
      });
    });
    
    test('リクエスト結果を正しく記録する（失敗ケース）', async () => {
      const errorMessage = 'API timeout';
      
      // 関数実行
      await metricsService.recordDataSourceResult(
        TEST_SOURCE,
        false, // 失敗
        250, // 応答時間（ミリ秒）
        TEST_DATA_TYPE,
        TEST_SYMBOL,
        errorMessage
      );
      
      // 検証
      expect(mockDynamoDb.put).toHaveBeenCalledTimes(3); // 3つのメトリクス更新
      
      // 各putリクエストの内容を検証
      mockDynamoDb.put.mock.calls.forEach(call => {
        const params = call[0];
        expect(params.TableName).toBe(METRICS_TABLE);
        
        // 失敗フラグとエラーメッセージを確認
        if (params.Item.metricType === 'SYMBOL_RESULT') {
          expect(params.Item.success).toBe(false);
          expect(params.Item.errorMessage).toBe(errorMessage);
        }
      });
    });
  });
  
  describe('startBatchDataSourceRequest / recordBatchDataSourceResult', () => {
    const BATCH_COUNT = 5;
    
    test('バッチリクエスト開始を記録し、リクエストIDを返す', async () => {
      // Date.nowをモック
      const mockTimestamp = 1621234567890;
      const realDateNow = Date.now;
      Date.now = jest.fn(() => mockTimestamp);
      
      // 関数実行
      const requestId = await metricsService.startBatchDataSourceRequest(
        TEST_SOURCE,
        BATCH_COUNT,
        TEST_DATA_TYPE
      );
      
      // 検証
      expect(requestId).toBe(`${TEST_SOURCE}:batch:${mockTimestamp}`);
      expect(global._metricsBatchRequestsInProgress).toBeDefined();
      expect(global._metricsBatchRequestsInProgress[requestId]).toEqual({
        source: TEST_SOURCE,
        count: BATCH_COUNT,
        dataType: TEST_DATA_TYPE,
        startTime: mockTimestamp
      });
      
      // クリーンアップ
      Date.now = realDateNow;
    });
    
    test('バッチリクエスト結果を正しく記録する', async () => {
      const successCount = 3;
      const failCount = 2;
      const totalTime = 500;
      
      // 関数実行
      await metricsService.recordBatchDataSourceResult(
        TEST_SOURCE,
        successCount,
        failCount,
        totalTime,
        TEST_DATA_TYPE
      );
      
      // 検証
      expect(mockDynamoDb.put).toHaveBeenCalledTimes(7); // 2つのバッチメトリクス + 5つの個別エントリ
      
      // バッチメトリクスの内容を検証
      const batchCalls = mockDynamoDb.put.mock.calls.filter(call => 
        call[0].Item.metricType.startsWith('BATCH_')
      );
      
      expect(batchCalls.length).toBe(2);
      batchCalls.forEach(call => {
        const params = call[0];
        expect(params.TableName).toBe(METRICS_TABLE);
        expect(params.Item.successCount).toBe(successCount);
        expect(params.Item.failCount).toBe(failCount);
        expect(params.Item.totalTime).toBe(totalTime);
      });
      
      // 個別エントリの数を検証
      const individualCalls = mockDynamoDb.put.mock.calls.filter(call => 
        call[0].Item.metricType === 'SOURCE_TOTAL'
      );
      
      expect(individualCalls.length).toBe(5); // 成功3件 + 失敗2件
    });
  });
  
  describe('getDataSourceMetrics', () => {
    test('データソースのメトリクスを取得する', async () => {
      // メトリクスのモックデータ
      const mockMetrics = {
        metricType: 'SOURCE_TOTAL',
        metricKey: TEST_SOURCE,
        dataType: TEST_DATA_TYPE,
        requests: 100,
        successes: 95,
        failures: 5,
        totalResponseTime: 15000,
        avgResponseTime: 150,
        successRate: 95,
        errorTypes: {
          TIMEOUT: 3,
          NETWORK: 2
        }
      };
      
      // DynamoDBの応答を設定
      mockDynamoDb.get.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValueOnce({
          Item: mockMetrics
        })
      });
      
      // 関数実行
      const result = await metricsService.getDataSourceMetrics(TEST_SOURCE, TEST_DATA_TYPE);
      
      // 検証
      expect(result).toEqual(mockMetrics);
      expect(mockDynamoDb.get).toHaveBeenCalledWith({
        TableName: METRICS_TABLE,
        Key: {
          metricType: 'SOURCE_TOTAL',
          metricKey: TEST_SOURCE
        }
      });
    });
    
    test('メトリクスが存在しない場合はnullを返す', async () => {
      // DynamoDBの応答を設定
      mockDynamoDb.get.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValueOnce({
          // Itemがない
        })
      });
      
      // 関数実行
      const result = await metricsService.getDataSourceMetrics(TEST_SOURCE, TEST_DATA_TYPE);
      
      // 検証
      expect(result).toBeNull();
    });
    
    test('エラー発生時はnullを返す', async () => {
      // DynamoDBがエラーをスローするようにモック
      mockDynamoDb.get.mockReturnValueOnce({
        promise: jest.fn().mockRejectedValueOnce(new Error('DB error'))
      });
      
      // スパイを設定
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // 関数実行
      const result = await metricsService.getDataSourceMetrics(TEST_SOURCE, TEST_DATA_TYPE);
      
      // 検証
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      
      // クリーンアップ
      consoleSpy.mockRestore();
    });
  });
});
