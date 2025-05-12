/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/utils/responseUtils.js
 * 
 * 説明: 
 * API レスポンスを標準化する共通ユーティリティ。
 * 成功レスポンス、エラーレスポンス、リダイレクトレスポンスを
 * 一貫したフォーマットで提供します。
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-15
 */
'use strict';

const { ENV } = require('../config/envConfig');
const { ERROR_CODES, RESPONSE_FORMATS } = require('../config/constants');

/**
 * 成功レスポンスを整形する
 * @param {Object} options - レスポンスオプション
 * @param {number} [options.statusCode=200] - HTTPステータスコード
 * @param {Object} [options.data={}] - レスポンスデータ
 * @param {Object} [options.headers={}] - レスポンスヘッダー
 * @param {string} [options.source='AWS Lambda'] - データソース情報
 * @param {string} [options.lastUpdated] - 最終更新日時
 * @param {string} [options.processingTime=''] - 処理時間
 * @param {Object} [options.usage=null] - 使用量情報
 * @returns {Object} 整形されたレスポンス
 */
const formatResponse = (options = {}) => {
  const {
    statusCode = 200,
    data = {},
    headers = {},
    source = 'AWS Lambda',
    lastUpdated = new Date().toISOString(),
    processingTime = '',
    usage = null
  } = options;

  // デフォルトのCORSヘッダーを設定
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ENV.CORS_ALLOW_ORIGIN,
    'Access-Control-Allow-Credentials': 'true'
  };

  // レスポンスボディを構築
  const responseBody = {
    success: true,
    data,
    source,
    lastUpdated
  };

  // オプションフィールドを追加
  if (processingTime) {
    responseBody.processingTime = processingTime;
  }

  if (usage) {
    responseBody.usage = usage;
  }

  return {
    statusCode,
    headers: { ...defaultHeaders, ...headers },
    body: JSON.stringify(responseBody)
  };
};

/**
 * エラーレスポンスを整形する
 * @param {Object} options - エラーレスポンスオプション
 * @param {number} [options.statusCode=500] - HTTPステータスコード
 * @param {string} [options.code] - エラーコード
 * @param {string} [options.message='サーバー内部エラーが発生しました'] - エラーメッセージ
 * @param {string} [options.details=null] - 詳細情報（開発環境のみ）
 * @param {Object} [options.headers={}] - レスポンスヘッダー
 * @param {Object} [options.usage=null] - 使用量情報
 * @returns {Object} 整形されたエラーレスポンス
 */
const formatErrorResponse = (options = {}) => {
  const {
    statusCode = 500,
    code = ERROR_CODES.SERVER_ERROR,
    message = 'サーバー内部エラーが発生しました',
    details = null,
    headers = {},
    usage = null
  } = options;

  // デフォルトのCORSヘッダー
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ENV.CORS_ALLOW_ORIGIN,
    'Access-Control-Allow-Credentials': 'true'
  };

  // エラーボディを構築
  const errorBody = {
    success: false,
    error: {
      code,
      message
    }
  };

  // 開発環境の場合は詳細情報も含める
  if (details && (ENV.NODE_ENV === 'development' || ENV.NODE_ENV === 'test')) {
    errorBody.error.details = details;
  }

  // 使用量情報がある場合は追加
  if (usage) {
    errorBody.usage = usage;
  }

  return {
    statusCode,
    headers: { ...defaultHeaders, ...headers },
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
      'Access-Control-Allow-Origin': ENV.CORS_ALLOW_ORIGIN,
      'Access-Control-Allow-Credentials': 'true'
    },
    body: ''
  };
};

/**
 * OPTIONSリクエストのレスポンスを作成する（CORS対応）
 * @param {Object} [headers={}] - 追加のレスポンスヘッダー
 * @returns {Object} - API Gatewayレスポンス
 */
const formatOptionsResponse = (headers = {}) => {
  const defaultHeaders = {
    'Access-Control-Allow-Origin': ENV.CORS_ALLOW_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true'
  };

  return {
    statusCode: 204,
    headers: { ...defaultHeaders, ...headers },
    body: ''
  };
};

/**
 * APIリクエストのOPTIONSメソッドをハンドルする
 * @param {Object} event - API Gatewayイベント
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
