/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/utils/logger.js
 * 
 * 説明: 
 * ログ出力を標準化するユーティリティ。
 * アプリケーション全体で一貫したログフォーマットを提供し、
 * 開発環境と本番環境で適切なログレベルを制御します。
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-17
 */
'use strict';

const { ENV } = require('../config/envConfig');

/**
 * ログ出力を標準化するロガーオブジェクト
 */
const logger = {
  /**
   * デバッグレベルのログを出力（開発環境のみ）
   * @param {string} message - ログメッセージ
   * @param {*} data - 追加データ（オプション）
   */
  debug: (message, data) => {
    if (ENV.NODE_ENV === 'development' || ENV.NODE_ENV === 'test') {
      console.debug(`[DEBUG] ${new Date().toISOString()} ${message}`, data || '');
    }
  },
  
  /**
   * 情報レベルのログを出力
   * @param {string} message - ログメッセージ
   * @param {*} data - 追加データ（オプション）
   */
  info: (message, data) => {
    console.log(`[INFO] ${new Date().toISOString()} ${message}`, data || '');
  },
  
  /**
   * 警告レベルのログを出力
   * @param {string} message - ログメッセージ
   * @param {*} data - 追加データ（オプション）
   */
  warn: (message, data) => {
    console.warn(`[WARN] ${new Date().toISOString()} ${message}`, data || '');
  },
  
  /**
   * エラーレベルのログを出力
   * @param {string} message - ログメッセージ
   * @param {Error} error - エラーオブジェクト
   * @param {Object} context - 追加コンテキスト情報（オプション）
   */
  error: (message, error, context = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()} ${message}`, {
      errorMessage: error?.message || 'Unknown error',
      stack: error?.stack,
      ...context
    });
  },
  
  /**
   * 重大なエラーログを出力
   * @param {string} message - ログメッセージ
   * @param {Error} error - エラーオブジェクト
   * @param {Object} context - 追加コンテキスト情報（オプション）
   */
  critical: (message, error, context = {}) => {
    console.error(`[CRITICAL] ${new Date().toISOString()} ${message}`, {
      errorMessage: error?.message || 'Unknown error',
      stack: error?.stack,
      ...context
    });
  }
};

module.exports = logger;
