/**
 * レスポンス形式を標準化するユーティリティ関数
 * 
 * @file src/utils/responseUtils.js
 * @author Portfolio Manager Team
 * @updated Koki - 2025-05-12 バグ修正: 未定義プロパティへのアクセスを防止
 */

const { getBudgetWarningMessage, addBudgetWarningToResponse, isBudgetCritical } = require('./budgetCheck');

/**
 * 正常レスポンスの形式を標準化する
 * 
 * @param {Object} params - レスポンスパラメータ
 * @param {number} [params.statusCode=200] - HTTPステータスコード
 * @param {Object} [params.headers={}] - レスポンスヘッダー
 * @param {Object} [params.data={}] - レスポンスデータ
 * @param {string} [params.source] - データソース情報
 * @param {string} [params.lastUpdated] - 最終更新日時
 * @param {string} [params.processingTime] - 処理時間
 * @param {Object} [params.usage] - API使用量情報
 * @param {boolean} [params.skipBudgetWarning=false] - 予算警告をスキップするかどうか
 * @returns {Object} 標準化されたレスポンスオブジェクト
 */
const formatResponse = async (params = {}) => {
  // デフォルト値を設定して未定義アクセスを防止
  const statusCode = params.statusCode || 200;
  const headers = params.headers || {};
  const data = params.data || {};
  
  // レスポンスオブジェクトの構築
  const response = {
    statusCode,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Credentials': 'true',
      ...headers 
    },
    body: JSON.stringify({
      success: true,
      data,
      ...(params.source && { source: params.source }),
      ...(params.lastUpdated && { lastUpdated: params.lastUpdated }),
      ...(params.processingTime && { processingTime: params.processingTime }),
      ...(params.usage && { usage: params.usage })
    })
  };
  
  // 予算警告の追加（オプション）
  if (!params.skipBudgetWarning) {
    try {
      return await addBudgetWarningToResponse(response);
    } catch (error) {
      console.error('Budget warning error:', error);
      return response;  // エラー時は元のレスポンスを返す
    }
  }
  
  return response;
};

/**
 * エラーレスポンスの形式を標準化する
 * 
 * @param {Object} params - エラーパラメータ
 * @param {number} [params.statusCode=500] - HTTPステータスコード
 * @param {Object} [params.headers={}] - レスポンスヘッダー
 * @param {string} [params.code='SERVER_ERROR'] - エラーコード
 * @param {string} params.message - エラーメッセージ
 * @param {string} [params.details] - 詳細なエラー情報（開発環境のみ）
 * @param {Object} [params.usage] - API使用量情報
 * @returns {Object} 標準化されたエラーレスポンスオブジェクト
 */
const formatErrorResponse = async (params = {}) => {
  // デフォルト値を設定
  const statusCode = params.statusCode || 500;
  const code = params.code || 'SERVER_ERROR';
  const message = params.message || 'Internal server error';
  const headers = params.headers || {};
  
  // エラーオブジェクトの構築
  const errorObj = {
    code,
    message
  };
  
  // 開発環境の場合は詳細なエラー情報を含める
  if ((process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && params.details) {
    errorObj.details = params.details;
  }
  
  // レスポンスボディの構築
  const bodyObj = {
    success: false,
    error: errorObj
  };
  
  // 使用量情報の追加（オプション）
  if (params.usage) {
    bodyObj.usage = params.usage;
  }
  
  // レスポンスオブジェクトの構築
  return {
    statusCode,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Credentials': 'true',
      ...headers 
    },
    body: JSON.stringify(bodyObj)
  };
};

/**
 * リダイレクトレスポンスの形式を標準化する
 * 
 * @param {string} url - リダイレクト先URL
 * @param {number} [statusCode=302] - HTTPステータスコード (301: 恒久的, 302: 一時的)
 * @param {Object} [headers={}] - 追加のレスポンスヘッダー
 * @returns {Object} 標準化されたリダイレクトレスポンスオブジェクト
 */
const formatRedirectResponse = (url, statusCode = 302, headers = {}) => {
  return {
    statusCode,
    headers: {
      Location: url,
      'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Credentials': 'true',
      ...headers
    },
    body: ''
  };
};

/**
 * OPTIONSリクエストへのレスポンスを形式化する
 * 
 * @param {Object} [headers={}] - 追加のレスポンスヘッダー
 * @returns {Object} 標準化されたOPTIONSレスポンスオブジェクト
 */
const formatOptionsResponse = (headers = {}) => {
  return {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Credentials': 'true',
      ...headers
    },
    body: ''
  };
};

/**
 * OPTIONSリクエストを処理する
 * 
 * @param {Object} event - API Gatewayイベントオブジェクト
 * @returns {Object|null} OPTIONSレスポンスまたはnull
 */
const handleOptions = (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return formatOptionsResponse();
  }
  return null;
};

module.exports = {
  formatResponse,
  formatErrorResponse,
  formatRedirectResponse,
  formatOptionsResponse,
  handleOptions
};
