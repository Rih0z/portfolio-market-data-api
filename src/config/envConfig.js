/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/config/envConfig.js
 * 
 * 説明: 
 * 環境変数の取得と管理を一元化するモジュール。
 * デフォルト値の設定と型変換を行い、アプリケーション全体で
 * 一貫した環境設定を提供します。
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-15
 */
'use strict';

/**
 * 環境変数から数値を取得（デフォルト値付き）
 * @param {string} name - 環境変数名
 * @param {number} defaultValue - デフォルト値
 * @returns {number} 環境変数値（数値）
 */
const getNumberEnv = (name, defaultValue) => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return parseInt(value, 10);
};

/**
 * 環境変数から文字列を取得（デフォルト値付き）
 * @param {string} name - 環境変数名
 * @param {string} defaultValue - デフォルト値
 * @returns {string} 環境変数値（文字列）
 */
const getStringEnv = (name, defaultValue) => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value;
};

/**
 * 環境変数からブール値を取得（デフォルト値付き）
 * @param {string} name - 環境変数名
 * @param {boolean} defaultValue - デフォルト値
 * @returns {boolean} 環境変数値（ブール）
 */
const getBooleanEnv = (name, defaultValue) => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
};

// アプリケーション環境設定
const ENV = {
  // 基本設定
  NODE_ENV: getStringEnv('NODE_ENV', 'development'),
  REGION: getStringEnv('AWS_REGION', 'ap-northeast-1'),
  
  // API制限設定
  DAILY_REQUEST_LIMIT: getNumberEnv('DAILY_REQUEST_LIMIT', 5000),
  MONTHLY_REQUEST_LIMIT: getNumberEnv('MONTHLY_REQUEST_LIMIT', 100000),
  DISABLE_ON_LIMIT: getBooleanEnv('DISABLE_ON_LIMIT', true),
  
  // キャッシュ設定
  CACHE_TIME_US_STOCK: getNumberEnv('CACHE_TIME_US_STOCK', 3600),       // 1時間
  CACHE_TIME_JP_STOCK: getNumberEnv('CACHE_TIME_JP_STOCK', 3600),       // 1時間
  CACHE_TIME_MUTUAL_FUND: getNumberEnv('CACHE_TIME_MUTUAL_FUND', 10800), // 3時間
  CACHE_TIME_EXCHANGE_RATE: getNumberEnv('CACHE_TIME_EXCHANGE_RATE', 21600), // 6時間
  
  // タイムアウト設定
  JP_STOCK_SCRAPING_TIMEOUT: getNumberEnv('JP_STOCK_SCRAPING_TIMEOUT', 30000),
  US_STOCK_SCRAPING_TIMEOUT: getNumberEnv('US_STOCK_SCRAPING_TIMEOUT', 20000),
  MUTUAL_FUND_TIMEOUT: getNumberEnv('MUTUAL_FUND_TIMEOUT', 30000),
  YAHOO_FINANCE_API_TIMEOUT: getNumberEnv('YAHOO_FINANCE_API_TIMEOUT', 5000),
  
  // レート制限対策
  DATA_RATE_LIMIT_DELAY: getNumberEnv('DATA_RATE_LIMIT_DELAY', 500),
  SCRAPING_RATE_LIMIT_DELAY: getNumberEnv('SCRAPING_RATE_LIMIT_DELAY', 500),
  
  // スクレイピングブラックリスト設定
  SCRAPING_MAX_FAILURES: getNumberEnv('SCRAPING_MAX_FAILURES', 3),
  SCRAPING_COOLDOWN_DAYS: getNumberEnv('SCRAPING_COOLDOWN_DAYS', 7),
  
  // API設定
  YAHOO_FINANCE_API_KEY: getStringEnv('YAHOO_FINANCE_API_KEY', ''),
  YAHOO_FINANCE_API_HOST: getStringEnv('YAHOO_FINANCE_API_HOST', 'yh-finance.p.rapidapi.com'),
  EXCHANGE_RATE_API_KEY: getStringEnv('EXCHANGE_RATE_API_KEY', ''),
  
  // 管理者設定
  ADMIN_EMAIL: getStringEnv('ADMIN_EMAIL', ''),
  ADMIN_API_KEY: getStringEnv('ADMIN_API_KEY', ''),
  CRON_SECRET: getStringEnv('CRON_SECRET', ''),
  
  // CORS設定
  CORS_ALLOW_ORIGIN: getStringEnv('CORS_ALLOW_ORIGIN', '*'),
  
  // Google認証設定
  GOOGLE_CLIENT_ID: getStringEnv('GOOGLE_CLIENT_ID', ''),
  GOOGLE_CLIENT_SECRET: getStringEnv('GOOGLE_CLIENT_SECRET', ''),
  SESSION_EXPIRES_DAYS: getNumberEnv('SESSION_EXPIRES_DAYS', 7),
  SESSION_TABLE: getStringEnv('SESSION_TABLE', 'pfwise-api-dev-sessions'),
  
  // Google Drive設定
  DRIVE_FOLDER_NAME: getStringEnv('DRIVE_FOLDER_NAME', 'PortfolioManagerData'),
  
  // 開発環境用エンドポイント設定
  DYNAMODB_ENDPOINT: getStringEnv('DYNAMODB_ENDPOINT', ''),
  AWS_ENDPOINT: getStringEnv('AWS_ENDPOINT', ''),
  SNS_ENDPOINT: getStringEnv('SNS_ENDPOINT', ''),
  STS_ENDPOINT: getStringEnv('STS_ENDPOINT', ''),
  
  // 定数
  DEFAULT_EXCHANGE_RATE: 148.5
};

// 開発環境かどうかを判定
const isDevelopment = ENV.NODE_ENV === 'development' || ENV.NODE_ENV === 'test';

module.exports = {
  ENV,
  isDevelopment,
  getNumberEnv,
  getStringEnv,
  getBooleanEnv
};
