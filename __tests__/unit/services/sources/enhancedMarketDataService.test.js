/**
 * ファイルパス: __tests__/unit/services/sources/enhancedMarketDataService.test.js
 *
 * enhancedMarketDataService モジュールのユニットテスト
 * fetchDataWithFallback ラッパーとしての動作と
 * getUsStocksData の分岐処理を検証します。
 */

const service = require('../../../../src/services/sources/enhancedMarketDataService');
const { DATA_TYPES, BATCH_SIZES } = require('../../../../src/config/constants');
const dataFetchWithFallback = require('../../../../src/utils/dataFetchWithFallback');
const yahooFinanceService = require('../../../../src/services/sources/yahooFinance');
const scrapingService = require('../../../../src/services/sources/marketDataProviders');

jest.mock('../../../../src/utils/dataFetchWithFallback');
jest.mock('../../../../src/services/sources/yahooFinance');
jest.mock('../../../../src/services/sources/marketDataProviders');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('enhancedMarketDataService', () => {
  describe('getUsStockData', () => {
    test('fetches data via fetchDataWithFallback', async () => {
      dataFetchWithFallback.fetchDataWithFallback.mockResolvedValue({ price: 123 });

      const result = await service.getUsStockData('AAPL', true);

      expect(dataFetchWithFallback.fetchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'AAPL',
          dataType: DATA_TYPES.US_STOCK,
          refresh: true
        })
      );
      expect(result).toEqual({ price: 123 });
    });
  });

  describe('getUsStocksData', () => {
    test('returns batch result when all symbols are retrieved', async () => {
      const batchResult = { AAPL: { price: 1 }, MSFT: { price: 2 } };
      yahooFinanceService.getStocksData.mockResolvedValue(batchResult);

      const result = await service.getUsStocksData(['AAPL', 'MSFT']);

      expect(yahooFinanceService.getStocksData).toHaveBeenCalledWith(['AAPL', 'MSFT']);
      expect(dataFetchWithFallback.fetchBatchDataWithFallback).not.toHaveBeenCalled();
      expect(result).toEqual(batchResult);
    });

    test('fetches missing symbols individually', async () => {
      yahooFinanceService.getStocksData.mockResolvedValue({ AAPL: { price: 1 } });
      dataFetchWithFallback.fetchBatchDataWithFallback.mockResolvedValue({ MSFT: { price: 2 } });

      const result = await service.getUsStocksData(['AAPL', 'MSFT'], true);

      expect(dataFetchWithFallback.fetchBatchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          symbols: ['MSFT'],
          dataType: DATA_TYPES.US_STOCK,
          refresh: true,
          batchSize: BATCH_SIZES.US_STOCK
        })
      );
      expect(result).toEqual({ AAPL: { price: 1 }, MSFT: { price: 2 } });
    });

    test('falls back to individual fetching when API fails', async () => {
      yahooFinanceService.getStocksData.mockRejectedValue(new Error('api error'));
      dataFetchWithFallback.fetchBatchDataWithFallback.mockResolvedValue({
        AAPL: { price: 1 },
        MSFT: { price: 2 }
      });

      const result = await service.getUsStocksData(['AAPL', 'MSFT']);

      expect(dataFetchWithFallback.fetchBatchDataWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          symbols: ['AAPL', 'MSFT'],
          dataType: DATA_TYPES.US_STOCK,
          batchSize: BATCH_SIZES.US_STOCK
        })
      );
      expect(result).toEqual({ AAPL: { price: 1 }, MSFT: { price: 2 } });
    });
  });
});
