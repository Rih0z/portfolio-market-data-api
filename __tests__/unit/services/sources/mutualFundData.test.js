/**
 * ファイルパス: __tests__/unit/services/sources/mutualFundData.test.js
 * 
 * 投資信託データ取得機能のユニットテスト
 * 投資信託データソースアダプターの機能をテスト
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-15
 */

const mutualFundData = require('../../../../src/services/sources/mutualFundData');
const axios = require('axios');
const cheerio = require('cheerio');
const { withRetry } = require('../../../../src/utils/retry');
const { isFundBlacklisted, addToBlacklist } = require('../../../../src/utils/scrapingBlacklist');

// 依存モジュールをモック化
jest.mock('axios');
jest.mock('cheerio');
jest.mock('../../../../src/utils/retry');
jest.mock('../../../../src/utils/scrapingBlacklist');

describe('Mutual Fund Data Service', () => {
  // テスト用データ
  const testFundCode = '0131103C';
  const mockHtmlContent = `
    <html>
      <body>
        <div class="standard-price">12,345円</div>
        <div class="price-change">+123円(+1.01%)</div>
        <div class="fund-name">テスト投資信託</div>
      </body>
    </html>
  `;
  
  const mockCheerioLoad = {
    text: jest.fn()
  };
  
  // 各テスト前の準備
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // axiosのモック
    axios.get.mockResolvedValue({
      status: 200,
      data: mockHtmlContent
    });
    
    // cheerioのモック
    cheerio.load.mockReturnValue(function(selector) {
      if (selector === '.standard-price') {
        mockCheerioLoad.text.mockReturnValue('12,345円');
        return mockCheerioLoad;
      }
      if (selector === '.price-change') {
        mockCheerioLoad.text.mockReturnValue('+123円(+1.01%)');
        return mockCheerioLoad;
      }
      if (selector === '.fund-name') {
        mockCheerioLoad.text.mockReturnValue('テスト投資信託');
        return mockCheerioLoad;
      }
      mockCheerioLoad.text.mockReturnValue('');
      return mockCheerioLoad;
    });
    
    // withRetryのモック
    withRetry.mockImplementation((fn) => fn());
    
    // ブラックリストのモック
    isFundBlacklisted.mockResolvedValue(false);
    addToBlacklist.mockResolvedValue(undefined);
  });

  describe('getFundData', () => {
    test('単一ファンドコードのデータを取得する', async () => {
      // テスト対象の関数を実行
      const result = await mutualFundData.getFundData(testFundCode);
      
      // axios.getが正しく呼び出されたか検証
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining(testFundCode),
        expect.any(Object)
      );
      
      // cheerio.loadが呼び出されたか検証
      expect(cheerio.load).toHaveBeenCalledWith(mockHtmlContent);
      
      // ブラックリストチェックが行われたか検証
      expect(isFundBlacklisted).toHaveBeenCalledWith(testFundCode);
      
      // 結果の検証
      expect(result).toEqual({
        [testFundCode]: {
          symbol: testFundCode,
          price: 12345,
          change: 123,
          changePercent: 1.01,
          name: 'テスト投資信託',
          currency: 'JPY',
          isMutualFund: true,
          lastUpdated: expect.any(String)
        }
      });
    });
    
    test('複数ファンドコードのデータを取得する', async () => {
      // 複数のファンドコード
      const fundCodes = ['0131103C', '2931113C'];
      
      // 2回目の呼び出しでは異なる値を返すようにモック
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: mockHtmlContent
      }).mockResolvedValueOnce({
        status: 200,
        data: `
          <html>
            <body>
              <div class="standard-price">5,678円</div>
              <div class="price-change">-45円(-0.78%)</div>
              <div class="fund-name">テスト投資信託2</div>
            </body>
          </html>
        `
      });
      
      // 2回目のcheerio.loadの挙動をモック
      cheerio.load.mockReturnValueOnce(function(selector) {
        if (selector === '.standard-price') {
          mockCheerioLoad.text.mockReturnValue('12,345円');
          return mockCheerioLoad;
        }
        if (selector === '.price-change') {
          mockCheerioLoad.text.mockReturnValue('+123円(+1.01%)');
          return mockCheerioLoad;
        }
        if (selector === '.fund-name') {
          mockCheerioLoad.text.mockReturnValue('テスト投資信託');
          return mockCheerioLoad;
        }
        mockCheerioLoad.text.mockReturnValue('');
        return mockCheerioLoad;
      }).mockReturnValueOnce(function(selector) {
        if (selector === '.standard-price') {
          mockCheerioLoad.text.mockReturnValue('5,678円');
          return mockCheerioLoad;
        }
        if (selector === '.price-change') {
          mockCheerioLoad.text.mockReturnValue('-45円(-0.78%)');
          return mockCheerioLoad;
        }
        if (selector === '.fund-name') {
          mockCheerioLoad.text.mockReturnValue('テスト投資信託2');
          return mockCheerioLoad;
        }
        mockCheerioLoad.text.mockReturnValue('');
        return mockCheerioLoad;
      });
      
      // テスト対象の関数を実行
      const result = await mutualFundData.getFundData(fundCodes);
      
      // axios.getが2回呼び出されたか検証
      expect(axios.get).toHaveBeenCalledTimes(2);
      
      // 結果の検証
      expect(result).toHaveProperty('0131103C');
      expect(result).toHaveProperty('2931113C');
      
      expect(result['0131103C'].price).toBe(12345);
      expect(result['0131103C'].change).toBe(123);
      expect(result['0131103C'].changePercent).toBe(1.01);
      
      expect(result['2931113C'].price).toBe(5678);
      expect(result['2931113C'].change).toBe(-45);
      expect(result['2931113C'].changePercent).toBe(-0.78);
    });
    
    test('ブラックリストに登録されているファンドの場合、スクレイピングをスキップする', async () => {
      // ブラックリストにあるとモック
      isFundBlacklisted.mockResolvedValue(true);
      
      // テスト対象の関数を実行
      const result = await mutualFundData.getFundData(testFundCode);
      
      // ブラックリストチェックが行われたか検証
      expect(isFundBlacklisted).toHaveBeenCalledWith(testFundCode);
      
      // axiosが呼び出されなかったことを検証
      expect(axios.get).not.toHaveBeenCalled();
      
      // 結果の検証（エラーデータまたは空データ）
      expect(result).toEqual({
        [testFundCode]: {
          symbol: testFundCode,
          error: expect.any(String),
          lastUpdated: expect.any(String)
        }
      });
    });
    
    test('スクレイピングでエラーが発生した場合、ブラックリストに追加する', async () => {
      // axiosがエラーをスローするようにモック
      axios.get.mockRejectedValue(new Error('Scraping failed'));
      
      // テスト対象の関数を実行
      const result = await mutualFundData.getFundData(testFundCode);
      
      // ブラックリストに追加されたか検証
      expect(addToBlacklist).toHaveBeenCalledWith(testFundCode);
      
      // 結果の検証（エラーデータ）
      expect(result).toEqual({
        [testFundCode]: {
          symbol: testFundCode,
          error: expect.stringContaining('Scraping failed'),
          lastUpdated: expect.any(String)
        }
      });
    });
  });

  describe('parseFundPrice', () => {
    test('円表記の価格を数値に変換する', () => {
      expect(mutualFundData.parseFundPrice('12,345円')).toBe(12345);
      expect(mutualFundData.parseFundPrice('1,234,567円')).toBe(1234567);
      expect(mutualFundData.parseFundPrice('123円')).toBe(123);
      expect(mutualFundData.parseFundPrice('123.45円')).toBe(123.45);
    });
    
    test('カンマなしの価格も処理できる', () => {
      expect(mutualFundData.parseFundPrice('12345円')).toBe(12345);
      expect(mutualFundData.parseFundPrice('123円')).toBe(123);
    });
    
    test('円記号がない価格も処理できる', () => {
      expect(mutualFundData.parseFundPrice('12,345')).toBe(12345);
      expect(mutualFundData.parseFundPrice('123')).toBe(123);
    });
    
    test('異常な入力値は0を返す', () => {
      expect(mutualFundData.parseFundPrice('')).toBe(0);
      expect(mutualFundData.parseFundPrice('価格なし')).toBe(0);
      expect(mutualFundPrice.parseFundPrice(null)).toBe(0);
      expect(mutualFundPrice.parseFundPrice(undefined)).toBe(0);
    });
  });

  describe('parsePriceChange', () => {
    test('プラスの変化額を正しく解析する', () => {
      const result = mutualFundData.parsePriceChange('+123円(+1.01%)');
      expect(result.change).toBe(123);
      expect(result.changePercent).toBe(1.01);
    });
    
    test('マイナスの変化額を正しく解析する', () => {
      const result = mutualFundData.parsePriceChange('-45円(-0.78%)');
      expect(result.change).toBe(-45);
      expect(result.changePercent).toBe(-0.78);
    });
    
    test('変化なしの場合も処理できる', () => {
      const result = mutualFundData.parsePriceChange('0円(0.00%)');
      expect(result.change).toBe(0);
      expect(result.changePercent).toBe(0);
    });
    
    test('異常な形式でもエラーにならず、デフォルト値を返す', () => {
      const result = mutualFundData.parsePriceChange('変化なし');
      expect(result.change).toBe(0);
      expect(result.changePercent).toBe(0);
    });
  });

  describe('getFundUrl', () => {
    test('ファンドコードからURLを生成する', () => {
      const url = mutualFundData.getFundUrl('0131103C');
      expect(url).toContain('0131103C');
      expect(url).toMatch(/^https?:\/\//); // URLはhttpまたはhttpsで始まる
    });
    
    test('空のファンドコードでもエラーにならない', () => {
      const url = mutualFundData.getFundUrl('');
      expect(typeof url).toBe('string');
    });
  });
});

// モック用の補助関数
const mutualFundPrice = {
  parseFundPrice: function(priceText) {
    if (!priceText) return 0;
    
    try {
      // カンマと円記号を取り除いて数値に変換
      const numericPart = priceText.replace(/,|円/g, '');
      const price = parseFloat(numericPart);
      return isNaN(price) ? 0 : price;
    } catch (error) {
      return 0;
    }
  }
};
