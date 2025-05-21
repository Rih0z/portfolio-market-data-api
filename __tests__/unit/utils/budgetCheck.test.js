/**
 * ファイルパス: __tests__/unit/utils/budgetCheck.test.js
 *
 * budgetCheckユーティリティのユニットテスト
 * 予算警告付与機能の挙動を検証する
 */

const budgetCheck = require('../../../src/utils/budgetCheck');

jest.mock('../../../src/utils/logger');
jest.mock('../../../src/services/cache');

const mockResponse = {
  statusCode: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ success: true })
};

beforeEach(() => {
  jest.restoreAllMocks();
});

describe('addBudgetWarningToResponse', () => {
  test('警告がない場合はレスポンスを変更しない', async () => {
    jest.spyOn(budgetCheck, 'isBudgetCritical').mockResolvedValue(false);
    jest.spyOn(budgetCheck, 'isBudgetWarning').mockResolvedValue(false);

    const result = await budgetCheck.addBudgetWarningToResponse(mockResponse);
    expect(result).toEqual(mockResponse);
  });

  test('警告メッセージをヘッダーとボディに追加する', async () => {
    jest.spyOn(budgetCheck, 'isBudgetCritical').mockResolvedValue(false);
    jest.spyOn(budgetCheck, 'isBudgetWarning').mockResolvedValue(true);
    jest
      .spyOn(budgetCheck, 'getBudgetWarningMessage')
      .mockResolvedValue('WARNING: limit');

    const result = await budgetCheck.addBudgetWarningToResponse(mockResponse);

    expect(result.headers['X-Budget-Warning']).toBe('WARNING: limit');
    const body = JSON.parse(result.body);
    expect(body.budgetWarning).toBe('WARNING: limit');
  });

  test('JSON以外のレスポンスは変更しない', async () => {
    jest.spyOn(budgetCheck, 'isBudgetCritical').mockResolvedValue(true);
    const nonJson = { ...mockResponse, body: '<html></html>' };

    const result = await budgetCheck.addBudgetWarningToResponse(nonJson);
    expect(result).toEqual(nonJson);
  });

  test('内部エラー発生時は元のレスポンスを返す', async () => {
    jest
      .spyOn(budgetCheck, 'isBudgetCritical')
      .mockRejectedValue(new Error('fail'));

    const result = await budgetCheck.addBudgetWarningToResponse(mockResponse);
    expect(result).toEqual(mockResponse);
  });
});
