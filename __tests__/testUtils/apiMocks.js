/**
 * ファイルパス: __tests__/testUtils/apiMocks.js
 * 
 * API呼び出しをモック化するユーティリティ関数を提供します。
 * axios のモック化とAPIレスポンスのシミュレーションを行います。
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-15
 * @updated 2025-05-18
 */

'use strict';

const axios = require('axios');

// モック設定を保持する配列
let mockConfigurations = [];

/**
 * APIリクエストをモック化する
 * @param {string} url - モック化するURL
 * @param {string} method - HTTPメソッド（'GET', 'POST'など）
 * @param {Object|Function} response - レスポンスデータまたはレスポンス生成関数
 * @param {number} [status=200] - HTTPステータスコード
 * @param {Object} [headers={}] - レスポンスヘッダー
 * @param {Object} [options={}] - 追加オプション（queryParams, bodyParamsなど）
 */
const mockApiRequest = (url, method, response, status = 200, headers = {}, options = {}) => {
  mockConfigurations.push({
    url,
    method: method.toUpperCase(),
    response,
    status,
    headers,
    options,
    callCount: 0
  });
  
  console.log(`Mocked API: ${method.toUpperCase()} ${url}`);
};

/**
 * すべてのAPIモックをリセットする
 */
const resetApiMocks = () => {
  mockConfigurations = [];
  jest.clearAllMocks();
};

/**
 * クエリパラメータが一致するかチェックする
 * @param {Object} requestParams - リクエストのクエリパラメータ
 * @param {Object} expectedParams - 期待されるクエリパラメータ
 * @returns {boolean} - パラメータが一致するか
 */
const doQueryParamsMatch = (requestParams, expectedParams) => {
  if (!expectedParams) return true;
  if (!requestParams) return false;
  
  for (const [key, value] of Object.entries(expectedParams)) {
    if (requestParams[key] !== value) {
      return false;
    }
  }
  
  return true;
};

/**
 * ボディパラメータが一致するかチェックする
 * @param {Object} requestBody - リクエストのボディ
 * @param {Object} expectedBody - 期待されるボディ
 * @returns {boolean} - ボディが一致するか
 */
const doBodyParamsMatch = (requestBody, expectedBody) => {
  if (!expectedBody) return true;
  if (!requestBody) return false;
  
  // JSON文字列の場合はパース
  const parsedRequestBody = typeof requestBody === 'string'
    ? JSON.parse(requestBody)
    : requestBody;
  
  for (const [key, value] of Object.entries(expectedBody)) {
    if (JSON.stringify(parsedRequestBody[key]) !== JSON.stringify(value)) {
      return false;
    }
  }
  
  return true;
};

// axiosのリクエストメソッドをモック化
jest.mock('axios');

// axiosのモック実装
axios.request.mockImplementation(async (config) => {
  const { method = 'GET', url, params, data, headers } = config;
  
  // リクエストのデバッグ情報
  console.log(`Mock axios ${method} request to ${url}`);
  if (params) console.log('  Query params:', params);
  if (data) console.log('  Request body:', typeof data === 'string' ? data : JSON.stringify(data));
  
  // マッチするモック設定を検索
  for (const mock of mockConfigurations) {
    // URLとメソッドが一致するか
    const urlMatches = url.startsWith(mock.url);
    const methodMatches = method.toUpperCase() === mock.method;
    
    // クエリパラメータとボディパラメータが一致するか
    const queryParamsMatch = doQueryParamsMatch(
      params,
      mock.options.queryParams
    );
    
    const bodyParamsMatch = doBodyParamsMatch(
      data,
      mock.options.bodyParams
    );
    
    // すべての条件が一致すればこのモックを使用
    if (urlMatches && methodMatches && queryParamsMatch && bodyParamsMatch) {
      mock.callCount++;
      
      // レスポンスが関数の場合は実行して結果を取得
      const responseData = typeof mock.response === 'function'
        ? mock.response(params, data, headers)
        : mock.response;
      
      console.log(`  Found matching mock (call #${mock.callCount})`);
      
      // 成功レスポンスを返す
      return {
        data: responseData,
        status: mock.status,
        headers: mock.headers,
        config
      };
    }
  }
  
  // マッチするモックが見つからない場合
  console.error(`No matching mock found for ${method} ${url}`);
  throw new Error(`No matching mock for ${method} ${url}`);
});

// axios.get, axios.post などのショートカットメソッドをモック化
axios.get.mockImplementation((url, config = {}) => {
  return axios.request({ ...config, url, method: 'GET' });
});

axios.post.mockImplementation((url, data, config = {}) => {
  return axios.request({ ...config, url, method: 'POST', data });
});

axios.put.mockImplementation((url, data, config = {}) => {
  return axios.request({ ...config, url, method: 'PUT', data });
});

axios.delete.mockImplementation((url, config = {}) => {
  return axios.request({ ...config, url, method: 'DELETE' });
});

axios.patch.mockImplementation((url, data, config = {}) => {
  return axios.request({ ...config, url, method: 'PATCH', data });
});

module.exports = {
  mockApiRequest,
  resetApiMocks
};
