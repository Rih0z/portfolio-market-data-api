/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/services/usage.js
 * 
 * 説明:
 * フォールバックデータストアサービス - プロキシモジュール。
 * このモジュールは src/services/fallbackDataStore.js へのプロキシとして機能します。
 * 
 * 警告：
 * このファイルは完全に非推奨です。直接 fallbackDataStore.js を使用してください。
 * このモジュールは v3.0.0 で削除される予定です。
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-11
 * @updated 2025-05-21 fallbackDataStoreへの統合完了
 * 
 * @deprecated v3.0.0 以降では fallbackDataStore.js を直接使用してください。このモジュールは削除される予定です。
 */
'use strict';

const fallbackDataStore = require('./fallbackDataStore');
const { warnDeprecation } = require('../utils/deprecation');
const { ENV } = require('../config/envConfig');
const { PutCommand, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { getDynamoDb } = require('../utils/awsConfig');
const { withRetry } = require('../utils/retry');
const logger = require('../utils/logger');

// Usage table name
const USAGE_TABLE = process.env.USAGE_TABLE || `${process.env.DYNAMODB_TABLE_PREFIX || 'portfolio-market-data-'}usage`;

/**
 * 環境に基づいて非推奨機能の処理方法を決定する
 * テスト環境では警告のみ、開発環境では処理を停止
 * @returns {boolean} 例外をスローする場合はtrue
 */
const shouldThrowDeprecationError = () => {
  // document/test-plan.md では 'test' 環境ではテストの実行に支障が出ないよう、
  // 警告は出すが処理は継続することが望ましいとされています
  return ENV.NODE_ENV === 'development' || ENV.NODE_ENV !== 'test';
};

/**
 * 非推奨警告を表示する関数
 * @param {string} methodName - メソッド名
 * @returns {string} - 警告メッセージ
 */
const showDeprecationWarning = (methodName) => {
  return warnDeprecation(
    `usage.js の ${methodName}`,
    `fallbackDataStore.js の同等メソッド`,
    {
      version: '2.0.0',
      removalVersion: '3.0.0',
      throwError: shouldThrowDeprecationError() // 環境に基づいて例外をスローするかどうかを決定
    }
  );
};

/**
 * データ取得に失敗した記録を保存する
 * @param {string} symbol - 証券コードまたはティッカーシンボル
 * @param {string} dataType - データタイプ
 * @param {string|Error} errorInfo - エラー情報
 * @returns {Promise<boolean>} 記録成功時はtrue
 * @deprecated fallbackDataStore.js の recordFailedFetch を使用してください。このモジュールはv3.0.0で削除されます。
 */
const recordFailedFetch = async (symbol, dataType, errorInfo) => {
  showDeprecationWarning('recordFailedFetch');
  // 下記のコードはテスト環境でのみ実行されます
  return fallbackDataStore.recordFailedFetch(symbol, dataType, errorInfo);
};

/**
 * 特定のシンボルのフォールバックデータを取得する
 * @param {string} symbol - 証券コードまたはティッカーシンボル
 * @param {string} dataType - データタイプ
 * @returns {Promise<Object|null>} フォールバックデータ（存在しない場合はnull）
 * @deprecated fallbackDataStore.js の getFallbackForSymbol を使用してください。このモジュールはv3.0.0で削除されます。
 */
const getFallbackForSymbol = async (symbol, dataType) => {
  showDeprecationWarning('getFallbackForSymbol');
  // 下記のコードはテスト環境でのみ実行されます
  return fallbackDataStore.getFallbackForSymbol(symbol, dataType);
};

/**
 * デフォルトのフォールバックデータを取得する
 * @param {string} symbol - 証券コードまたはティッカーシンボル
 * @param {string} dataType - データタイプ
 * @returns {Object|null} デフォルトのフォールバックデータ
 * @deprecated fallbackDataStore.js の getDefaultFallbackData を使用してください。このモジュールはv3.0.0で削除されます。
 */
const getDefaultFallbackData = (symbol, dataType) => {
  showDeprecationWarning('getDefaultFallbackData');
  // 下記のコードはテスト環境でのみ実行されます
  return fallbackDataStore.getDefaultFallbackData(symbol, dataType);
};

/**
 * フォールバックデータを保存する
 * @param {string} symbol - 証券コードまたはティッカーシンボル
 * @param {string} dataType - データタイプ
 * @param {Object} data - 保存するデータ
 * @returns {Promise<boolean>} 保存成功時はtrue
 * @deprecated fallbackDataStore.js の saveFallbackData を使用してください。このモジュールはv3.0.0で削除されます。
 */
const saveFallbackData = async (symbol, dataType, data) => {
  showDeprecationWarning('saveFallbackData');
  // 下記のコードはテスト環境でのみ実行されます
  return fallbackDataStore.saveFallbackData(symbol, dataType, data);
};

/**
 * フォールバックデータを更新する
 * @param {string} dataType - データタイプ
 * @param {Array<Object>} dataItems - 更新するデータの配列
 * @returns {Promise<Object>} 更新結果
 * @deprecated fallbackDataStore.js の updateFallbackData を使用してください。このモジュールはv3.0.0で削除されます。
 */
const updateFallbackData = async (dataType, dataItems) => {
  showDeprecationWarning('updateFallbackData');
  // 下記のコードはテスト環境でのみ実行されます
  return fallbackDataStore.updateFallbackData(dataType, dataItems);
};

// ---------------------------------------------------------------------------
// API usage tracking implementation
// ---------------------------------------------------------------------------

const getUsageRecord = async (key) => {
  const db = getDynamoDb();
  const command = new GetCommand({
    TableName: USAGE_TABLE,
    Key: { id: key }
  });
  const result = await withRetry(() => db.send(command));
  return result.Item ? result.Item.count : 0;
};

const incrementUsageRecord = async (key) => {
  const db = getDynamoDb();
  const command = new UpdateCommand({
    TableName: USAGE_TABLE,
    Key: { id: key },
    UpdateExpression: 'ADD #count :inc',
    ExpressionAttributeNames: { '#count': 'count' },
    ExpressionAttributeValues: { ':inc': 1 },
    ReturnValues: 'UPDATED_NEW'
  });
  const result = await withRetry(() => db.send(command));
  return result.Attributes.count;
};

const formatUsage = (dailyCount, monthlyCount) => ({
  daily: {
    count: dailyCount,
    limit: ENV.DAILY_REQUEST_LIMIT,
    percentage: Math.round((dailyCount / ENV.DAILY_REQUEST_LIMIT) * 100)
  },
  monthly: {
    count: monthlyCount,
    limit: ENV.MONTHLY_REQUEST_LIMIT,
    percentage: Math.round((monthlyCount / ENV.MONTHLY_REQUEST_LIMIT) * 100)
  }
});

/**
 * 使用量を確認して更新する
 * @param {Object} params - リクエスト情報
 * @returns {Promise<{allowed:boolean, usage:Object}>}
 */
const checkAndUpdateUsage = async (params = {}) => {
  const now = new Date();
  const dayKey = `daily:${now.toISOString().slice(0, 10)}`;
  const monthKey = `monthly:${now.toISOString().slice(0, 7)}`;

  const [dailyCount, monthlyCount] = await Promise.all([
    incrementUsageRecord(dayKey),
    incrementUsageRecord(monthKey)
  ]);

  const usage = formatUsage(dailyCount, monthlyCount);
  const allowed =
    dailyCount <= ENV.DAILY_REQUEST_LIMIT &&
    monthlyCount <= ENV.MONTHLY_REQUEST_LIMIT;

  logger.info('API usage updated', { usage });

  return { allowed, usage };
};

/**
 * 使用統計を取得する
 * @returns {Promise<{current:Object, history:Array}>}
 */
const getUsageStats = async () => {
  const now = new Date();
  const dayKey = `daily:${now.toISOString().slice(0, 10)}`;
  const monthKey = `monthly:${now.toISOString().slice(0, 7)}`;

  const [dailyCount, monthlyCount] = await Promise.all([
    getUsageRecord(dayKey),
    getUsageRecord(monthKey)
  ]);

  return {
    current: formatUsage(dailyCount, monthlyCount),
    history: []
  };
};

/**
 * 使用量カウンターをリセットする
 * @param {string} type - 'daily' | 'monthly' | 'all'
 * @returns {Promise<Object>} 結果
 */
const resetUsage = async (type = 'daily') => {
  const now = new Date();
  const tasks = [];

  if (type === 'daily' || type === 'all') {
    const key = `daily:${now.toISOString().slice(0, 10)}`;
    tasks.push(
      withRetry(() =>
        getDynamoDb().send(
          new PutCommand({ TableName: USAGE_TABLE, Item: { id: key, count: 0 } })
        )
      )
    );
  }

  if (type === 'monthly' || type === 'all') {
    const key = `monthly:${now.toISOString().slice(0, 7)}`;
    tasks.push(
      withRetry(() =>
        getDynamoDb().send(
          new PutCommand({ TableName: USAGE_TABLE, Item: { id: key, count: 0 } })
        )
      )
    );
  }

  await Promise.all(tasks);
  logger.info(`Usage counters reset: ${type}`);
  return { result: true };
};

/**
 * ユーザーごとの使用率を取得する（簡易実装）
 * @param {string} userId - ユーザーID
 * @param {string} period - 'daily' | 'monthly'
 * @returns {Promise<Object>} 使用率
 */
const getUserRate = async (userId, period = 'daily') => {
  const now = new Date();
  const keySuffix = period === 'daily'
    ? now.toISOString().slice(0, 10)
    : now.toISOString().slice(0, 7);
  const key = `user:${userId}:${period}:${keySuffix}`;
  const count = await getUsageRecord(key);
  const limit = period === 'daily' ? ENV.DAILY_REQUEST_LIMIT : ENV.MONTHLY_REQUEST_LIMIT;
  return {
    count,
    limit,
    percentage: Math.round((count / limit) * 100)
  };
};

module.exports = {
  recordFailedFetch,
  getFallbackForSymbol,
  getDefaultFallbackData,
  saveFallbackData,
  updateFallbackData,
  checkAndUpdateUsage,
  getUsageStats,
  resetUsage,
  getUserRate,
  // テスト用にヘルパー関数をエクスポート
  _shouldThrowDeprecationError: shouldThrowDeprecationError
};
