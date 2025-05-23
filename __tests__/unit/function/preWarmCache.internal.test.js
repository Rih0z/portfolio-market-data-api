const preWarm = require('../../../src/function/preWarmCache');
const enhancedService = require('../../../src/services/sources/enhancedMarketDataService');
const cache = require('../../../src/services/cache');
const alerts = require('../../../src/services/alerts');
const logger = require('../../../src/utils/logger');
const blacklist = require('../../../src/utils/scrapingBlacklist');

jest.mock('../../../src/services/sources/enhancedMarketDataService');
jest.mock('../../../src/services/cache');
jest.mock('../../../src/services/alerts');
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/scrapingBlacklist');

const {
  cleanupExpiredData,
  prewarmUsStocks,
  prewarmJpStocks,
  prewarmMutualFunds,
  prewarmExchangeRates,
  PREWARM_SYMBOLS
} = preWarm._testExports;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('preWarmCache internal functions', () => {
  test('cleanupExpiredData returns counts', async () => {
    cache.cleanup.mockResolvedValue({ count: 3 });
    blacklist.cleanupBlacklist.mockResolvedValue({ count: 2 });
    const result = await cleanupExpiredData();
    expect(cache.cleanup).toHaveBeenCalled();
    expect(blacklist.cleanupBlacklist).toHaveBeenCalled();
    expect(result).toEqual({ cacheItems: 3, blacklistEntries: 2 });
  });

  test('prewarmUsStocks calls service with symbols', async () => {
    enhancedService.getUsStocksData.mockResolvedValue({ ok: true });
    const result = await prewarmUsStocks();
    expect(enhancedService.getUsStocksData).toHaveBeenCalledWith(
      PREWARM_SYMBOLS['us-stock'],
      true
    );
    expect(result).toEqual({ ok: true });
  });

  test('prewarmJpStocks calls service with symbols', async () => {
    enhancedService.getJpStocksData.mockResolvedValue({ ok: true });
    const result = await prewarmJpStocks();
    expect(enhancedService.getJpStocksData).toHaveBeenCalledWith(
      PREWARM_SYMBOLS['jp-stock'],
      true
    );
    expect(result).toEqual({ ok: true });
  });

  test('prewarmMutualFunds calls service with symbols', async () => {
    enhancedService.getMutualFundsData.mockResolvedValue({ ok: true });
    const result = await prewarmMutualFunds();
    expect(enhancedService.getMutualFundsData).toHaveBeenCalledWith(
      PREWARM_SYMBOLS['mutual-fund'],
      true
    );
    expect(result).toEqual({ ok: true });
  });

  test('prewarmExchangeRates loops through symbols', async () => {
    enhancedService.getExchangeRateData.mockResolvedValue({ rate: 1 });
    const result = await prewarmExchangeRates();
    PREWARM_SYMBOLS['exchange-rate'].forEach(pair => {
      const [base, target] = pair.split('-');
      expect(enhancedService.getExchangeRateData).toHaveBeenCalledWith(base, target, true);
      expect(result[pair]).toEqual({ rate: 1 });
    });
  });

  test('prewarmExchangeRates throws on service error', async () => {
    enhancedService.getExchangeRateData.mockRejectedValue(new Error('x'));
    await expect(prewarmExchangeRates()).rejects.toThrow('x');
  });
});
