/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/utils/response.js
 * 
 * 説明: 
 * API レスポンスを標準化されたフォーマットで整形するユーティリティ関数。
 * 成功レスポンスとエラーレスポンスの両方に一貫したフォーマットを提供します。
 */

/**
 * 成功レスポンスを整形する
 * @param {Object} options - レスポンスオプション
 * @param {number} options.statusCode - HTTPステータスコード
 * @param {Object} options.headers - レスポンスヘッダー
 * @param {Object} options.data - レスポンスデータ
 * @param {string} options.source - データソース情報
 * @param {string} options.lastUpdated - 最終更新日時
 * @param {string} options.processingTime - 処理時間
 * @param {Object} options.usage - 使用量情報
 * @returns {Object} 整形されたレスポンス
 */
const formatResponse = ({
  statusCode = 200,
  headers = {},
  data = {},
  source = 'AWS Lambda',
  lastUpdated = new Date().toISOString(),
  processingTime = '',
  usage = null
}) => {
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
    headers,
    body: JSON.stringify(responseBody)
  };
};

/**
 * エラーレスポンスを整形する
 * @param {Object} options - エラーレスポンスオプション
 * @param {number} options.statusCode - HTTPステータスコード
 * @param {Object} options.headers - レスポンスヘッダー
 * @param {string} options.message - エラーメッセージ
 * @param {Object} options.usage - 使用量情報（オプション）
 * @returns {Object} 整形されたエラーレスポンス
 */
const formatErrorResponse = ({
  statusCode = 500,
  headers = {},
  message = 'サーバー内部エラーが発生しました',
  usage = null
}) => {
  const responseBody = {
    success: false,
    error: {
      message
    }
  };

  if (usage) {
    responseBody.usage = usage;
  }

  return {
    statusCode,
    headers,
    body: JSON.stringify(responseBody)
  };
};

module.exports = {
  formatResponse,
  formatErrorResponse
};
