/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/services/sources/scraping.js
 * 
 * 説明: 
 * 様々な金融サイトからデータをスクレイピングするサービス。
 * 日本株、米国株、投資信託の価格データを複数のソースから
 * スクレイピングし、統一された形式で提供します。
 */
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * ランダムなユーザーエージェントを取得する
 * @returns {string} ユーザーエージェント
 */
const getRandomUserAgent = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1'
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

/**
 * 日本株のデータをスクレイピングする
 * @param {string} code - 証券コード（4桁）
 * @returns {Promise<Object>} 株価データ
 */
const scrapeJpStock = async (code) => {
  // 4桁のコードに正規化
  const stockCode = code.replace(/\.T$/, '');
  console.log(`Scraping Japanese stock data for ${stockCode}`);
  
  // 複数のソースからデータ取得を試みる
  try {
    // ソース1: Yahoo Finance Japan
    try {
      console.log(`Trying Yahoo Finance Japan for ${stockCode}`);
      const yahooData = await scrapeYahooFinanceJapan(stockCode);
      
      if (yahooData && yahooData.price) {
        console.log(`Successfully fetched stock data from Yahoo Finance Japan for ${stockCode}`);
        return {
          ticker: stockCode,
          ...yahooData,
          source: 'Yahoo Finance Japan',
          isStock: true,
          isMutualFund: false
        };
      }
    } catch (yahooError) {
      console.error(`Yahoo Finance Japan scraping failed for ${stockCode}:`, yahooError.message);
    }

    // ソース2: Minkabu
    try {
      console.log(`Trying Minkabu for ${stockCode}`);
      const minkabuData = await scrapeMinkabu(stockCode);
      
      if (minkabuData && minkabuData.price) {
        console.log(`Successfully fetched stock data from Minkabu for ${stockCode}`);
        return {
          ticker: stockCode,
          ...minkabuData,
          source: 'Minkabu',
          isStock: true,
          isMutualFund: false
        };
      }
    } catch (minkabuError) {
      console.error(`Minkabu scraping failed for ${stockCode}:`, minkabuError.message);
    }

    // ソース3: Kabutan
    try {
      console.log(`Trying Kabutan for ${stockCode}`);
      const kabutanData = await scrapeKabutan(stockCode);
      
      if (kabutanData && kabutanData.price) {
        console.log(`Successfully fetched stock data from Kabutan for ${stockCode}`);
        return {
          ticker: stockCode,
          ...kabutanData,
          source: 'Kabutan',
          isStock: true,
          isMutualFund: false
        };
      }
    } catch (kabutanError) {
      console.error(`Kabutan scraping failed for ${stockCode}:`, kabutanError.message);
    }

    // すべてのソースが失敗した場合はフォールバックデータを返す
    console.log(`All sources failed, using fallback data for ${stockCode}`);
    
    return {
      ticker: stockCode,
      price: 2500, // フォールバック価格
      name: `日本株 ${stockCode}`,
      currency: 'JPY',
      lastUpdated: new Date().toISOString(),
      source: 'Fallback',
      isStock: true,
      isMutualFund: false
    };
  } catch (error) {
    console.error(`Stock scraping error for ${stockCode}:`, error);
    throw error;
  }
};

/**
 * 米国株・ETFのデータをスクレイピングする
 * @param {string} symbol - ティッカーシンボル
 * @returns {Promise<Object>} 株価データ
 */
const scrapeUsStock = async (symbol) => {
  console.log(`Scraping US stock data for ${symbol}`);
  
  try {
    // ソース1: Yahoo Finance
    try {
      console.log(`Trying Yahoo Finance for ${symbol}`);
      const yahooData = await scrapeYahooFinance(symbol);
      
      if (yahooData && yahooData.price) {
        console.log(`Successfully fetched stock data from Yahoo Finance for ${symbol}`);
        return {
          ticker: symbol,
          ...yahooData,
          source: 'Yahoo Finance',
          isStock: true,
          isMutualFund: false
        };
      }
    } catch (yahooError) {
      console.error(`Yahoo Finance scraping failed for ${symbol}:`, yahooError.message);
    }

    // ソース2: MarketWatch
    try {
      console.log(`Trying MarketWatch for ${symbol}`);
      const marketWatchData = await scrapeMarketWatch(symbol);
      
      if (marketWatchData && marketWatchData.price) {
        console.log(`Successfully fetched stock data from MarketWatch for ${symbol}`);
        return {
          ticker: symbol,
          ...marketWatchData,
          source: 'MarketWatch',
          isStock: true,
          isMutualFund: false
        };
      }
    } catch (marketWatchError) {
      console.error(`MarketWatch scraping failed for ${symbol}:`, marketWatchError.message);
    }

    // すべてのソースが失敗した場合はフォールバックデータを返す
    console.log(`All sources failed, using fallback data for ${symbol}`);
    
    return {
      ticker: symbol,
      price: 100, // フォールバック価格
      name: symbol,
      currency: 'USD',
      lastUpdated: new Date().toISOString(),
      source: 'Fallback',
      isStock: true,
      isMutualFund: false
    };
  } catch (error) {
    console.error(`US stock scraping error for ${symbol}:`, error);
    throw error;
  }
};

/**
 * 投資信託のデータをスクレイピングする
 * @param {string} code - ファンドコード（7-8桁）
 * @returns {Promise<Object>} 投資信託データ
 */
const scrapeMutualFund = async (code) => {
  // 投資信託コードの正規化（末尾のCとTを取り除く）
  let fundCode = code.replace(/\.T$/i, '').replace(/C$/i, '');
  console.log(`Scraping mutual fund data for ${fundCode}`);

  try {
    // ソース1: Yahoo Finance Japan
    try {
      console.log(`Trying Yahoo Finance Japan for ${fundCode}`);
      // Yahoo Finance形式の投資信託コード（数字+C.T）
      const yahooFundCode = `${fundCode}C.T`;
      console.log(`Yahoo Finance fund code format: ${yahooFundCode}`);
      
      const yahooData = await scrapeYahooFinanceFund(yahooFundCode);
      
      if (yahooData && yahooData.price) {
        console.log(`Successfully fetched fund data from Yahoo Finance Japan for ${fundCode}: ${yahooData.price}`);
        return {
          ticker: `${fundCode}C`,
          ...yahooData,
          source: 'Yahoo Finance Japan',
          isStock: false,
          isMutualFund: true
        };
      }
    } catch (yahooError) {
      console.error(`Yahoo Finance Japan scraping failed for ${fundCode}:`, yahooError.message);
    }

    // ソース2: 投資信託協会のウェブサイトをスクレイピング
    try {
      console.log(`Trying 投資信託協会 for ${fundCode}`);
      const toushinData = await scrapeToushinLib(fundCode);
      
      if (toushinData && toushinData.price) {
        console.log(`Successfully fetched fund data from 投資信託協会 for ${fundCode}: ${toushinData.price}`);
        return {
          ticker: `${fundCode}C`,
          ...toushinData,
          source: '投資信託協会',
          isStock: false,
          isMutualFund: true
        };
      }
    } catch (toushinError) {
      console.error(`投資信託協会 scraping failed for ${fundCode}:`, toushinError.message);
    }

    // すべてのソースが失敗した場合はフォールバックデータを返す
    console.log(`All sources failed, using fallback data for ${fundCode}`);
    
    return {
      ticker: `${fundCode}C`,
      price: 10000, // フォールバック基準価額
      name: `投資信託 ${fundCode}C`,
      currency: 'JPY',
      lastUpdated: new Date().toISOString(),
      source: 'Fallback',
      isStock: false,
      isMutualFund: true,
      priceLabel: '基準価額'
    };
  } catch (error) {
    console.error(`Mutual fund scraping error for ${fundCode}:`, error);
    throw error;
  }
};

/**
 * Yahoo Finance Japanから株価データをスクレイピングする
 * @param {string} code - 証券コード
 * @returns {Promise<Object>} - 株価データ
 */
async function scrapeYahooFinanceJapan(code) {
  const userAgent = getRandomUserAgent();
  
  const response = await axios.get(`https://finance.yahoo.co.jp/quote/${code}.T`, {
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Referer': 'https://finance.yahoo.co.jp/'
    },
    timeout: 10000
  });
  
  const $ = cheerio.load(response.data);
  
  // 株価の取得
  const priceText = $('._3rXWJKZF').first().text().trim();
  const price = parseFloat(priceText.replace(/[^0-9\.]/g, ''));
  
  // 銘柄名の取得
  const stockName = $('._3s5O0sub').first().text().trim();
  
  // 最終更新日時の取得（現在時刻を使用）
  const lastUpdated = new Date().toISOString();
  
  if (!price || isNaN(price)) {
    throw new Error('株価の取得に失敗しました');
  }
  
  return {
    price,
    name: stockName || `${code}`,
    currency: 'JPY',
    lastUpdated
  };
}

/**
 * Minkabuから株価データをスクレイピングする
 * @param {string} code - 証券コード
 * @returns {Promise<Object>} - 株価データ
 */
async function scrapeMinkabu(code) {
  const userAgent = getRandomUserAgent();
  
  const response = await axios.get(`https://minkabu.jp/stock/${code}`, {
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
    },
    timeout: 10000
  });
  
  const $ = cheerio.load(response.data);
  
  // 株価の取得
  const priceText = $('.stock_price').first().text().trim();
  const price = parseFloat(priceText.replace(/[^0-9\.]/g, ''));
  
  // 銘柄名の取得
  const stockName = $('.md_card_title').first().text().trim();
  
  // 最終更新日時の取得（現在時刻を使用）
  const lastUpdated = new Date().toISOString();
  
  if (!price || isNaN(price)) {
    throw new Error('株価の取得に失敗しました');
  }
  
  return {
    price,
    name: stockName || `${code}`,
    currency: 'JPY',
    lastUpdated
  };
}

/**
 * Kabutanから株価データをスクレイピングする
 * @param {string} code - 証券コード
 * @returns {Promise<Object>} - 株価データ
 */
async function scrapeKabutan(code) {
  const userAgent = getRandomUserAgent();
  
  const response = await axios.get(`https://kabutan.jp/stock/?code=${code}`, {
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
    },
    timeout: 10000
  });
  
  const $ = cheerio.load(response.data);
  
  // 株価の取得
  const priceText = $('.kabuka').first().text().trim();
  const price = parseFloat(priceText.replace(/[^0-9\.]/g, ''));
  
  // 銘柄名の取得
  const stockName = $('.company_block h3').text().trim();
  
  // 最終更新日時の取得（現在時刻を使用）
  const lastUpdated = new Date().toISOString();
  
  if (!price || isNaN(price)) {
    throw new Error('株価の取得に失敗しました');
  }
  
  return {
    price,
    name: stockName || `${code}`,
    currency: 'JPY',
    lastUpdated
  };
}

/**
 * Yahoo Financeから株価データをスクレイピングする
 * @param {string} symbol - ティッカーシンボル
 * @returns {Promise<Object>} - 株価データ
 */
async function scrapeYahooFinance(symbol) {
  try {
    console.log(`Attempting to scrape Yahoo Finance for ${symbol}...`);
    
    const url = `https://finance.yahoo.com/quote/${symbol}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // 価格要素を取得
    const priceElement = $('[data-test="qsp-price"]');
    if (!priceElement.length) {
      throw new Error('Price element not found');
    }
    
    // 価格を数値に変換
    const priceText = priceElement.text().trim().replace(/,/g, '');
    const price = parseFloat(priceText);
    
    if (isNaN(price)) {
      throw new Error(`Invalid price format: ${priceText}`);
    }
    
    // 名前要素を取得
    const nameElement = $('h1');
    const name = nameElement.length ? nameElement.text().trim() : symbol;
    
    return {
      price: price,
      name: name,
      currency: 'USD',
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Yahoo Finance scraping error for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * MarketWatchから株価データをスクレイピングする
 * @param {string} symbol - ティッカーシンボル
 * @returns {Promise<Object>} - 株価データ
 */
async function scrapeMarketWatch(symbol) {
  try {
    console.log(`Attempting to scrape MarketWatch for ${symbol}...`);
    
    const isEtf = symbol.length <= 4 && /^[A-Z]+$/.test(symbol);
    const url = isEtf 
      ? `https://www.marketwatch.com/investing/fund/${symbol}` 
      : `https://www.marketwatch.com/investing/stock/${symbol}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // 価格要素を取得
    const priceElement = $('.intraday__price .value');
    if (!priceElement.length) {
      throw new Error('Price element not found');
    }
    
    // 価格を数値に変換
    const priceText = priceElement.text().trim().replace(/,/g, '');
    const price = parseFloat(priceText);
    
    if (isNaN(price)) {
      throw new Error(`Invalid price format: ${priceText}`);
    }
    
    // 名前要素を取得
    const nameElement = $('h1.company__name');
    const name = nameElement.length ? nameElement.text().trim() : symbol;
    
    return {
      price: price,
      name: name,
      currency: 'USD',
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`MarketWatch scraping error for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Yahoo Finance Japanの投資信託ページから基準価額をスクレイピングする
 * @param {string} code - ファンドコード（末尾にCとTが付いたフォーマット）
 * @returns {Promise<Object>} - 基準価額データ
 */
async function scrapeYahooFinanceFund(code) {
  // ランダムなユーザーエージェントを選択
  const userAgent = getRandomUserAgent();
  
  try {
    // Cと.Tがない場合は追加
    if (!code.toUpperCase().includes('C')) {
      code = `${code}C`;
    }
    if (!code.toUpperCase().includes('.T')) {
      code = `${code}.T`;
    }
    
    console.log(`Fetching from Yahoo Finance Japan with code: ${code}`);
    const url = `https://finance.yahoo.co.jp/quote/${code}`;
    console.log(`URL: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        'Referer': 'https://finance.yahoo.co.jp/fund/'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // 基準価額の取得 - Yahoo Financeの構造に合わせたセレクタ
    // 多様なセレクタを試す
    let priceElement = $('._3rXWJKZF, ._3s5O5DJ7, .price, ._19_vlyV_').first();
    let priceText = priceElement.text().trim();
    
    if (!priceText) {
      // フォールバックとして数値を含む要素を探す
      $('span').each((i, el) => {
        const text = $(el).text().trim();
        if (/[\d,]+\.\d+/.test(text) || /[\d,]+円/.test(text)) {
          priceText = text;
          return false; // eachループを抜ける
        }
      });
    }
    
    console.log(`Found price text: "${priceText}"`);
    const price = parseFloat(priceText.replace(/[^0-9\.]/g, ''));
    
    // ファンド名の取得
    let fundNameElement = $('._3s5O0sub, .name, h1, h2, ._1fYqGSYw').first();
    let fundName = fundNameElement.text().trim();
    
    if (!fundName) {
      // ヘッダーまたはタイトル要素を探す
      fundName = $('h1, h2, .title, header').first().text().trim();
    }
    
    console.log(`Found fund name: "${fundName}"`);
    
    // 最終更新日時の取得（現在時刻を使用）
    const lastUpdated = new Date().toISOString();
    
    if (!price || isNaN(price)) {
      console.error('Failed to extract price from Yahoo Finance Japan');
      return null;
    }
    
    return {
      price,
      name: fundName || `投資信託 ${code}`,
      currency: 'JPY',
      lastUpdated,
      priceLabel: '基準価額'
    };
  } catch (error) {
    console.error(`Error in scrapeYahooFinanceFund for ${code}:`, error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
    return null;
  }
}

/**
 * 投資信託協会のウェブサイトから基準価額をスクレイピングする
 * @param {string} code - ファンドコード
 * @returns {Promise<Object>} - 基準価額データ
 */
async function scrapeToushinLib(code) {
  // ランダムなユーザーエージェントを選択
  const userAgent = getRandomUserAgent();
  
  try {
    console.log(`Fetching from 投資信託協会 with code: ${code}`);
    const url = `https://toushin-lib.fwg.ne.jp/FdsWeb/FDST030000/fundDetailSearch?isinCd=${code}C`;
    console.log(`URL: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
        'Referer': 'https://toushin-lib.fwg.ne.jp/FdsWeb/FDST000000/fundSearch'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    
    // 基準価額の取得
    // 多様なセレクタを試行して基準価額を探す
    let priceElement = $('.fund-price, .base-price, td:contains("基準価額") + td, .price-value, .basePrice').first();
    let priceText = priceElement.text().trim();
    
    if (!priceText) {
      // テーブル構造を探す
      $('table tr').each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const label = $(cells[0]).text().trim();
          if (label.includes('基準価額')) {
            priceText = $(cells[1]).text().trim();
            return false; // eachループを抜ける
          }
        }
      });
    }
    
    console.log(`Found price text: "${priceText}"`);
    const price = parseFloat(priceText.replace(/[^0-9\.]/g, ''));
    
    // ファンド名の取得
    // 多様なセレクタを試行してファンド名を探す
    let fundNameElement = $('.fund-name, .fund-title, h1, h2, .title, .fundName').first();
    let fundName = fundNameElement.text().trim();
    
    if (!fundName) {
      // ヘッダーやタイトルを探す
      fundName = $('h1, h2, .header, .title').first().text().trim();
    }
    
    console.log(`Found fund name: "${fundName}"`);
    
    // 更新日の取得
    let updateDateText = $('.update-date, .date, td:contains("基準日") + td, .baseDate').first().text().trim();
    let lastUpdated;
    
    console.log(`Found update date text: "${updateDateText}"`);
    
    try {
      // 日付形式を解析 (YYYY年MM月DD日 or YYYY/MM/DD)
      const dateParts = updateDateText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/) || updateDateText.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
      if (dateParts) {
        lastUpdated = new Date(dateParts[1], dateParts[2] - 1, dateParts[3]).toISOString();
      } else {
        lastUpdated = new Date().toISOString();
      }
    } catch (e) {
      console.error('Date parsing error:', e);
      lastUpdated = new Date().toISOString();
    }
    
    if (!price || isNaN(price)) {
      console.error('Failed to extract price from 投資信託協会');
      return null;
    }
    
    return {
      price,
      name: fundName || `投資信託 ${code}C`,
      currency: 'JPY',
      lastUpdated,
      priceLabel: '基準価額'
    };
  } catch (error) {
    console.error(`Error in scrapeToushinLib for ${code}:`, error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
    return null;
  }
}

module.exports = {
  scrapeJpStock,
  scrapeUsStock,
  scrapeMutualFund
};
