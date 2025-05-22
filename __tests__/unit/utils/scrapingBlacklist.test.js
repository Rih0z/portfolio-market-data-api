/**
 * ファイルパス: __tests__/unit/utils/scrapingBlacklist.test.js
 *
 * スクレイピングブラックリストユーティリティのユニットテスト
 * 銘柄の失敗回数管理とブラックリスト登録機能をテストします
 */

const blacklist = require('../../../src/utils/scrapingBlacklist');
const awsConfig = require('../../../src/utils/awsConfig');
const alertService = require('../../../src/services/alerts');

jest.mock('../../../src/utils/awsConfig');
jest.mock('../../../src/services/alerts');

describe('Scraping Blacklist Utils', () => {
  const mockDynamoDb = {
    get: jest.fn().mockReturnValue({ promise: jest.fn() }),
    put: jest.fn().mockReturnValue({ promise: jest.fn() }),
    update: jest.fn().mockReturnValue({ promise: jest.fn() }),
    delete: jest.fn().mockReturnValue({ promise: jest.fn() }),
    scan: jest.fn().mockReturnValue({ promise: jest.fn() })
  };

  beforeEach(() => {
    jest.clearAllMocks();
    awsConfig.getDynamoDb.mockReturnValue(mockDynamoDb);
  });

  describe('isBlacklisted', () => {
    test('アイテムが存在しない場合はfalseを返す', async () => {
      mockDynamoDb.get.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({})
      });

      const result = await blacklist.isBlacklisted('TEST', 'jp');
      expect(result).toBe(false);
    });

    test('クールダウン期間が過ぎている場合は削除してfalseを返す', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      mockDynamoDb.get.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: { market: 'jp', cooldownUntil: pastDate }
        })
      });
      jest.spyOn(blacklist, 'removeFromBlacklist').mockResolvedValue(true);

      const result = await blacklist.isBlacklisted('TEST', 'jp');
      expect(result).toBe(false);
      expect(blacklist.removeFromBlacklist).toHaveBeenCalledWith('TEST');
    });

    test('クールダウン期間中はtrueを返す', async () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      mockDynamoDb.get.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: { market: 'jp', cooldownUntil: future }
        })
      });

      const result = await blacklist.isBlacklisted('TEST', 'jp');
      expect(result).toBe(true);
    });
  });

  describe('recordFailure', () => {
    test('初回の失敗を記録する', async () => {
      mockDynamoDb.get.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({})
      });
      mockDynamoDb.put.mockReturnValueOnce({ promise: jest.fn().mockResolvedValue({}) });

      const res = await blacklist.recordFailure('AAA', 'jp', 'error');
      expect(res).toEqual({ symbol: 'AAA', failureCount: 1, isBlacklisted: false });
      expect(mockDynamoDb.put).toHaveBeenCalled();
    });

    test('失敗回数が閾値に達した場合アラートを送信する', async () => {
      const now = new Date().toISOString();
      mockDynamoDb.get.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: { symbol: 'BBB', market: 'jp', failureCount: 2, firstFailure: now }
        })
      });
      mockDynamoDb.put.mockReturnValueOnce({ promise: jest.fn().mockResolvedValue({}) });

      const result = await blacklist.recordFailure('BBB', 'jp', 'err');
      expect(result.isBlacklisted).toBe(true);
      expect(alertService.sendAlert).toHaveBeenCalled();
    });
  });

  describe('recordSuccess', () => {
    test('ブラックリスト登録銘柄は削除される', async () => {
      mockDynamoDb.get.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: { failureCount: 3 }
        })
      });
      jest.spyOn(blacklist, 'removeFromBlacklist').mockResolvedValue(true);

      const res = await blacklist.recordSuccess('CCC');
      expect(res).toBe(true);
      expect(blacklist.removeFromBlacklist).toHaveBeenCalledWith('CCC');
    });

    test('失敗カウントが残る場合は更新する', async () => {
      mockDynamoDb.get.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: { failureCount: 2 }
        })
      });
      mockDynamoDb.update.mockReturnValueOnce({ promise: jest.fn().mockResolvedValue({}) });

      const res = await blacklist.recordSuccess('DDD');
      expect(res).toBe(true);
      expect(mockDynamoDb.update).toHaveBeenCalled();
    });

    test('記録がない場合はtrueを返す', async () => {
      mockDynamoDb.get.mockReturnValueOnce({ promise: jest.fn().mockResolvedValue({}) });

      const res = await blacklist.recordSuccess('EEE');
      expect(res).toBe(true);
    });
  });

  describe('getBlacklistedSymbols', () => {
    test('ブラックリスト一覧を返す', async () => {
      const items = [{ symbol: 'FFF' }];
      mockDynamoDb.scan.mockReturnValueOnce({ promise: jest.fn().mockResolvedValue({ Items: items }) });

      const res = await blacklist.getBlacklistedSymbols();
      expect(res).toEqual(items);
      expect(mockDynamoDb.scan).toHaveBeenCalled();
    });

    test('エラー時は空配列を返す', async () => {
      mockDynamoDb.scan.mockReturnValueOnce({ promise: jest.fn().mockRejectedValue(new Error('err')) });

      const res = await blacklist.getBlacklistedSymbols();
      expect(res).toEqual([]);
    });
  });

  describe('cleanupBlacklist', () => {
    test('期限切れアイテムを削除する', async () => {
      const expired = [{ symbol: 'GGG' }, { symbol: 'HHH' }];
      mockDynamoDb.scan.mockReturnValueOnce({ promise: jest.fn().mockResolvedValue({ Items: expired }) });
      mockDynamoDb.delete.mockReturnValue({ promise: jest.fn().mockResolvedValue({}) });

      const res = await blacklist.cleanupBlacklist();
      expect(res).toEqual({ success: true, cleanedItems: expired.length });
      expect(mockDynamoDb.delete).toHaveBeenCalledTimes(expired.length);
    });

    test('エラー時はfalseを返す', async () => {
      mockDynamoDb.scan.mockReturnValueOnce({ promise: jest.fn().mockRejectedValue(new Error('err')) });

      const res = await blacklist.cleanupBlacklist();
      expect(res.success).toBe(false);
    });
  });
});
