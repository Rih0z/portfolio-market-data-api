/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/functions/admin/getStatus.js
 * 
 * 説明: 
 * API使用状況とキャッシュ情報を取得する管理者向けAPIエンドポイント。
 * アクセスにはAPI Keyによる認証が必要です。
 * 日次・月次の使用量、キャッシュ内容、設定情報などを取得できます。
 */
const cacheService = require('../../services/cache');
const usageService = require('../../services/usage');
const { ADMIN, CACHE_TIMES } = require('../../config/constants');

/**
 * API使用状況とキャッシュ情報を取得するハンドラー
 * @param {Object} event - Lambda イベントオブジェクト
 * @param {Object} context - Lambda コンテキスト
 * @returns {Object} ステータス情報
 */
exports.handler = async (event, context) => {
  // CORS ヘッダー設定
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  // OPTIONSリクエストをハンドル
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }
  
  try {
    // API Key認証
    const apiKey = event.headers['x-api-key'];
    
    if (!apiKey || apiKey !== ADMIN.API_KEY) {
      console.warn('Invalid API key provided');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: '無効なAPIキーです'
        })
      };
    }
    
    // 使用量統計を取得
    const usageStats = await usageService.getUsageStats();
    
    // キャッシュ統計を取得
    const cacheStats = await cacheService.getStats();
    
    // 設定情報
    const config = {
      disableOnLimit: process.env.DISABLE_ON_LIMIT === 'true',
      cacheTimes: CACHE_TIMES,
      adminEmail: ADMIN.EMAIL ? ADMIN.EMAIL.substring(0, 3) + '...@' + ADMIN.EMAIL.split('@')[1] : 'Not configured'
    };
    
    // 情報をまとめる
    const statusInfo = {
      success: true,
      timestamp: new Date().toISOString(),
      usage: usageStats.current,
      history: usageStats.history,
      cache: cacheStats,
      config
    };
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(statusInfo)
    };
  } catch (error) {
    console.error('Error getting status information:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'ステータス情報の取得に失敗しました',
        message: error.message
      })
    };
  }
};
