/**
 * ファイルパス: __tests__/unit/function/admin/getStatus.test.js
 *
 * 管理者向けステータス取得エンドポイントのユニットテスト
 * APIキー認証とレスポンス生成を検証する
 */

jest.mock('../../../../src/services/cache', () => ({
  getStats: jest.fn()
}));

jest.mock('../../../../src/services/usage', () => ({
  getUsageStats: jest.fn()
}));

jest.mock('../../../../src/utils/responseUtils', () => ({
  formatResponse: jest.fn().mockResolvedValue({ statusCode: 200 }),
  formatErrorResponse: jest.fn().mockResolvedValue({ statusCode: 401 })
}));

jest.mock('../../../../src/config/constants', () => ({
  ADMIN: { API_KEY: 'test-key', EMAIL: 'admin@example.com' },
  CACHE_TIMES: { US_STOCK: 3600 }
}));

const cacheService = require('../../../../src/services/cache');
const usageService = require('../../../../src/services/usage');
const responseUtils = require('../../../../src/utils/responseUtils');
const handler = require('../../../../src/function/admin/getStatus').handler;

describe('admin getStatus handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('OPTIONS request returns 204', async () => {
    const event = { httpMethod: 'OPTIONS', headers: {} };
    const res = await handler(event, {});
    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  test('returns 401 when API key is invalid', async () => {
    const event = { httpMethod: 'GET', headers: { 'x-api-key': 'wrong' } };
    await handler(event, {});
    expect(responseUtils.formatErrorResponse).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401 })
    );
  });

  test('returns status info when API key is valid', async () => {
    usageService.getUsageStats.mockResolvedValue({ current: { daily: 5 }, history: [] });
    cacheService.getStats.mockResolvedValue({ hits: 10 });

    const event = { httpMethod: 'GET', headers: { 'x-api-key': 'test-key' } };
    const res = await handler(event, {});

    expect(usageService.getUsageStats).toHaveBeenCalled();
    expect(cacheService.getStats).toHaveBeenCalled();
    expect(responseUtils.formatResponse).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });
});
