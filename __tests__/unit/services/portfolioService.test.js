/**
 * ファイルパス: __tests__/unit/services/portfolioService.test.js
 * 
 * ポートフォリオサービスのユニットテスト
 * ポートフォリオ保存・読込機能をテスト
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-15
 */

// インポートパスを修正: portfolioService → googleDriveService
// このテストはポートフォリオ関連の機能をテストしていますが、実際にはgoogleDriveServiceを使用しています
const portfolioService = require('../../../src/services/googleDriveService');
const { withRetry } = require('../../../src/utils/retry');

// 依存モジュールをモック化
jest.mock('../../../src/services/googleDriveService');
jest.mock('../../../src/utils/retry');

describe('Portfolio Service', () => {
  // テスト用データ
  const mockUserId = 'user-123';
  const mockAccessToken = 'access-token-xyz';
  const mockFileId = 'file-123';
  const mockFileName = 'portfolio-data.json';
  
  const mockPortfolio = {
    name: 'Test Portfolio',
    holdings: [
      { symbol: 'AAPL', shares: 10, cost: 150.0 },
      { symbol: '7203', shares: 100, cost: 2000 }
    ],
    lastUpdated: '2025-05-15T10:00:00Z',
    createdBy: 'user-123'
  };
  
  const mockFilesList = [
    {
      id: 'file-123',
      name: 'portfolio-data.json',
      createdTime: '2025-05-10T10:00:00Z',
      modifiedTime: '2025-05-15T10:00:00Z'
    },
    {
      id: 'file-456',
      name: 'another-portfolio.json',
      createdTime: '2025-05-01T10:00:00Z',
      modifiedTime: '2025-05-05T10:00:00Z'
    }
  ];
  
  // 各テスト前の準備
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // Google Driveサービスのモック
    portfolioService.saveFile.mockResolvedValue({
      id: mockFileId,
      name: mockFileName,
      createdTime: '2025-05-15T10:00:00Z'
    });
    
    portfolioService.getFile.mockResolvedValue(
      JSON.stringify(mockPortfolio)
    );
    
    portfolioService.listFiles.mockResolvedValue(mockFilesList);
    
    portfolioService.deleteFile.mockResolvedValue(true);
    
    // withRetryのモック
    withRetry.mockImplementation((fn) => fn());
  });

  describe('savePortfolio', () => {
    test('新しいポートフォリオを保存する', async () => {
      // テスト対象の関数を実行
      const result = await portfolioService.savePortfolio(
        mockPortfolio,
        mockUserId,
        mockAccessToken
      );
      
      // Google Driveサービスが正しく呼び出されたか検証
      expect(portfolioService.saveFile).toHaveBeenCalledWith(
        expect.stringContaining(mockPortfolio.name),
        expect.any(String), // JSONシリアライズされたデータ
        'application/json',
        mockAccessToken
      );
      
      // 保存されたJSONデータにユーザーIDが含まれていることを検証
      const savedData = portfolioService.saveFile.mock.calls[0][1];
      expect(savedData).toContain('"createdBy":"user-123"');
      
      // 結果の検証
      expect(result).toEqual({
        id: mockFileId,
        name: mockFileName,
        createdTime: '2025-05-15T10:00:00Z'
      });
    });
    
    test('既存のポートフォリオを更新する（ファイルID指定）', async () => {
      // テスト対象の関数を実行
      const result = await portfolioService.savePortfolio(
        mockPortfolio,
        mockUserId,
        mockAccessToken,
        mockFileId
      );
      
      // Google Driveサービスが正しく呼び出されたか検証
      expect(portfolioService.saveFile).toHaveBeenCalledWith(
        expect.stringContaining(mockPortfolio.name),
        expect.any(String), // JSONシリアライズされたデータ
        'application/json',
        mockAccessToken,
        mockFileId // 既存ファイルID
      );
      
      // 結果の検証
      expect(result).toEqual({
        id: mockFileId,
        name: mockFileName,
        createdTime: '2025-05-15T10:00:00Z'
      });
    });
    
    test('保存時にエラーが発生した場合は例外をスロー', async () => {
      // Google Driveサービスがエラーをスローするようにモック
      portfolioService.saveFile.mockRejectedValue(
        new Error('Failed to save file')
      );
      
      // 例外がスローされることを検証
      await expect(
        portfolioService.savePortfolio(
          mockPortfolio,
          mockUserId,
          mockAccessToken
        )
      ).rejects.toThrow('Failed to save file');
    });
    
    test('ポートフォリオデータを検証して保存する', async () => {
      // 不完全なポートフォリオデータ
      const incompletePortfolio = {
        name: 'Incomplete Portfolio'
        // holdingsがない
      };
      
      // テスト対象の関数を実行
      const result = await portfolioService.savePortfolio(
        incompletePortfolio,
        mockUserId,
        mockAccessToken
      );
      
      // 保存されたJSONデータに必要なフィールドが追加されていることを検証
      const savedData = portfolioService.saveFile.mock.calls[0][1];
      expect(savedData).toContain('"holdings":[]');
      expect(savedData).toContain('"createdBy":"user-123"');
      expect(savedData).toContain('"lastUpdated"');
    });
  });

  describe('getPortfolio', () => {
    test('ファイルIDを指定して正常にポートフォリオを取得する', async () => {
      // テスト対象の関数を実行
      const result = await portfolioService.getPortfolio(mockFileId, mockAccessToken);
      
      // Google Driveサービスが正しく呼び出されたか検証
      expect(portfolioService.getFile).toHaveBeenCalledWith(mockFileId, mockAccessToken);
      
      // 結果の検証
      expect(result).toEqual(mockPortfolio);
    });
    
    test('ファイル取得時にエラーが発生した場合は例外をスロー', async () => {
      // Google Driveサービスがエラーをスローするようにモック
      portfolioService.getFile.mockRejectedValue(
        new Error('File not found')
      );
      
      // 例外がスローされることを検証
      await expect(
        portfolioService.getPortfolio(mockFileId, mockAccessToken)
      ).rejects.toThrow('File not found');
    });
    
    test('無効なJSONデータの場合はエラーを処理する', async () => {
      // 無効なJSONデータを返すようにモック
      portfolioService.getFile.mockResolvedValue('invalid json data');
      
      // 例外がスローされることを検証
      await expect(
        portfolioService.getPortfolio(mockFileId, mockAccessToken)
      ).rejects.toThrow('Invalid portfolio data format');
    });
    
    test('古い形式のポートフォリオデータを変換する', async () => {
      // 古い形式のポートフォリオデータ
      const oldFormatPortfolio = {
        portfolioName: 'Legacy Portfolio', // 古い名前のフィールド
        stocks: [ // 古い名前のフィールド
          { symbol: 'AAPL', quantity: 10, purchasePrice: 150.0 }
        ],
        lastUpdate: '2025-05-01T10:00:00Z', // 古い名前のフィールド
        userId: 'user-123' // 古い名前のフィールド
      };
      
      // 古い形式のデータを返すようにモック
      portfolioService.getFile.mockResolvedValue(
        JSON.stringify(oldFormatPortfolio)
      );
      
      // テスト対象の関数を実行
      const result = await portfolioService.getPortfolio(mockFileId, mockAccessToken);
      
      // 結果の検証（新しい形式に変換されている）
      expect(result).toHaveProperty('name', 'Legacy Portfolio');
      expect(result).toHaveProperty('holdings');
      expect(result.holdings[0]).toHaveProperty('shares', 10);
      expect(result).toHaveProperty('lastUpdated');
      expect(result).toHaveProperty('createdBy', 'user-123');
    });
  });

  describe('listPortfolios', () => {
    test('ユーザーのポートフォリオ一覧を取得する', async () => {
      // テスト対象の関数を実行
      const result = await portfolioService.listPortfolios(mockAccessToken);
      
      // Google Driveサービスが正しく呼び出されたか検証
      expect(portfolioService.listFiles).toHaveBeenCalledWith(
        expect.stringContaining('portfolio'),
        'application/json',
        mockAccessToken
      );
      
      // 結果の検証
      expect(result).toEqual(mockFilesList);
    });
    
    test('リスト取得時にエラーが発生した場合は例外をスロー', async () => {
      // Google Driveサービスがエラーをスローするようにモック
      portfolioService.listFiles.mockRejectedValue(
        new Error('Failed to list files')
      );
      
      // 例外がスローされることを検証
      await expect(
        portfolioService.listPortfolios(mockAccessToken)
      ).rejects.toThrow('Failed to list files');
    });
    
    test('ファイル名のフィルタリングを適用する', async () => {
      // テスト対象の関数を実行（カスタムフィルター指定）
      await portfolioService.listPortfolios(
        mockAccessToken,
        'custom-portfolio'
      );
      
      // フィルター文字列が含まれていることを検証
      expect(portfolioService.listFiles).toHaveBeenCalledWith(
        expect.stringContaining('custom-portfolio'),
        'application/json',
        mockAccessToken
      );
    });
  });

  describe('deletePortfolio', () => {
    test('指定したファイルIDのポートフォリオを削除する', async () => {
      // テスト対象の関数を実行
      const result = await portfolioService.deletePortfolio(mockFileId, mockAccessToken);
      
      // Google Driveサービスが正しく呼び出されたか検証
      expect(portfolioService.deleteFile).toHaveBeenCalledWith(mockFileId, mockAccessToken);
      
      // 結果の検証
      expect(result).toBe(true);
    });
    
    test('削除時にエラーが発生した場合は例外をスロー', async () => {
      // Google Driveサービスがエラーをスローするようにモック
      portfolioService.deleteFile.mockRejectedValue(
        new Error('Failed to delete file')
      );
      
      // 例外がスローされることを検証
      await expect(
        portfolioService.deletePortfolio(mockFileId, mockAccessToken)
      ).rejects.toThrow('Failed to delete file');
    });
  });

  describe('validatePortfolioData', () => {
    test('有効なポートフォリオデータを検証する', () => {
      // テスト対象の関数を実行
      const validatedData = portfolioService.validatePortfolioData(mockPortfolio);
      
      // 結果の検証
      expect(validatedData).toEqual(mockPortfolio);
    });
    
    test('必須フィールドがない場合はデフォルト値を設定する', () => {
      // 最小限のデータ
      const minimalData = {
        name: 'Minimal Portfolio'
      };
      
      // テスト対象の関数を実行
      const validatedData = portfolioService.validatePortfolioData(minimalData);
      
      // 結果の検証
      expect(validatedData).toHaveProperty('name', 'Minimal Portfolio');
      expect(validatedData).toHaveProperty('holdings');
      expect(Array.isArray(validatedData.holdings)).toBe(true);
      expect(validatedData).toHaveProperty('lastUpdated');
    });
    
    test('無効なデータ型の場合は修正する', () => {
      // 無効なデータ型
      const invalidData = {
        name: 'Invalid Portfolio',
        holdings: 'not an array', // 文字列（配列ではない）
        lastUpdated: 123 // 数値（文字列ではない）
      };
      
      // テスト対象の関数を実行
      const validatedData = portfolioService.validatePortfolioData(invalidData);
      
      // 結果の検証
      expect(validatedData.holdings).toEqual([]);
      expect(typeof validatedData.lastUpdated).toBe('string');
    });
    
    test('ポートフォリオ名がない場合はデフォルト名を設定する', () => {
      // 名前のないデータ
      const noNameData = {
        holdings: []
      };
      
      // テスト対象の関数を実行
      const validatedData = portfolioService.validatePortfolioData(noNameData);
      
      // 結果の検証
      expect(validatedData.name).toContain('Portfolio');
    });
    
    test('保有銘柄の必須フィールドを検証する', () => {
      // 不完全な保有銘柄データ
      const incompleteHoldings = {
        name: 'Incomplete Holdings',
        holdings: [
          { symbol: 'AAPL' }, // sharesとcostがない
          { shares: 100 } // symbolがない
        ]
      };
      
      // テスト対象の関数を実行
      const validatedData = portfolioService.validatePortfolioData(incompleteHoldings);
      
      // 結果の検証
      expect(validatedData.holdings[0]).toHaveProperty('symbol', 'AAPL');
      expect(validatedData.holdings[0]).toHaveProperty('shares', 0);
      expect(validatedData.holdings[0]).toHaveProperty('cost', 0);
      
      // symbolがない要素は削除されるか、デフォルト値が設定される
      if (validatedData.holdings.length > 1) {
        expect(validatedData.holdings[1]).toHaveProperty('symbol');
      }
    });
  });
});
