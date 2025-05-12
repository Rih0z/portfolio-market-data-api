/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/config/constants.js
 * 
 * 説明: 
 * システム全体で使用される定数を定義します。
 * データタイプ、キャッシュ時間、予熱対象銘柄などの設定値を管理します。
 * 
 * @author Portfolio Manager Team
 * @updated 2025-05-15
 */
'use strict';

const { ENV } = require('./envConfig');

/**
 * データタイプ定義
 * API呼び出しやキャッシュキーのプレフィックスに使用
 */
const DATA_TYPES = {
  US_STOCK: 'us-stock',
  JP_STOCK: 'jp-stock',
  MUTUAL_FUND: 'mutual-fund',
  EXCHANGE_RATE: 'exchange-rate'
};

/**
 * キャッシュ時間（秒）
 * 環境変数から値を取得
 */
const CACHE_TIMES = {
  US_STOCK: ENV.CACHE_TIME_US_STOCK,
  JP_STOCK: ENV.CACHE_TIME_JP_STOCK,
  MUTUAL_FUND: ENV.CACHE_TIME_MUTUAL_FUND,
  EXCHANGE_RATE: ENV.CACHE_TIME_EXCHANGE_RATE
};

/**
 * キャッシュ予熱対象銘柄
 * 人気銘柄のデータを事前にキャッシュに保存する対象リスト
 */
const PREWARM_SYMBOLS = {
  // 米国株（主要テック銘柄など）
  US_STOCK: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'BRK-B', 'V', 'JPM'],
  
  // 日本株（主要銘柄）
  JP_STOCK: ['7203', '9984', '6758', '6861', '6501', '7974', '4502', '8306', '9432', '6702'],
  
  // 投資信託（人気ファンド）
  MUTUAL_FUND: ['2931113C', '0131103C', '03311171C', '0231266C', '2931112C', '0131310C']
};

/**
 * Google認証設定
 */
const GOOGLE_AUTH = {
  SESSION_EXPIRES_DAYS: ENV.SESSION_EXPIRES_DAYS,
  SCOPES: [
    'email', 
    'profile', 
    'https://www.googleapis.com/auth/drive.file'
  ]
};

/**
 * APIレスポンスのデフォルト形式
 */
const RESPONSE_FORMATS = {
  SUCCESS: {
    success: true
  },
  ERROR: {
    success: false,
    error: {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred'
    }
  }
};

/**
 * エラーコード定義
 */
const ERROR_CODES = {
  INVALID_PARAMS: 'INVALID_PARAMS',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  SOURCE_ERROR: 'SOURCE_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  NO_SESSION: 'NO_SESSION',
  DRIVE_ERROR: 'DRIVE_ERROR',
  DATA_SOURCE_ERROR: 'DATA_SOURCE_ERROR',
  BLACKLISTED: 'BLACKLISTED'
};

/**
 * データソース関連のデフォルト値
 */
const DEFAULT_VALUES = {
  EXCHANGE_RATE: ENV.DEFAULT_EXCHANGE_RATE, // USD/JPY のデフォルト値
  JP_STOCK_PRICE: 2500,  // 日本株のデフォルト価格
  US_STOCK_PRICE: 100,   // 米国株のデフォルト価格
  MUTUAL_FUND_PRICE: 10000, // 投資信託のデフォルト基準価額
};

/**
 * 管理者設定
 */
const ADMIN = {
  EMAIL: ENV.ADMIN_EMAIL,
  API_KEY: ENV.ADMIN_API_KEY
};

/**
 * データプロバイダー定義
 */
const DATA_PROVIDERS = {
  JP_STOCK: {
    YAHOO_FINANCE_JP: 'Yahoo Finance Japan',
    MINKABU: 'Minkabu',
    KABUTAN: 'Kabutan',
    FALLBACK: 'Fallback'
  },
  US_STOCK: {
    YAHOO_FINANCE_API: 'Yahoo Finance API',
    YAHOO_FINANCE_WEB: 'Yahoo Finance (Web)',
    MARKETWATCH: 'MarketWatch',
    FALLBACK: 'Fallback'
  },
  MUTUAL_FUND: {
    MORNINGSTAR_CSV: 'Morningstar CSV',
    FALLBACK: 'Fallback'
  },
  EXCHANGE_RATE: {
    EXCHANGERATE_HOST: 'exchangerate-host',
    DYNAMIC_CALCULATION: 'dynamic-calculation',
    HARDCODED_VALUES: 'hardcoded-values',
    EMERGENCY_FALLBACK: 'Emergency Fallback'
  }
};

/**
 * マーケット種別
 */
const MARKET_TYPES = {
  JP: 'jp',
  US: 'us',
  FUND: 'fund'
};

module.exports = {
  DATA_TYPES,
  CACHE_TIMES,
  PREWARM_SYMBOLS,
  GOOGLE_AUTH,
  RESPONSE_FORMATS,
  ERROR_CODES,
  DEFAULT_VALUES,
  ADMIN,
  DATA_PROVIDERS,
  MARKET_TYPES
};
