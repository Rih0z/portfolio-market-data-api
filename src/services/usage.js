/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/services/usage.js
 * 
 * 説明:
 * フォールバックデータストアサービス - プロキシモジュール。
 * このモジュールは src/services/fallbackDataStore.js へのプロキシとして機能します。
 * 
 * 警告：
 * このファイルは完全に非推奨です。すべての呼び出しは処理を停止します。
 * 直接 fallbackDataStore.js を使用してください。
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

// 非推奨警告を表示する関数 - 常に処理を停止
const showDeprecationWarning = (methodName) => {
  return warnDeprecation(
    `usage.js の ${methodName}`,
    `fallbackDataStore.js の同等メソッド`,
    {
      version: '2.0.0',
      removalVersion: '3.0.0',
      throwError: true // 必ず処理を停止する
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
  // 下記のコードは実行されません（前の行でエラーがスローされる）
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
  // 下記のコードは実行されません（前の行でエラーがスローされる）
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
  // 下記のコードは実行されません（前の行でエラーがスローされる）
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
  // 下記のコードは実行されません（前の行でエラーがスローされる）
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
  // 下記のコードは実行されません（前の行でエラーがスローされる）
  return fallbackDataStore.updateFallbackData(dataType, dataItems);
};

module.exports = {
  recordFailedFetch,
  getFallbackForSymbol,
  getDefaultFallbackData,
  saveFallbackData,
  updateFallbackData
};
