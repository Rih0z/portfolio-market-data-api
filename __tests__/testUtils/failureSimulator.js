/**
 * データソースの失敗をシミュレートするユーティリティ
 */
const nock = require('nock');

// 失敗させるデータソースを追跡する
let failingDataSources = [];

/**
 * 特定のデータソースの失敗をシミュレートする
 * @param {string} dataSourceName - 失敗させるデータソースの名前
 * （例：'yahoo-finance-api', 'yahoo-finance-scraping', 'exchangerate-api'）
 */
const simulateDataSourceFailure = async (dataSourceName) => {
  // 既に失敗するように設定されているか確認
  if (failingDataSources.includes(dataSourceName)) {
    return;
  }
  
  failingDataSources.push(dataSourceName);
  
  // 既存のnockをクリア
  nock.cleanAll();
  
  // 各データソースの失敗を設定
  if (dataSourceName === 'yahoo-finance-api') {
    nock('https://yh-finance.p.rapidapi.com')
      .persist()
      .get('/v8/finance/quote')
      .query(true)
      .reply(500, { error: 'Internal Server Error' });
  }
  
  if (dataSourceName === 'yahoo-finance-scraping') {
    nock('https://finance.yahoo.com')
      .persist()
      .get(/.*/)
      .reply(404, 'Not Found');
    
    nock('https://finance.yahoo.co.jp')
      .persist()
      .get(/.*/)
      .reply(404, 'Not Found');
  }
  
  if (dataSourceName === 'exchangerate-api') {
    nock('https://api.exchangerate.host')
      .persist()
      .get('/latest')
      .query(true)
      .reply(500, { error: 'Service Unavailable' });
  }
  
  if (dataSourceName === 'google-drive-api') {
    nock('https://www.googleapis.com')
      .persist()
      .get(/^\/drive\/v3\/files.*/)
      .reply(403, { error: 'Access Denied' });
    
    nock('https://www.googleapis.com')
      .persist()
      .post(/^\/drive\/v3\/files.*/)
      .reply(403, { error: 'Access Denied' });
  }
  
  // その他のデータソースも設定可能
  
  // 失敗しないデータソースは正常に動作するように再設定
  await resetNonFailingDataSources();
  
  console.log(`Data source failure simulated for: ${dataSourceName}`);
};

/**
 * 失敗していないデータソースのモックを再設定する
 */
const resetNonFailingDataSources = async () => {
  const { mockExternalApis } = require('./apiMocks');
  
  // デフォルトのモックを設定
  mockExternalApis();
  
  // 失敗するように設定されたデータソースを上書き（nockは後から設定したものが優先される）
  failingDataSources.forEach(dataSourceName => {
    if (dataSourceName === 'yahoo-finance-api') {
      nock('https://yh-finance.p.rapidapi.com')
        .persist()
        .get('/v8/finance/quote')
        .query(true)
        .reply(500, { error: 'Internal Server Error' });
    }
    
    // 他のデータソースも同様に設定
  });
};

/**
 * すべてのデータソースをリセットする
 */
const resetDataSources = async () => {
  failingDataSources = [];
  nock.cleanAll();
  
  // デフォルトのモックを再設定
  const { mockExternalApis } = require('./apiMocks');
  await mockExternalApis();
  
  console.log('All data sources reset to normal operation');
};

module.exports = {
  simulateDataSourceFailure,
  resetDataSources
};
