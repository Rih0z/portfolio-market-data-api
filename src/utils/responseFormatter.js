/**
 * レスポンスフォーマッター - APIレスポンスの標準化
 * 
 * @file src/utils/responseFormatter.js
 * @author Portfolio Manager Team
 * @created 2025-05-12
 */
'use strict';

/**
 * 成功レスポンスを整形する
 * @param {Object} options - レスポンスオプション
 * @param {number} [options.statusCode=200] - HTTPステータスコード
 * @param {Object} options.body - レスポンスボディ
 * @param {Object} [options.headers={}] - レスポンスヘッダー
 * @returns {Object} - API Gatewayレスポンス
 */
const formatResponse = (options) => {
  const {
    statusCode = 200,
    body,
    headers = {}
  } = options;

  // デフォルトのCORSヘッダーを設定
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
    'Access-Control-Allow-Credentials': 'true'
  };

  // ヘッダーをマージ
  const responseHeaders = {
    ...defaultHeaders,
    ...headers
  };

  return {
    statusCode,
    headers: responseHeaders,
    body: JSON.stringify(body)
  };
};

/**
 * エラーレスポンスを整形する
 * @param {Object} options - エラーオプション
 * @param {number} [options.statusCode=500] - HTTPステータスコード
 * @param {string} options.code - エラーコード
 * @param {string} options.message - エラーメッセージ
 * @param {string} [options.details=null] - エラー詳細（開発環境のみ）
 * @param {Object} [options.headers={}] - レスポンスヘッダー
 * @returns {Object} - API Gatewayレスポンス
 */
const formatErrorResponse = (options) => {
  const {
    statusCode = 500,
    code,
    message,
    details = null,
    headers = {}
  } = options;

  // デフォルトのCORSヘッダーを設定
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
    'Access-Control-Allow-Credentials': 'true'
  };

  // ヘッダーをマージ
  const responseHeaders = {
    ...defaultHeaders,
    ...headers
  };

  // エラーボディを構築
  const errorBody = {
    success: false,
    error: {
      message,
      code
    }
  };

  // 開発環境の場合は詳細情報も含める
  if (details && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
    errorBody.error.details = details;
  }

  return {
    statusCode,
    headers: responseHeaders,
    body: JSON.stringify(errorBody)
  };
};

/**
 * リダイレクトレスポンスを作成する
 * @param {string} location - リダイレクト先URL
 * @param {number} [statusCode=302] - HTTPステータスコード (301: 恒久的, 302: 一時的)
 * @returns {Object} - API Gatewayレスポンス
 */
const formatRedirectResponse = (location, statusCode = 302) => {
  return {
    statusCode,
    headers: {
      Location: location,
      'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Credentials': 'true'
    },
    body: ''
  };
};

// エクスポート
module.exports = {
  formatResponse,
  formatErrorResponse,
  formatRedirectResponse
};
