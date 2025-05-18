/**
 * API レスポンスユーティリティ
 * 
 * @file src/utils/responseUtils.js
 * @author Portfolio Manager Team
 * @created 2025-05-12
 * @updated 2025-05-21 リファクタリング: テスト互換性を向上、レスポンス形式を統一
 */
'use strict';

// デフォルトのCORS設定
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

/**
 * コンテンツタイプを取得
 * @param {string} format - コンテンツ形式
 * @returns {string} - Content-Type値
 */
const getContentType = (format) => {
  switch (format) {
    case 'html':
      return 'text/html';
    case 'text':
      return 'text/plain';
    case 'xml':
      return 'application/xml';
    case 'csv':
      return 'text/csv';
    default:
      return 'application/json';
  }
};

/**
 * APIレスポンスを標準形式に整形
 * @param {Object} options - レスポンスオプション
 * @param {number} [options.statusCode=200] - HTTPステータスコード
 * @param {Object} options.data - レスポンスデータ
 * @param {Object} [options.headers={}] - カスタムヘッダー
 * @param {boolean} [options.skipBudgetWarning=false] - 予算警告をスキップするかどうか
 * @param {string} [options.format='json'] - レスポンス形式
 * @returns {Object} - 整形されたAPIレスポンス
 */
const formatResponse = (options = {}) => {
  // オプションの分割と既定値の設定
  const {
    statusCode = 200,
    data = {},
    headers = {},
    skipBudgetWarning = false,
    format = 'json'
  } = options;
  
  // 予算使用状況の追加（オプション）
  let responseData = { ...data };
  if (!skipBudgetWarning && process.env.BUDGET_WARNING === 'true') {
    responseData.budgetWarning = {
      message: '予算使用量が警告レベルに達しています',
      usagePercent: 85
    };
  }
  
  // Content-Typeの設定
  const contentType = headers['Content-Type'] || getContentType(format);
  
  // レスポンスヘッダーの準備
  const responseHeaders = {
    ...DEFAULT_HEADERS,
    'Content-Type': contentType,
    ...headers
  };
  
  // テスト互換性のためのbodyプロパティ設定
  let responseBody;
  
  if (format === 'json') {
    responseBody = JSON.stringify(responseData);
  } else if (typeof responseData === 'string') {
    responseBody = responseData;
  } else {
    responseBody = JSON.stringify(responseData);
  }
  
  // 標準形式で返却
  return {
    statusCode,
    headers: responseHeaders,
    body: responseBody
  };
};

/**
 * エラーレスポンスを標準形式に整形
 * @param {Object} options - エラーオプション
 * @param {number} [options.statusCode=400] - HTTPステータスコード
 * @param {string} options.code - エラーコード
 * @param {string} options.message - エラーメッセージ
 * @param {Object} [options.details] - 詳細情報（開発環境のみ）
 * @param {Object} [options.headers={}] - カスタムヘッダー
 * @param {Object} [options.usage] - 使用量情報
 * @returns {Object} - 整形されたエラーレスポンス
 */
const formatErrorResponse = (options = {}) => {
  // オプションの分割と既定値の設定
  const {
    statusCode = 400,
    code = 'ERROR',
    message = 'エラーが発生しました',
    details,
    headers = {},
    usage
  } = options;
  
  // エラーオブジェクトの構築
  const errorObj = {
    code,
    message
  };
  
  // 開発環境では詳細エラー情報を追加
  if (details && process.env.NODE_ENV !== 'production') {
    errorObj.details = details;
  }
  
  // 使用量情報を追加（オプション）
  const responseData = {
    success: false,
    error: errorObj
  };
  
  if (usage) {
    responseData.usage = usage;
  }
  
  // レスポンスヘッダーの準備
  const responseHeaders = {
    ...DEFAULT_HEADERS,
    ...headers
  };
  
  // 標準形式で返却
  return {
    statusCode,
    headers: responseHeaders,
    body: JSON.stringify(responseData)
  };
};

/**
 * リダイレクトレスポンスを生成
 * @param {string} location - リダイレクト先URL
 * @param {number} [statusCode=302] - HTTPステータスコード
 * @param {Object} [headers={}] - カスタムヘッダー
 * @returns {Object} - リダイレクトレスポンス
 */
const formatRedirectResponse = (location, statusCode = 302, headers = {}) => {
  // レスポンスヘッダーの準備
  const responseHeaders = {
    ...DEFAULT_HEADERS,
    'Location': location,
    ...headers
  };
  
  // リダイレクトレスポンスを返却
  return {
    statusCode,
    headers: responseHeaders,
    body: JSON.stringify({ location })
  };
};

/**
 * OPTIONSメソッドのレスポンスを生成
 * @param {Object} [headers={}] - カスタムヘッダー
 * @returns {Object} - OPTIONSレスポンス
 */
const formatOptionsResponse = (headers = {}) => {
  // レスポンスヘッダーの準備
  const responseHeaders = {
    ...DEFAULT_HEADERS,
    ...headers
  };
  
  // OPTIONSレスポンスを返却
  return {
    statusCode: 200,
    headers: responseHeaders,
    body: ''
  };
};

/**
 * CORS対応リクエストヘッダーの処理
 * @param {Object} event - API Gatewayイベント
 * @param {function} handler - リクエストハンドラー関数
 * @returns {Object} - レスポンス
 */
const handleCors = async (event, handler) => {
  // OPTIONSリクエストの場合は即座にレスポンスを返す
  if (event.httpMethod === 'OPTIONS') {
    return formatOptionsResponse();
  }
  
  // その他のメソッドの場合はハンドラーを実行
  return handler(event);
};

module.exports = {
  formatResponse,
  formatErrorResponse,
  formatRedirectResponse,
  formatOptionsResponse,
  handleCors
};
