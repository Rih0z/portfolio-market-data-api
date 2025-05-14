/**
 * ファイルパス: __tests__/unit/utils/budgetCheck.test.js
 * 
 * AWS予算チェック機能のユニットテスト
 * 予算使用率の取得と警告メッセージのレスポンスへの追加機能をテスト
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-13
 */

const { getBudgetWarningMessage, addBudgetWarningToResponse, isBudgetCritical } = require('../../../src/utils/budgetCheck');
const { getAwsBudget } = require('../../../src/utils/awsClient');

// モジュールのモック化
jest.mock('../../../src/utils/awsClient');

describe('Budget Check Utils', () => {
  // 元の環境変数を保存
  const originalEnv = process.env;
  
  // 各テスト前の準備
  beforeEach(() => {
    jest.clearAllMocks();
    
    // テスト用の環境変数を設定
    process.env = {
      ...originalEnv,
      BUDGET_WARNING_THRESHOLD: '80',
      BUDGET_CRITICAL_THRESHOLD: '95',
      NODE_ENV: 'production'
    };
    
    // デフォルトのモック設定
    getAwsBudget.mockResolvedValue({
      budgetLimit: 25,
      currentUsage: 15,
      usagePercentage: 60
    });
  });
  
  // 各テスト後のクリーンアップ
  afterAll(() => {
    process.env = originalEnv;
  });
  
  describe('getBudgetWarningMessage', () => {
    test('予算使用率が警告閾値未満の場合はnullを返す', async () => {
      // 60%の使用率をモック
      getAwsBudget.mockResolvedValue({
        budgetLimit: 25,
        currentUsage: 15,
        usagePercentage: 60
      });
      
      const message = await getBudgetWarningMessage();
      expect(message).toBeNull();
    });
    
    test('予算使用率が警告閾値以上の場合は警告メッセージを返す', async () => {
      // 85%の使用率をモック
      getAwsBudget.mockResolvedValue({
        budgetLimit: 25,
        currentUsage: 21.25,
        usagePercentage: 85
      });
      
      const message = await getBudgetWarningMessage();
      expect(message).not.toBeNull();
      expect(message).toContain('予算の85%が使用されています');
    });
    
    test('予算使用率が危険閾値以上の場合は危険メッセージを返す', async () => {
      // 96%の使用率をモック
      getAwsBudget.mockResolvedValue({
        budgetLimit: 25,
        currentUsage: 24,
        usagePercentage: 96
      });
      
      const message = await getBudgetWarningMessage();
      expect(message).not.toBeNull();
      expect(message).toContain('緊急');
      expect(message).toContain('96%が使用されています');
    });
    
    test('予算情報の取得に失敗した場合はnullを返す', async () => {
      // 予算取得エラーをモック
      getAwsBudget.mockRejectedValue(new Error('Failed to retrieve budget'));
      
      const message = await getBudgetWarningMessage();
      expect(message).toBeNull();
    });
    
    test('非本番環境では予算チェックをスキップしてnullを返す', async () => {
      // 開発環境に設定
      process.env.NODE_ENV = 'development';
      
      const message = await getBudgetWarningMessage();
      expect(message).toBeNull();
      expect(getAwsBudget).not.toHaveBeenCalled();
    });
  });
  
  describe('addBudgetWarningToResponse', () => {
    test('予算使用率が警告閾値未満の場合は元のレスポンスをそのまま返す', async () => {
      // 60%の使用率をモック
      getAwsBudget.mockResolvedValue({
        budgetLimit: 25,
        currentUsage: 15,
        usagePercentage: 60
      });
      
      const response = {
        statusCode: 200,
        body: JSON.stringify({ success: true, data: { test: 'data' } })
      };
      
      const modifiedResponse = await addBudgetWarningToResponse(response);
      
      expect(modifiedResponse).toEqual(response);
      expect(JSON.parse(modifiedResponse.body)).not.toHaveProperty('budgetWarning');
    });
    
    test('予算使用率が警告閾値以上の場合はレスポンスに警告を追加する', async () => {
      // 85%の使用率をモック
      getAwsBudget.mockResolvedValue({
        budgetLimit: 25,
        currentUsage: 21.25,
        usagePercentage: 85
      });
      
      const response = {
        statusCode: 200,
        body: JSON.stringify({ success: true, data: { test: 'data' } })
      };
      
      const modifiedResponse = await addBudgetWarningToResponse(response);
      
      expect(modifiedResponse.statusCode).toBe(200);
      const body = JSON.parse(modifiedResponse.body);
      expect(body.budgetWarning).toBeDefined();
      expect(body.budgetWarning).toContain('85%');
    });
    
    test('レスポンスボディがない場合は修正なしで返す', async () => {
      // 85%の使用率をモック
      getAwsBudget.mockResolvedValue({
        budgetLimit: 25,
        currentUsage: 21.25,
        usagePercentage: 85
      });
      
      const response = {
        statusCode: 200
      };
      
      const modifiedResponse = await addBudgetWarningToResponse(response);
      expect(modifiedResponse).toEqual(response);
    });
    
    test('レスポンスボディがJSON形式でない場合は修正なしで返す', async () => {
      // 85%の使用率をモック
      getAwsBudget.mockResolvedValue({
        budgetLimit: 25,
        currentUsage: 21.25,
        usagePercentage: 85
      });
      
      const response = {
        statusCode: 200,
        body: 'Not a JSON string'
      };
      
      const modifiedResponse = await addBudgetWarningToResponse(response);
      expect(modifiedResponse).toEqual(response);
    });
  });
  
  describe('isBudgetCritical', () => {
    test('予算使用率が危険閾値未満の場合はfalseを返す', async () => {
      // 60%の使用率をモック
      getAwsBudget.mockResolvedValue({
        budgetLimit: 25,
        currentUsage: 15,
        usagePercentage: 60
      });
      
      const result = await isBudgetCritical();
      expect(result).toBe(false);
    });
    
    test('予算使用率が危険閾値以上の場合はtrueを返す', async () => {
      // 96%の使用率をモック
      getAwsBudget.mockResolvedValue({
        budgetLimit: 25,
        currentUsage: 24,
        usagePercentage: 96
      });
      
      const result = await isBudgetCritical();
      expect(result).toBe(true);
    });
    
    test('予算情報の取得に失敗した場合はfalseを返す', async () => {
      // 予算取得エラーをモック
      getAwsBudget.mockRejectedValue(new Error('Failed to retrieve budget'));
      
      const result = await isBudgetCritical();
      expect(result).toBe(false);
    });
    
    test('非本番環境では予算チェックをスキップしてfalseを返す', async () => {
      // 開発環境に設定
      process.env.NODE_ENV = 'development';
      
      const result = await isBudgetCritical();
      expect(result).toBe(false);
      expect(getAwsBudget).not.toHaveBeenCalled();
    });
  });
});
