/**
 * 外部APIのモックサーバー
 */
const http = require('http');
const { parse } = require('url');

let server = null;
let budgetUsage = 25; // デフォルト値

/**
 * モックサーバーをセットアップする
 */
const setupMockServer = async (port = 3001) => {
  if (server) {
    console.log('Mock server is already running');
    return;
  }
  
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      const { pathname } = parsedUrl;
      
      // CORSヘッダーを設定
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }
      
      // Yahoo Finance APIのモック
      if (pathname === '/v8/finance/quote') {
        handleYahooFinanceAPI(req, res, parsedUrl.query);
        return;
      }
      
      // 為替レートAPIのモック
      if (pathname === '/exchange-rate') {
        handleExchangeRateAPI(req, res, parsedUrl.query);
        return;
      }
      
      // AWS予算APIのモック
      if (pathname === '/mock-aws-budget') {
        handleBudgetAPI(req, res);
        return;
      }
      
      // Googleリダイレクトエンドポイントのモック
      if (pathname === '/auth/callback') {
        handleGoogleCallback(req, res, parsedUrl.query);
        return;
      }
      
      // 不明なエンドポイント
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    });
    
    server.listen(port, () => {
      console.log(`Mock server running at http://localhost:${port}`);
      resolve();
    });
    
    server.on('error', (error) => {
      console.error('Failed to start mock server:', error);
      reject(error);
    });
  });
};

/**
 * モックサーバーを停止する
 */
const stopMockServer = () => {
  if (server) {
    console.log('Stopping mock server...');
    server.close();
    server = null;
  }
};

/**
 * Yahoo Finance APIのモックハンドラー
 */
const handleYahooFinanceAPI = (req, res, query) => {
  const symbols = (query.symbols || 'AAPL').split(',');
  
  const result = {
    quoteResponse: {
      result: symbols.map(symbol => ({
        symbol,
        regularMarketPrice: 150 + Math.random() * 50,
        regularMarketChange: 2.5 - Math.random() * 5,
        regularMarketChangePercent: 1.5 - Math.random() * 3,
        shortName: `${symbol} Inc.`,
        currency: 'USD',
        regularMarketTime: Math.floor(Date.now() / 1000)
      })),
      error: null
    }
  };
  
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(result));
};

/**
 * 為替レートAPIのモックハンドラー
 */
const handleExchangeRateAPI = (req, res, query) => {
  const base = query.base || 'USD';
  const target = query.target || 'JPY';
  
  const result = {
    success: true,
    base,
    date: new Date().toISOString().split('T')[0],
    rates: {
      [target]: target === 'JPY' ? 148.5 + Math.random() * 3 : 1 + Math.random() * 0.1
    }
  };
  
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(result));
};

/**
 * AWS予算APIのモックハンドラー
 */
const handleBudgetAPI = (req, res) => {
  const result = {
    budgetPerformanceHistory: {
      budgetName: 'AWS Free Tier',
      budgetType: 'COST',
      costFilters: {},
      costTypes: {
        includeCredit: true,
        includeDiscount: true,
        includeOtherSubscription: true,
        includeRecurring: true,
        includeRefund: true,
        includeSubscription: true,
        includeSupport: true,
        includeTax: true,
        includeUpfront: true,
        useAmortized: false,
        useBlended: false
      },
      timeUnit: 'MONTHLY',
      budgetedAndActualAmountsList: [
        {
          budgetedAmount: {
            amount: '25',
            unit: 'USD'
          },
          actualAmount: {
            amount: (budgetUsage).toString(),
            unit: 'USD'
          },
          timePeriod: {
            start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
            end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
          }
        }
      ]
    }
  };
  
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(result));
};

/**
 * Google認証コールバックのモックハンドラー
 */
const handleGoogleCallback = (req, res, query) => {
  const code = query.code || 'test-auth-code';
  
  // リダイレクト先に認証コードを付けて返す
  const redirectUri = query.redirect_uri || 'http://localhost:3000';
  res.statusCode = 302;
  res.setHeader('Location', `${redirectUri}?code=${code}`);
  res.end();
};

/**
 * 予算使用率を設定する
 */
const setBudgetUsage = (percentage) => {
  budgetUsage = percentage;
  return budgetUsage;
};

module.exports = {
  setupMockServer,
  stopMockServer,
  setBudgetUsage
};
