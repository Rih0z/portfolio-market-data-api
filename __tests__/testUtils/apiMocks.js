/**
 * 外部APIのモックを設定するユーティリティ
 */
const nock = require('nock');

/**
 * 外部APIのモックを設定する
 */
const mockExternalApis = () => {
  // Yahoo Finance APIのモック
  nock('https://yh-finance.p.rapidapi.com')
    .persist()
    .get('/v8/finance/quote')
    .query(true)
    .reply(200, {
      quoteResponse: {
        result: [
          {
            symbol: 'AAPL',
            regularMarketPrice: 190.5,
            regularMarketChange: 2.3,
            regularMarketChangePercent: 1.2,
            shortName: 'Apple Inc.',
            currency: 'USD',
            regularMarketTime: Math.floor(Date.now() / 1000)
          }
        ],
        error: null
      }
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
    .reply(200, {
      success: true,
      base: 'USD',
      date: new Date().toISOString().split('T')[0],
      rates: {
        JPY: 148.5
      }
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
    .reply(200, {
      id: 'file-123',
      name: 'test-portfolio.json',
      createdTime: new Date().toISOString(),
      modifiedTime: new Date().toISOString()
    });
};

/**
 * モックをリセットする
 */
const resetApiMocks = () => {
  nock.cleanAll();
};

module.exports = {
  mockExternalApis,
  resetApiMocks
};
