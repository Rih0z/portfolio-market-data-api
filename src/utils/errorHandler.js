/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/utils/errorHandler.js
 * 
 * 説明: 
 * エラー処理を一元化するユーティリティ。
 * エラータイプに応じた処理を行い、ログ出力やアラート通知を統一的に実行します。
 * アプリケーション全体で一貫したエラーハンドリングを提供します。
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-17
 */
'use strict';

const alertService = require('../services/alerts');
const logger = require('./logger');
const { ERROR_CODES } = require('../config/constants');

/**
 * エラータイプの定義
 */
const errorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DATA_SOURCE_ERROR: 'DATA_SOURCE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  CRITICAL_ERROR: 'CRITICAL_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR'
};

/**
 * エラーコードとHTTPステータスコードのマッピング
 */
const statusCodes = {
  [errorTypes.VALIDATION_ERROR]: 400,
  [errorTypes.DATA_SOURCE_ERROR]: 502,
  [errorTypes.CACHE_ERROR]: 500,
  [errorTypes.AUTH_ERROR]: 401,
  [errorTypes.SERVER_ERROR]: 500,
  [errorTypes.CRITICAL_ERROR]: 500,
  [errorTypes.NETWORK_ERROR]: 503,
  [errorTypes.RATE_LIMIT_ERROR]: 429
};

/**
 * エラーコードとエラーメッセージのマッピング
 */
const defaultMessages = {
  [errorTypes.VALIDATION_ERROR]: 'リクエストパラメータが無効です',
  [errorTypes.DATA_SOURCE_ERROR]: 'データソースからの取得に失敗しました',
  [errorTypes.CACHE_ERROR]: 'キャッシュ操作中にエラーが発生しました',
  [errorTypes.AUTH_ERROR]: '認証に失敗しました',
  [errorTypes.SERVER_ERROR]: 'サーバー内部エラーが発生しました',
  [errorTypes.CRITICAL_ERROR]: '重大なエラーが発生しました',
  [errorTypes.NETWORK_ERROR]: 'ネットワークエラーが発生しました',
  [errorTypes.RATE_LIMIT_ERROR]: 'APIレート制限に達しました'
};

/**
 * エラーを一元的に処理する関数
 * @param {Error} error - エラーオブジェクト
 * @param {string} type - エラータイプ（errorTypesから選択）
 * @param {Object} context - 追加コンテキスト情報
 * @returns {Promise<Object>} エラー情報オブジェクト
 */
const handleError = async (error, type, context = {}) => {
  // エラー情報を構築
  const errorInfo = {
    code: context.code || ERROR_CODES.SERVER_ERROR,
    message: error.message || defaultMessages[type] || 'Unknown error occurred',
    type,
    timestamp: new Date().toISOString(),
    ...context
  };
  
  // エラータイプに応じたログ出力
  if (type === errorTypes.CRITICAL_ERROR) {
    logger.critical(`${type} Error Occurred`, error, context);
  } else {
    logger.error(`${type} Error Occurred`, error, context);
  }
  
  // 重要なエラーのみアラート送信
  if (
    type === errorTypes.CRITICAL_ERROR || 
    type === errorTypes.DATA_SOURCE_ERROR ||
    (context.alert === true)
  ) {
    try {
      await alertService.notifyError(
        `${type} Error Occurred`,
        error,
        {
          ...context,
          errorInfo
        }
      );
    } catch (alertError) {
      logger.error('Alert notification failed', alertError);
    }
  }
  
  return errorInfo;
};

/**
 * HTTP APIエラーレスポンスを生成する関数
 * @param {Error} error - エラーオブジェクト
 * @param {string} type - エラータイプ
 * @param {Object} context - 追加コンテキスト
 * @returns {Promise<Object>} APIレスポンスオブジェクト
 */
const createErrorResponse = async (error, type, context = {}) => {
  // エラー情報を取得
  const errorInfo = await handleError(error, type, context);
  
  // HTTPステータスコードを決定
  const statusCode = context.statusCode || statusCodes[type] || 500;
  
  // APIレスポンスを構築
  return {
    statusCode,
    body: JSON.stringify({
      success: false,
      error: {
        code: errorInfo.code,
        message: errorInfo.message,
        ...(context.includeDetails && { details: errorInfo.details || error.message })
      }
    })
  };
};

module.exports = { 
  handleError,
  createErrorResponse,
  errorTypes,
  statusCodes
};
