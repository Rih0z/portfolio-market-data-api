/**
 * ファイルパス: __tests__/unit/utils/dynamoDbService.test.js
 * 
 * DynamoDBクライアントユーティリティのユニットテスト
 * 接続、リトライ、エラーハンドリング機能をテスト
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-15
 */

const {
  getDynamoDBClient,
  createDynamoDBClient,
  getTableName
} = require('../../../src/utils/dynamoDbService');

const { 
  DynamoDBClient,
  DynamoDBServiceException
} = require('@aws-sdk/client-dynamodb');

const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand
} = require('@aws-sdk/lib-dynamodb');

// AWS SDKとモジュールをモック化
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

describe('DynamoDB Service Utility', () => {
  // 元の環境変数を保存
  const originalEnv = process.env;
  
  // モックDynamoDBクライアントとドキュメントクライアント
  const mockDynamoDBClient = {
    send: jest.fn()
  };
  
  const mockDocumentClient = {
    send: jest.fn()
  };
  
  // 各テスト前の準備
  beforeEach(() => {
    // 環境変数をリセット
    process.env = { ...originalEnv };
    
    // モックをリセット
    jest.clearAllMocks();
    
    // DynamoDBClient コンストラクタのモック
    DynamoDBClient.mockImplementation(() => mockDynamoDBClient);
    
    // DynamoDBDocumentClient.from のモック
    DynamoDBDocumentClient.from.mockReturnValue(mockDocumentClient);
    
    // コマンドのモック
    GetCommand.mockImplementation((params) => ({ ...params, type: 'get' }));
    PutCommand.mockImplementation((params) => ({ ...params, type: 'put' }));
    QueryCommand.mockImplementation((params) => ({ ...params, type: 'query' }));
    DeleteCommand.mockImplementation((params) => ({ ...params, type: 'delete' }));
  });
  
  // 各テスト後のクリーンアップ
  afterAll(() => {
    // 環境変数を元に戻す
    process.env = originalEnv;
  });

  describe('createDynamoDBClient', () => {
    test('環境変数から設定を読み込んでクライアントを作成する', () => {
      // テスト用の環境変数を設定
      process.env.AWS_REGION = 'us-east-1';
      process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
      
      // テスト対象の関数を実行
      const client = createDynamoDBClient();
      
      // DynamoDBClient コンストラクタが正しいパラメータで呼び出されたか検証
      expect(DynamoDBClient).toHaveBeenCalledWith(
        expect.objectContaining({
          region: 'us-east-1',
          endpoint: 'http://localhost:8000'
        })
      );
      
      // DynamoDBDocumentClient.from が呼び出されたか検証
      expect(DynamoDBDocumentClient.from).toHaveBeenCalledWith(
        mockDynamoDBClient,
        expect.any(Object)
      );
      
      // 返されたクライアントを検証
      expect(client).toBe(mockDocumentClient);
    });
    
    test('リージョンのデフォルト値を使用する', () => {
      // AWS_REGION 環境変数を削除
      delete process.env.AWS_REGION;
      
      // テスト対象の関数を実行
      createDynamoDBClient();
      
      // デフォルトリージョンで呼び出されたか検証
      expect(DynamoDBClient).toHaveBeenCalledWith(
        expect.objectContaining({
          region: expect.any(String) // デフォルト値
        })
      );
    });
    
    test('ローカルエンドポイントが指定されていない場合は省略する', () => {
      // DYNAMODB_ENDPOINT 環境変数を削除
      delete process.env.DYNAMODB_ENDPOINT;
      
      // テスト対象の関数を実行
      createDynamoDBClient();
      
      // endpointなしで呼び出されたか検証
      const callArgs = DynamoDBClient.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('endpoint');
    });
    
    test('マーシャリングオプションを設定する', () => {
      // テスト対象の関数を実行
      createDynamoDBClient();
      
      // DynamoDBDocumentClient.from が正しいマーシャリングオプションで呼び出されたか検証
      expect(DynamoDBDocumentClient.from).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          marshallOptions: expect.any(Object),
          unmarshallOptions: expect.any(Object)
        })
      );
    });
  });

  describe('getDynamoDBClient', () => {
    test('クライアントが存在しない場合は新しいクライアントを作成する', () => {
      // グローバル変数をリセット
      global.dynamoDBClient = undefined;
      
      // テスト対象の関数を実行
      const client = getDynamoDBClient();
      
      // クライアントが作成されたか検証
      expect(DynamoDBClient).toHaveBeenCalled();
      expect(DynamoDBDocumentClient.from).toHaveBeenCalled();
      
      // 返されたクライアントを検証
      expect(client).toBe(mockDocumentClient);
      
      // グローバル変数に保存されたか検証
      expect(global.dynamoDBClient).toBe(mockDocumentClient);
    });
    
    test('クライアントがすでに存在する場合は既存のクライアントを返す', () => {
      // グローバル変数を設定
      global.dynamoDBClient = mockDocumentClient;
      
      // テスト対象の関数を実行
      const client = getDynamoDBClient();
      
      // 新しいクライアントが作成されていないことを検証
      expect(DynamoDBClient).not.toHaveBeenCalled();
      expect(DynamoDBDocumentClient.from).not.toHaveBeenCalled();
      
      // 既存のクライアントが返されたことを検証
      expect(client).toBe(mockDocumentClient);
    });
    
    test('forceRefresh=trueの場合は既存のクライアントを再作成する', () => {
      // グローバル変数を設定
      global.dynamoDBClient = mockDocumentClient;
      
      // テスト対象の関数を実行 - 強制リフレッシュ
      const client = getDynamoDBClient(true);
      
      // 新しいクライアントが作成されたことを検証
      expect(DynamoDBClient).toHaveBeenCalled();
      expect(DynamoDBDocumentClient.from).toHaveBeenCalled();
      
      // 新しいクライアントが返されたことを検証
      expect(client).toBe(mockDocumentClient);
      expect(global.dynamoDBClient).toBe(mockDocumentClient);
    });
  });

  describe('getTableName', () => {
    test('環境変数から適切なテーブル名を生成する', () => {
      // テスト用の環境変数を設定
      process.env.DYNAMODB_TABLE_PREFIX = 'test-';
      
      // テスト対象の関数を実行
      const tableName = getTableName('users');
      
      // テーブル名を検証
      expect(tableName).toBe('test-users');
    });
    
    test('環境変数が設定されていない場合はデフォルトプレフィックスを使用する', () => {
      // DYNAMODB_TABLE_PREFIX 環境変数を削除
      delete process.env.DYNAMODB_TABLE_PREFIX;
      
      // テスト対象の関数を実行
      const tableName = getTableName('users');
      
      // テーブル名を検証（デフォルトプレフィックスを使用）
      expect(tableName).toBeTruthy();
      expect(tableName).toContain('users');
    });
    
    test('特定のテーブル名環境変数がある場合はそれを優先する', () => {
      // テスト用の環境変数を設定
      process.env.DYNAMODB_TABLE_PREFIX = 'test-';
      process.env.SESSION_TABLE = 'custom-sessions';
      
      // テスト対象の関数を実行
      const tableName = getTableName('sessions');
      
      // テーブル名を検証
      expect(tableName).toBe('custom-sessions');
    });
    
    test('テーブル名が指定されていない場合はエラーをスローする', () => {
      // テーブル名なしで呼び出すとエラーになることを検証
      expect(() => getTableName()).toThrow();
      expect(() => getTableName('')).toThrow();
    });
  });

  describe('エラーハンドリング', () => {
    test('タイムアウトエラーのリトライと処理', async () => {
      // モックセットアップ
      const mockTimeoutError = new DynamoDBServiceException(
        'Connection timed out',
        { name: 'TimeoutError' }
      );
      
      // 1回目はタイムアウトエラー、2回目は成功するようにモック
      mockDocumentClient.send
        .mockRejectedValueOnce(mockTimeoutError)
        .mockResolvedValueOnce({ Item: { id: '123', name: 'Test' } });
      
      // リトライ関数をモック
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback) => callback());
      
      // テスト用の動的インポート
      const { getItem } = require('../../../src/utils/dynamoDb');
      
      try {
        // テスト対象の関数を実行
        const result = await getItem('test-table', { id: '123' });
        
        // 2回呼び出されたことを検証
        expect(mockDocumentClient.send).toHaveBeenCalledTimes(2);
        
        // 結果を検証
        expect(result).toEqual({ id: '123', name: 'Test' });
      } finally {
        // setTimeout を元に戻す
        global.setTimeout = originalSetTimeout;
      }
    });
    
    test('ThrottlingException のリトライと処理', async () => {
      // モックセットアップ
      const mockThrottlingError = new DynamoDBServiceException(
        'Throttling Exception',
        { name: 'ThrottlingException' }
      );
      
      // 1回目はスロットリングエラー、2回目は成功するようにモック
      mockDocumentClient.send
        .mockRejectedValueOnce(mockThrottlingError)
        .mockResolvedValueOnce({ Item: { id: '123', name: 'Test' } });
      
      // リトライ関数をモック
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback) => callback());
      
      // テスト用の動的インポート
      const { getItem } = require('../../../src/utils/dynamoDb');
      
      try {
        // テスト対象の関数を実行
        const result = await getItem('test-table', { id: '123' });
        
        // 2回呼び出されたことを検証
        expect(mockDocumentClient.send).toHaveBeenCalledTimes(2);
        
        // 結果を検証
        expect(result).toEqual({ id: '123', name: 'Test' });
      } finally {
        // setTimeout を元に戻す
        global.setTimeout = originalSetTimeout;
      }
    });
    
    test('最大リトライ回数を超えた場合はエラーをスロー', async () => {
      // モックセットアップ - 常にタイムアウトエラーを返す
      const mockTimeoutError = new DynamoDBServiceException(
        'Connection timed out',
        { name: 'TimeoutError' }
      );
      
      mockDocumentClient.send.mockRejectedValue(mockTimeoutError);
      
      // リトライ関数をモック
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback) => callback());
      
      // テスト用の動的インポート
      const { getItem } = require('../../../src/utils/dynamoDb');
      
      try {
        // テスト対象の関数を実行
        await expect(getItem('test-table', { id: '123' })).rejects.toThrow('Connection timed out');
        
        // 最大回数呼び出されたことを検証
        expect(mockDocumentClient.send.mock.calls.length).toBeGreaterThan(1);
      } finally {
        // setTimeout を元に戻す
        global.setTimeout = originalSetTimeout;
      }
    });
    
    test('その他のエラーは直ちに再スローする', async () => {
      // モックセットアップ - ValidationExceptionを返す
      const mockValidationError = new DynamoDBServiceException(
        'Validation Exception',
        { name: 'ValidationException' }
      );
      
      mockDocumentClient.send.mockRejectedValue(mockValidationError);
      
      // テスト用の動的インポート
      const { getItem } = require('../../../src/utils/dynamoDb');
      
      // テスト対象の関数を実行
      await expect(getItem('test-table', { id: '123' })).rejects.toThrow('Validation Exception');
      
      // 1回だけ呼び出されたことを検証（リトライなし）
      expect(mockDocumentClient.send).toHaveBeenCalledTimes(1);
    });
  });
});

