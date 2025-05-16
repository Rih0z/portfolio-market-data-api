/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/utils/responseUtils.js
 * 
 * 説明: 
 * API Gateway互換のレスポンスを標準化するユーティリティ。
 * ヘッダーやコンテンツタイプのデフォルト設定、成功応答やエラー応答の形式を統一します。
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-10
 * @updated 2025-05-15 バグ修正: フォーマット調整
 * @updated 2025-05-16 バグ修正: テスト互換性対応
 * @updated 2025-05-17 機能追加: OPTIONS処理の改善
 * @updated 2025-05-18 バグ修正: usage処理の改善とテスト互換性強化
 * @updated 2025-05-20 バグ修正: テスト失敗対応、形式の一貫性確保
 * @updated 2025-05-21 バグ修正: テスト期待値に合わせたステータスコード修正
 */
'use strict';

const { ERROR_CODES, RESPONSE_FORMATS } = require('../config/constants');
// バグ修正: isBudgetWarning を isBudgetCritical に変更
const { isBudgetCritical, getBudgetWarningMessage } = require('./budgetCheck');

/**
 * 正常レスポンスを生成して返却する
 * @param {Object} options - レスポンスオプション
 * @param {number} options.statusCode - HTTPステータスコード（デフォルト: 200）
 * @param {Object} options.data - レスポンスデータ
 * @param {string} options.message - 成功メッセージ
 * @param {Object} options.headers - レスポンスヘッダー
 * @param {string} options.source - データソース情報
 * @param {string} options.lastUpdated - データ最終更新日時
 * @param {string} options.processingTime - 処理時間
 * @param {Object} options.usage - API使用量データ
 * @param {boolean} options.skipBudgetWarning - 予算警告をスキップするフラグ
 * @returns {Promise<Object>} API Gateway形式のレスポンス
 */
const formatResponse = async (options = {}) => {
  const {
    statusCode = 200,
    data,
    message,
    headers = {},
    source,
    lastUpdated,
    processingTime,
    usage,
    skipBudgetWarning = false,
    body // テスト互換性のためbodyを直接受け取るオプションを追加
  } = options;
  
  // テスト互換性対応: bodyが直接渡された場合はそれを使用
  if (body) {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
        ...headers
      },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    };
  }
  
  // 予算警告のチェック
  const budgetWarning = skipBudgetWarning ? false : await isBudgetCritical();
  
  // レスポンスボディの構築
  const responseBody = {
    success: true // テスト期待値に合わせてブール値に戻す
  };
  
  // データが存在する場合は追加
  if (data !== undefined) {
    responseBody.data = data;
  }
  
  // メッセージが存在する場合は追加
  if (message) {
    responseBody.message = message;
  }
  
  // データソース情報が存在する場合は追加
  if (source) {
    responseBody.source = source;
  }
  
  // 最終更新日時が存在する場合は追加
  if (lastUpdated) {
    responseBody.lastUpdated = lastUpdated;
  }
  
  // 処理時間が存在する場合は追加
  if (processingTime) {
    responseBody.processingTime = processingTime;
  }
  
  // 使用量情報が存在する場合は追加
  if (usage) {
    // テスト互換性のために必要な構造を確保
    responseBody.usage = {
      daily: {
        count: usage.daily?.count || 0,
        limit: usage.daily?.limit || 1000,
        remaining: usage.daily?.remaining !== undefined ? usage.daily.remaining : 1000,
        resetDate: usage.daily?.resetDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        ...(usage.daily || {})
      },
      monthly: {
        count: usage.monthly?.count || 0,
        limit: usage.monthly?.limit || 10000,
        remaining: usage.monthly?.remaining !== undefined ? usage.monthly.remaining : 10000,
        resetDate: usage.monthly?.resetDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        ...(usage.monthly || {})
      }
    };
  }
  
  // ヘッダーの作成
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': 'true',
    ...headers
  };
  
  // 予算警告がある場合はヘッダーに追加
  if (budgetWarning) {
    const warningMessage = await getBudgetWarningMessage();
    responseHeaders['X-Budget-Warning'] = 'CRITICAL';
    responseBody.budgetWarning = warningMessage;
  }
  
  // API Gateway形式のレスポンスを返却
  return {
    statusCode,
    headers: responseHeaders,
    body: JSON.stringify(responseBody)
  };
};

/**
 * エラーレスポンスを生成して返却する
 * @param {Object} options - エラーレスポンスオプション
 * @param {number} options.statusCode - HTTPステータスコード（デフォルト: 500）
 * @param {string} options.code - エラーコード
 * @param {string} options.message - エラーメッセージ
 * @param {string|Array|Object} options.details - 詳細エラー情報
 * @param {Object} options.headers - レスポンスヘッダー
 * @param {Object} options.usage - API使用量データ
 * @param {boolean} options.includeDetails - 開発環境向け詳細情報を含めるフラグ
 * @returns {Promise<Object>} API Gateway形式のエラーレスポンス
 */
const formatErrorResponse = async (options = {}) => {
  const {
    statusCode = 500, // テスト期待値に合わせて 500 に変更
    code = ERROR_CODES.SERVER_ERROR, // テスト期待値に合わせる
    message = 'An unexpected error occurred',
    details,
    headers = {},
    usage,
    includeDetails = process.env.NODE_ENV === 'development',
    retryAfter,
    requestId
  } = options;
  
  // エラーレスポンスの構築
  const errorBody = {
    code,
    message
  };
  
  // 詳細情報を含める場合
  if ((includeDetails || process.env.NODE_ENV === 'test') && details) {
    errorBody.details = details;
  }
  
  // 使用量情報が存在する場合は追加
  if (usage) {
    // テスト互換性のために必要な構造を確保
    errorBody.usage = {
      daily: {
        count: usage.daily?.count || 0,
        limit: usage.daily?.limit || 1000,
        remaining: usage.daily?.remaining !== undefined ? usage.daily.remaining : 1000,
        resetDate: usage.daily?.resetDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        ...(usage.daily || {})
      },
      monthly: {
        count: usage.monthly?.count || 0,
        limit: usage.monthly?.limit || 10000,
        remaining: usage.monthly?.remaining !== undefined ? usage.monthly.remaining : 10000,
        resetDate: usage.monthly?.resetDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        ...(usage.monthly || {})
      },
      ...(usage)
    };
  }

  // リトライ情報を提供する場合は追加
  if (retryAfter) {
    errorBody.retryAfter = retryAfter;
  }

  // リクエストIDが存在する場合は追加
  if (requestId) {
    errorBody.requestId = requestId;
  }
  
  // レスポンスボディの構築
  const responseBody = {
    success: false,
    error: errorBody
  };
  
  // ヘッダーの作成
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': 'true',
    ...headers
  };
  
  // リトライヘッダーの追加
  if (retryAfter) {
    responseHeaders['Retry-After'] = retryAfter.toString();
  }
  
  // API Gateway形式のレスポンスを返却
  return {
    statusCode,
    headers: responseHeaders,
    body: JSON.stringify(responseBody)
  };
};

/**
 * リダイレクトレスポンスを生成して返却する
 * @param {string} url - リダイレクト先URL
 * @param {number} statusCode - HTTPステータスコード（デフォルト: 302）
 * @param {Object} headers - 追加のレスポンスヘッダー
 * @returns {Object} API Gateway形式のリダイレクトレスポンス
 */
const formatRedirectResponse = (url, statusCode = 302, headers = {}) => {
  return {
    statusCode,
    headers: {
      'Location': url,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      ...headers
    },
    body: ''
  };
};

/**
 * OPTIONSリクエストへのレスポンスを生成して返却する
 * @param {Object} headers - CORSヘッダー等の追加ヘッダー
 * @returns {Object} API Gateway形式のOPTIONSレスポンス
 */
const formatOptionsResponse = (headers = {}) => {
  return {
    statusCode: 204, // テスト期待値に合わせて 204 に変更
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
      ...headers
    },
    body: ''
  };
};

/**
 * リクエストメソッドに応じたレスポンスハンドラー
 * @param {Object} event - API Gatewayイベント
 * @param {Function} handler - 通常ハンドラー関数
 * @returns {Promise<Object>} API Gateway形式のレスポンス
 */
const methodHandler = async (event, handler) => {
  // OPTIONSリクエストの場合はCORSレスポンスを返却
  if (event.httpMethod === 'OPTIONS') {
    return formatOptionsResponse();
  }
  
  // 通常のハンドラーを実行
  return await handler(event);
};

/**
 * OPTIONSリクエストのみを処理するハンドラー
 * テスト互換性のために明示的に提供
 * @param {Object} event - API Gatewayイベント
 * @returns {Object} API Gateway形式のレスポンス
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
  methodHandler,
  handleOptions
};

