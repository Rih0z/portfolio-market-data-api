const marketDataProviders = require('../../../../src/services/sources/marketDataProviders');
const blacklist = require('../../../../src/utils/scrapingBlacklist');
const alertService = require('../../../../src/services/alerts');
const yahooFinanceService = require('../../../../src/services/sources/yahooFinance');
const retryUtils = require('../../../../src/utils/retry');

jest.mock('../../../../src/utils/scrapingBlacklist');
jest.mock('../../../../src/services/alerts');
jest.mock('../../../../src/services/sources/yahooFinance');
jest.mock('../../../../src/utils/retry', () => ({
  withRetry: jest.fn(fn => fn()),
  isRetryableApiError: jest.fn(() => false),
  sleep: jest.fn(() => Promise.resolve())
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getJpStocksParallel', () => {
  test('handles blacklist and returns fetched data', async () => {
    blacklist.isBlacklisted.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    marketDataProviders.getJpStockData = jest.fn().mockResolvedValue({ ticker: '7201', price: 100 });
    const result = await marketDataProviders.getJpStocksParallel(['7203', '7201']);
    expect(blacklist.isBlacklisted).toHaveBeenCalledTimes(2);
    expect(marketDataProviders.getJpStockData).toHaveBeenCalledWith('7201');
    expect(result['7203']).toMatchObject({ ticker: '7203', isBlacklisted: true, source: 'Blacklisted Fallback' });
    expect(result['7201']).toEqual({ ticker: '7201', price: 100 });
  });

  test('sends alert when fetch errors exceed threshold', async () => {
    blacklist.isBlacklisted.mockResolvedValue(false);
    marketDataProviders.getJpStockData = jest.fn().mockRejectedValue(new Error('fail'));
    const result = await marketDataProviders.getJpStocksParallel(['7201']);
    expect(alertService.notifyError).toHaveBeenCalled();
    expect(result['7201']).toMatchObject({ ticker: '7201', source: 'Error', error: 'fail' });
  });
});

describe('getUsStocksParallel', () => {
  test('returns batch results when API succeeds', async () => {
    yahooFinanceService.getStocksData.mockResolvedValue({ AAPL: { price: 1 }, MSFT: { price: 2 } });
    const result = await marketDataProviders.getUsStocksParallel(['AAPL', 'MSFT']);
    expect(yahooFinanceService.getStocksData).toHaveBeenCalledWith(['AAPL', 'MSFT']);
    expect(result).toEqual({ AAPL: { price: 1 }, MSFT: { price: 2 } });
  });

  test('falls back to individual fetch with blacklist handling', async () => {
    yahooFinanceService.getStocksData.mockRejectedValue(new Error('api fail'));
    blacklist.isBlacklisted.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    marketDataProviders.getUsStockData = jest.fn().mockResolvedValue({ ticker: 'AAPL', price: 3 });
    const result = await marketDataProviders.getUsStocksParallel(['AAPL', 'MSFT']);
    expect(marketDataProviders.getUsStockData).toHaveBeenCalledWith('AAPL');
    expect(result['MSFT']).toMatchObject({ ticker: 'MSFT', isBlacklisted: true, source: 'Blacklisted Fallback' });
    expect(result['AAPL']).toEqual({ ticker: 'AAPL', price: 3 });
  });
});
