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
 * 動的キャッシュ時間の計算のための係数
 * 取引量やボラティリティによってキャッシュ時間を調整
 */
const CACHE_VOLATILITY_FACTORS = {
  HIGH: 0.5,    // 高ボラティリティ：標準キャッシュ時間の50%
  MEDIUM: 1.0,  // 中ボラティリティ：標準キャッシュ時間の100%
  LOW: 2.0      // 低ボラティリティ：標準キャッシュ時間の200%
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
 * データソース定義と優先順位
 * 動的に調整される優先順位のデフォルト値
 */
const DATA_SOURCES = {
  JP_STOCK: {
    SOURCES: {
      YAHOO_FINANCE_JP: 'Yahoo Finance Japan',
      MINKABU: 'Minkabu',
      KABUTAN: 'Kabutan',
      FALLBACK: 'Fallback'
    },
    // デフォルトの優先順位（動的に調整される）
    DEFAULT_PRIORITY: ['YAHOO_FINANCE_JP', 'MINKABU', 'KABUTAN', 'FALLBACK']
  },
  US_STOCK: {
    SOURCES: {
      YAHOO_FINANCE_API: 'Yahoo Finance API',
      YAHOO_FINANCE_WEB: 'Yahoo Finance (Web)',
      MARKETWATCH: 'MarketWatch',
      FALLBACK: 'Fallback'
    },
    // デフォルトの優先順位（動的に調整される）
    DEFAULT_PRIORITY: ['YAHOO_FINANCE_API', 'YAHOO_FINANCE_WEB', 'MARKETWATCH', 'FALLBACK']
  },
  MUTUAL_FUND: {
    SOURCES: {
      MORNINGSTAR_CSV: 'Morningstar CSV',
      FALLBACK: 'Fallback'
    },
    DEFAULT_PRIORITY: ['MORNINGSTAR_CSV', 'FALLBACK']
  },
  EXCHANGE_RATE: {
    SOURCES: {
      EXCHANGERATE_HOST: 'exchangerate-host',
      DYNAMIC_CALCULATION: 'dynamic-calculation',
      HARDCODED_VALUES: 'hardcoded-values',
      EMERGENCY_FALLBACK: 'Emergency Fallback'
    },
    DEFAULT_PRIORITY: ['EXCHANGERATE_HOST', 'DYNAMIC_CALCULATION', 'HARDCODED_VALUES', 'EMERGENCY_FALLBACK']
  }
};

/**
 * バッチ処理サイズの設定
 * データタイプごとの最適なバッチサイズ
 */
const BATCH_SIZES = {
  US_STOCK: 20, // Yahoo Finance APIの制限に合わせる
  JP_STOCK: 10, // スクレイピングの負荷を考慮
  MUTUAL_FUND: 10
};

/**
 * 市場時間設定
 * 市場ごとの営業時間を定義
 */
const MARKET_HOURS = {
  JP: {
    // 日本市場: 9:00-15:00 JST (UTC+9)
    START_HOUR: 0, // 9:00 JST = 0:00 UTC
    END_HOUR: 6,   // 15:00 JST = 6:00 UTC
    WEEKEND_DAYS: [0, 6] // 日曜、土曜
  },
  US: {
    // 米国市場: 9:30-16:00 EST (UTC-5)
    START_HOUR: 14, // 9:30 EST = 14:30 UTC
    END_HOUR: 21,   // 16:00 EST = 21:00 UTC
    WEEKEND_DAYS: [0, 6] // 日曜、土曜
  }
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
  BLACKLISTED: 'BLACKLISTED',
  DATA_VALIDATION_ERROR: 'DATA_VALIDATION_ERROR' // 異常データ検出用
};

/**
 * 異常データ検出の閾値
 * 異常値と判断する変動率など
 */
const DATA_VALIDATION = {
  // 前回値からの価格変動率閾値（％）
  PRICE_CHANGE_THRESHOLD: 20,
  // 複数ソースからのデータの最大許容差（％）
  SOURCE_DIFFERENCE_THRESHOLD: 10
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
  CACHE_VOLATILITY_FACTORS,
  PREWARM_SYMBOLS,
  DATA_SOURCES,
  BATCH_SIZES,
  MARKET_HOURS,
  GOOGLE_AUTH,
  RESPONSE_FORMATS,
  ERROR_CODES,
  DATA_VALIDATION,
  DEFAULT_VALUES,
  ADMIN,
  MARKET_TYPES
};
