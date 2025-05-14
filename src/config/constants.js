/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/config/constants.js
 * 
 * 説明: 
 * アプリケーション全体で使用される定数値を定義します。
 * APIのデータタイプ、エラーコード、キャッシュ時間、その他の設定値が含まれます。
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-08
 * @updated 2025-05-15 機能追加: エラーコードを追加
 */
'use strict';

/**
 * データタイプの定義
 */
const DATA_TYPES = {
  US_STOCK: 'us-stock',
  JP_STOCK: 'jp-stock',
  MUTUAL_FUND: 'mutual-fund',
  EXCHANGE_RATE: 'exchange-rate'
};

/**
 * エラーコードの定義 - APIレスポンスで使用
 * エラーコードは大文字のスネークケースで定義（テスト互換性のため）
 */
const ERROR_CODES = {
  // 400系エラー（クライアントエラー）
  INVALID_PARAMS: 'INVALID_PARAMS',
  MISSING_PARAMS: 'MISSING_PARAMS',
  SCHEMA_VALIDATION_ERROR: 'SCHEMA_VALIDATION_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  UNSUPPORTED_OPERATION: 'UNSUPPORTED_OPERATION',
  SYMBOL_NOT_FOUND: 'SYMBOL_NOT_FOUND',
  TOO_MANY_SYMBOLS: 'TOO_MANY_SYMBOLS',
  
  // 401, 403系エラー（認証・認可エラー）
  UNAUTHORIZED: 'UNAUTHORIZED',
  NO_SESSION: 'NO_SESSION',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  AUTH_ERROR: 'AUTH_ERROR',
  FORBIDDEN: 'FORBIDDEN',
  
  // 429, 403系エラー（制限エラー）
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  BUDGET_LIMIT_EXCEEDED: 'BUDGET_LIMIT_EXCEEDED',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  
  // 404エラー（リソースが見つからない）
  NOT_FOUND: 'NOT_FOUND',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  
  // 500系エラー（サーバーエラー）
  SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATA_SOURCE_ERROR: 'DATA_SOURCE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
  
  // その他エラー
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED'
};

/**
 * 各種キャッシュ時間（秒単位）
 */
const CACHE_TIMES = {
  US_STOCK: 300,         // 5分
  JP_STOCK: 300,         // 5分
  MUTUAL_FUND: 3600,     // 1時間
  EXCHANGE_RATE: 300,    // 5分
  USER_SESSION: 604800,  // 7日
  FALLBACK_DATA: 86400   // 24時間
};

/**
 * API応答のフォーマット設定
 */
const RESPONSE_FORMATS = {
  JSON: 'json',
  CSV: 'csv',
  TEXT: 'text'
};

/**
 * バッチ処理サイズの設定
 */
const BATCH_SIZES = {
  US_STOCK: 10,
  JP_STOCK: 10,
  MUTUAL_FUND: 5
};

/**
 * デフォルト為替レート（データソースが利用できない場合）
 */
const DEFAULT_EXCHANGE_RATE = 149.5;

/**
 * 一括エクスポート
 */
module.exports = {
  DATA_TYPES,
  ERROR_CODES,
  CACHE_TIMES,
  RESPONSE_FORMATS,
  BATCH_SIZES,
  DEFAULT_EXCHANGE_RATE
};
