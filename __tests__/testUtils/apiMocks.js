/**
 * 外部APIのモックを設定するユーティリティ
 * 修正: エラーハンドリングとAPIキー設定強化、モック用ノックの安定性向上
 */
const nock = require('nock');

// API鍵の取得（環境変数からまたはデフォルト値）
const getYahooFinanceApiKey = () => process.env.YAHOO_FINANCE_API_KEY || 'test-api-key';
const getYahooFinanceApiHost = () => process.env.YAHOO_FINANCE_API_HOST || 'yh-finance.p.rapidapi.com';
const getExchangeRateApiKey = () => process.env.EXCHANGE_RATE_API_KEY || 'test-api-key';

/**
 * 外部APIのモックを設定する
 */
const mockExternalApis = () => {
  // モックをクリア（重複設定を防止）
  nock.cleanAll();
  
  try {
    // Yahoo Finance APIのモック
    nock('https://' + getYahooFinanceApiHost())
      .persist()
      .get('/v8/finance/quote')
      .query(true)
      .reply(function(uri, requestBody) {
        // リクエストヘッダーをチェック
        const headers = this.req.headers;
        const hasApiKey = headers['x-rapidapi-key'] !== undefined;
        
        if (!hasApiKey) {
          console.warn('Yahoo Finance API called without API key');
        }
        
        // クエリからシンボルを抽出
        const urlObj = new URL(`https://${getYahooFinanceApiHost()}${uri}`);
        const symbols = urlObj.searchParams.get('symbols') || 'AAPL';
        const symbolsArray = symbols.split(',');
        
        // レスポンスデータを作成
        return [
          200, 
          {
            quoteResponse: {
              result: symbolsArray.map(symbol => ({
                symbol,
                regularMarketPrice: 190.5,
                regularMarketChange: 2.3,
                regularMarketChangePercent: 1.2,
                shortName: `${symbol} Inc.`,
                currency: 'USD',
                regularMarketTime: Math.floor(Date.now() / 1000)
              })),
              error: null
            }
          }
        ];
      });
    
    // Yahoo Finance Japan APIのモック
    nock('https://finance.yahoo.co.jp')
      .persist()
      .get(/^\/quote\/.+/)
      .reply(200, '<html><body><div class="stocksPrice">2500</div></body></html>');
    
    // 為替レートAPIのモック
    nock('https://api.exchangerate.host')
      .persist()
      .get('/latest')
      .query(true)
      .reply(function(uri, requestBody) {
        // クエリパラメータを解析
        const urlObj = new URL(`https://api.exchangerate.host${uri}`);
        const base = urlObj.searchParams.get('base') || 'USD';
        const symbols = urlObj.searchParams.get('symbols') || 'JPY';
        
        // レスポンスデータを作成
        const rates = {};
        symbols.split(',').forEach(symbol => {
          rates[symbol] = symbol === 'JPY' ? 148.5 : 1.0;
        });
        
        return [
          200,
          {
            success: true,
            base,
            date: new Date().toISOString().split('T')[0],
            rates
          }
        ];
      });
    
    // Google OAuth2 APIのモック
    nock('https://oauth2.googleapis.com')
      .persist()
      .post('/token')
      .reply(200, {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        id_token: 'test-id-token',
        expires_in: 3600
      });
    
    nock('https://www.googleapis.com')
      .persist()
      .get('/oauth2/v3/userinfo')
      .reply(200, {
        sub: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg'
      });
    
    // Google Drive APIのモック
    nock('https://www.googleapis.com')
      .persist()
      .get('/drive/v3/files')
      .query(true)
      .reply(200, {
        files: [
          {
            id: 'file-123',
            name: 'test-portfolio.json',
            createdTime: new Date().toISOString(),
            modifiedTime: new Date().toISOString(),
            webViewLink: 'https://drive.google.com/file/d/file-123/view'
          }
        ]
      });
    
    nock('https://www.googleapis.com')
      .persist()
      .post('/drive/v3/files')
      .reply(200, {
        id: 'new-file-123',
        name: 'portfolio-data.json',
        createdTime: new Date().toISOString(),
        webViewLink: 'https://drive.google.com/file/d/new-file-123/view'
      });
    
    nock('https://www.googleapis.com')
      .persist()
      .get(/^\/drive\/v3\/files\/.+/)
      .reply(function(uri, requestBody) {
        // ファイルIDを抽出
        const match = uri.match(/\/files\/([^\/\?]+)/);
        const fileId = match ? match[1] : 'file-123';
        
        return [
          200, 
          {
            id: fileId,
            name: 'test-portfolio.json',
            createdTime: new Date().toISOString(),
            modifiedTime: new Date().toISOString(),
            contents: JSON.stringify({
              name: 'Test Portfolio',
              holdings: [
                { symbol: 'AAPL', shares: 10, cost: 150.0 },
                { symbol: '7203', shares: 100, cost: 2000 }
              ]
            })
          }
        ];
      });
    
    // 投資信託データAPIのモック（追加）
    nock('https://toushin-lib.fwg.ne.jp')
      .persist()
      .get(/^\/FdsWeb\/FDST/)
      .reply(200, '<html><body><div class="standard-price">10000</div></body></html>');
      
    console.log('All external APIs mocked successfully');
  } catch (error) {
    console.error('Error setting up API mocks:', error);
  }
};

/**
 * APIリクエストのモックを設定するヘルパー
 * @param {string} url - モックするURL
 * @param {string} method - HTTPメソッド
 * @param {object} response - レスポンスデータ
 * @param {number} statusCode - HTTPステータスコード
 */
const mockApiRequest = (url, method = 'GET', response = {}, statusCode = 200) => {
  try {
    const urlObj = new URL(url);
    
    nock(urlObj.origin)
      .persist()
      [method.toLowerCase()](urlObj.pathname)
      .query(true)
      .reply(statusCode, response);
    
    return true;
  } catch (error) {
    console.error(`Error mocking API request to ${url}:`, error);
    return false;
  }
};

/**
 * モックをリセットする
 */
const resetApiMocks = () => {
  try {
    nock.cleanAll();
    console.log('API mocks reset');
    return true;
  } catch (error) {
    console.error('Error resetting API mocks:', error);
    return false;
  }
};

/**
 * API呼び出しをログに記録する
 * @param {boolean} enabled - ログ記録を有効にするかどうか
 */
const enableApiLogging = (enabled = true) => {
  if (enabled) {
    nock.recorder.rec({
      dont_print: true,
      output_objects: true
    });
    console.log('API logging enabled');
  } else {
    nock.recorder.clear();
    console.log('API logging disabled');
  }
};

/**
 * 記録されたAPI呼び出しを取得する
 */
const getRecordedApis = () => {
  return nock.recorder.play();
};

/**
 * リクエストが失敗したときのフォールバックレスポンスを提供する
 * （テスト安定性の向上）
 */
const setupFallbackResponses = () => {
  // すべてのHTTPリクエストに対するフォールバックを設定
  nock(/.*/)
    .persist()
    .get(/.*/)
    .query(true)
    .reply(function(uri, requestBody) {
      console.warn(`Unhandled GET request to: ${uri}`);
      return [
        200,
        {
          success: true,
          mockFallback: true,
          message: 'This is a fallback response for an unhandled request',
          data: {}
        }
      ];
    });
  
  nock(/.*/)
    .persist()
    .post(/.*/)
    .reply(function(uri, requestBody) {
      console.warn(`Unhandled POST request to: ${uri}`);
      return [
        200,
        {
          success: true,
          mockFallback: true,
          message: 'This is a fallback response for an unhandled request',
          data: {}
        }
      ];
    });
  
  console.log('Fallback responses setup for unhandled requests');
};

module.exports = {
  mockExternalApis,
  resetApiMocks,
  mockApiRequest,
  enableApiLogging,
  getRecordedApis,
  setupFallbackResponses
};
