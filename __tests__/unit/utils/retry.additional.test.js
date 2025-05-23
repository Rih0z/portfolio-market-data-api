/**
 * ファイルパス: __tests__/unit/utils/retry.additional.test.js
 *
 * retryユーティリティの追加テスト
 */

const { withRetry, isRetryableApiError } = require('../../../src/utils/retry');

describe('retry utilities additional cases', () => {
  describe('isRetryableApiError extra cases', () => {
    test('returns true when message includes Network Error', () => {
      const err = new Error('Network Error occurred');
      expect(isRetryableApiError(err)).toBe(true);
    });

    test('returns false for undefined error', () => {
      expect(isRetryableApiError(undefined)).toBe(false);
    });
  });

  describe('withRetry with onRetry callback', () => {
    const realRandom = Math.random;

    beforeEach(() => {
      jest.useFakeTimers();
      // 固定値を返して遅延時間を予測可能にする
      Math.random = () => 0;
    });

    afterEach(() => {
      jest.useRealTimers();
      Math.random = realRandom;
    });

    test('calls onRetry and resolves on second attempt', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('ok');
      const onRetry = jest.fn();

      const promise = withRetry(fn, {
        maxRetries: 1,
        baseDelay: 50,
        onRetry
      });

      // 1回目のリトライ待ち時間を進める
      jest.advanceTimersByTime(50);
      const result = await promise;

      expect(result).toBe('ok');
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry.mock.calls[0][1]).toBe(0); // attempt 0
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test('throws immediately when maxRetries is 0', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      const promise = withRetry(fn, { maxRetries: 0, baseDelay: 10 });
      await expect(async () => {
        jest.advanceTimersByTime(10);
        await promise;
      }).rejects.toThrow('fail');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
