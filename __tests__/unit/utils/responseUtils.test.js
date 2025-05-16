/**
 * responseUtils.js のユニットテスト
 * 
 * @file __tests__/unit/utils/responseUtils.test.js
 * @author Portfolio Manager Team
 * @created 2025-05-18
 * @updated 2025-05-12 バグ修正: 非同期関数の処理を修正
 * @updated 2025-05-14 修正: テスト対応強化、期待値の調整
 * @updated 2025-05-25 修正: 関数名をmethodHandlerに修正してコードベースと統一
 */

// handleOptionsをmethodHandlerに変更
const { formatResponse, formatErrorResponse, formatRedirectResponse, formatOptionsResponse, methodHandler } = require('../../../src/utils/responseUtils');
const { getBudgetWarningMessage, addBudgetWarningToResponse } = require('../../../src/utils/budgetCheck');

// budgetCheck モジュールをモック化
jest.mock('../../../src/utils/budgetCheck', () => ({
  getBudgetWarningMessage: jest.fn(),
  addBudgetWarningToResponse: jest.fn(async response => response), // 非同期関数に修正
  isBudgetCritical: jest.fn().mockResolvedValue(false)
}));

describe('responseUtils', () => {
  // 省略...

  // テスト名も変更
  describe('methodHandler', () => {
    test('OPTIONSメソッドの処理', () => {
      // テスト実行 - methodHandlerに変更
      const response = methodHandler({
        httpMethod: 'OPTIONS'
      });

      // 検証
      expect(response).not.toBeNull();
      expect(response.statusCode).toBe(204);
    });

    test('OPTIONSメソッド以外の処理', () => {
      // テスト実行 - methodHandlerに変更
      const response = methodHandler({
        httpMethod: 'GET'
      });

      // 検証
      expect(response).toBeNull();
    });
  });
});
