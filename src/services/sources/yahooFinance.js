/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/services/sources/yahooFinance.js
 * 
 * 説明: 
 * Yahoo Finance APIを使用して株価データを取得するサービス。
 * 米国株、日本株、ETFなど様々な金融商品の価格データを取得し、
 * ETF用の特別処理も含まれています。
 */
const axios = require('axios');

// ETF関連の定義
const ETF_PREFIXES = [
  'SPY', 'VOO', 'VTI', 'QQQ', 'IVV', 'DIA', 'ARKK', 'ARKW', 'ARKG',
  'LQD', 'BND', 'AGG', 'TLT', 'IEF', 'GOVT', 'HYG',
  'INDA', 'EWZ', 'EWJ', 'VEA', 'VWO', 'IEFA', 'IEMG',
  'GLD', 'SLV', 'USO', 'XLE', 'XLF', 'XLK', 'XLV', 'XLI', 'XLP',
  'V', 'VO', 'VB', 'VT', 'VGT', 'VHT', 'VDC', 'VFH', 'VIS', 'VCR'
];

/**
 * ティッカーシンボルがETFかどうかを判定する
 * @param {string} symbol - ティッカーシンボル
 * @returns {boolean} ETFの場合はtrue
 */
const isETF = (symbol) => {
  if (!symbol) return false;
  
  // 大文字に変換
  const upperSymbol = symbol.toString().toUpperCase();
  
  // 既知のETFリストにあるか確認
  for (const prefix of ETF_PREFIXES) {
    if (upperSymbol === prefix || upperSymbol.startsWith(prefix)) {
      return true;
    }
  }
  
  // 構造による判定
  // ETFはほとんどが3-4文字で構成される
  if (upperSymbol.length <= 4 && 
      /^[A-Z]+$/.test(upperSymbol) && // 英字のみ
      !upperSymbol.includes('.')) {
    return true;
  }
  
  return false;
};

/**
 * ランダムなユーザーエージェントを取得する
 * @returns {string} ユーザーエージェント
 */
const getRandomUserAgent = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

/**
 * Yahoo Financeから株価データを取得する
 * @param {string} symbol - ティッカーシンボル
 * @returns {Promise<Object>} 株価データ
 */
const getStockData = async (symbol) => {
  try {
    console.log(`Fetching Yahoo Finance data for: ${symbol}`);
    
    // 日本株の場合は.Tを追加
    let formattedSymbol = symbol;
    if (/^\d{4}$/.test(symbol) && !symbol.includes('.')) {
      formattedSymbol = `${symbol}.T`;
    }
    
    // ETFの場合は特別処理
    const isEtfSymbol = isETF(symbol);
    
    // ランダムなユーザーエージェントを選択
    const userAgent = getRandomUserAgent();
    
    // Yahoo FinanceのAPIエンドポイント
    const url = isEtfSymbol
      ? `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${formattedSymbol}?modules=price,defaultKeyStatistics,summaryDetail`
      : `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${formattedSymbol}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com/'
      },
      timeout: 10000
    });
    
    // ETFの場合
    if (isEtfSymbol) {
      if (response.data && 
          response.data.quoteSummary && 
          response.data.quoteSummary.result && 
          response.data.quoteSummary.result.length > 0) {
        
        const result = response.data.quoteSummary.result[0];
        const priceData = result.price || {};
        const statsData = result.defaultKeyStatistics || {};
        const summaryData = result.summaryDetail || {};
        
        // 名前を取得
        const name = priceData.shortName || priceData.longName || symbol;
        
        // 価格を取得
        const price = priceData.regularMarketPrice?.raw || 0;
        
        // 配当利回りを取得
        let dividendYield = 0;
        let hasDividend = false;
        
        if (summaryData.dividendYield && summaryData.dividendYield.raw) {
          dividendYield = (summaryData.dividendYield.raw * 100).toFixed(2);
          hasDividend = dividendYield > 0;
        }
        
        // 通貨を取得
        const currency = priceData.currency || 'USD';
        
        return {
          ticker: symbol,
          price: price,
          name: name,
          currency: currency,
          lastUpdated: new Date().toISOString(),
          source: 'Yahoo Finance',
          isStock: false,
          isMutualFund: false,
          isETF: true,
          dividendYield,
          hasDividend,
          priceLabel: '株価'
        };
      }
    } 
    // 通常の株式の場合
    else if (response.data && 
             response.data.quoteResponse && 
             response.data.quoteResponse.result && 
             response.data.quoteResponse.result.length > 0) {
      
      const quote = response.data.quoteResponse.result[0];
      
      // 投資信託かどうかをチェック
      const isMutualFundSymbol = /^\d{7,8}C(\.T)?$/i.test(symbol);
      
      return {
        ticker: symbol,
        price: quote.regularMarketPrice || quote.ask || quote.bid || 0,
        name: quote.shortName || quote.longName || symbol,
        currency: quote.currency || (formattedSymbol.includes('.T') ? 'JPY' : 'USD'),
        lastUpdated: new Date().toISOString(),
        source: 'Yahoo Finance',
        isStock: !isMutualFundSymbol,
        isMutualFund: isMutualFundSymbol,
        priceLabel: isMutualFundSymbol ? '基準価額' : '株価'
      };
    }
    
    // データが見つからない場合
    throw new Error(`No valid data found for symbol: ${symbol}`);
  } catch (error) {
    console.error(`Yahoo Finance API error for ${symbol}:`, error.message);
    throw error;
  }
};

module.exports = {
  getStockData,
  isETF
};
