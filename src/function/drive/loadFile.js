/**
 * Google Driveファイル保存ハンドラー - ポートフォリオデータの保存
 * 
 * @file src/function/drive/saveFile.js
 * @author Koki Riho
 * @created 2025-05-12
 */
'use strict';

const { 
  getSession,
  refreshAccessToken,
  savePortfolioToDrive 
} = require('../../services/googleAuthService');
const { formatResponse, formatErrorResponse } = require('../../utils/response');
const { parseCookies } = require('../../utils/cookieParser');

/**
 * Google Driveデータ保存ハンドラー
 * @param {Object} event - API Gatewayイベント
 * @returns {Object} - API Gatewayレスポンス
 */
exports.handler = async (event) => {
  try {
    // Cookieからセッションを取得
    const cookies = parseCookies(event.headers.Cookie || event.headers.cookie || '');
    const sessionId = cookies.session;
    
    if (!sessionId) {
      return formatErrorResponse({
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
          'Access-Control-Allow-Credentials': 'true'
        },
        message: 'セッションが存在しません'
      });
    }
    
    // セッション情報を取得
    const session = await getSession(sessionId);
    
    if (!session) {
      return formatErrorResponse({
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
          'Access-Control-Allow-Credentials': 'true'
        },
        message: 'セッションが無効です'
      });
    }
    
    // リクエストボディを解析
    const requestBody = JSON.parse(event.body || '{}');
    const { portfolioData } = requestBody;
    
    if (!portfolioData) {
      return formatErrorResponse({
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
          'Access-Control-Allow-Credentials': 'true'
        },
        message: 'ポートフォリオデータが不足しています'
      });
    }
    
    // アクセストークンの有効期限をチェック
    const tokenExpiry = new Date(session.tokenExpiry);
    const now = new Date();
    let accessToken = session.accessToken;
    
    // トークンが期限切れの場合は更新
    if (tokenExpiry <= now && session.refreshToken) {
      try {
        const newTokens = await refreshAccessToken(session.refreshToken);
        accessToken = newTokens.access_token;
      } catch (refreshError) {
        console.error('トークン更新エラー:', refreshError);
        return formatErrorResponse({
          statusCode: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
            'Access-Control-Allow-Credentials': 'true'
          },
          message: 'アクセストークンの更新に失敗しました'
        });
      }
    }
    
    // Google Driveにデータを保存
    const result = await savePortfolioToDrive(accessToken, portfolioData);
    
    // レスポンスヘッダー
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Credentials': 'true'
    };
    
    // レスポンスを整形
    return formatResponse({
      statusCode: 200,
      headers,
      data: {
        success: true,
        message: 'ポートフォリオデータをGoogle Driveに保存しました',
        file: {
          id: result.fileId,
          name: result.fileName,
          url: result.webViewLink,
          createdAt: result.createdTime
        }
      },
      source: 'Google Drive API',
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Drive保存エラー:', error);
    return formatErrorResponse({
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      message: 'Google Driveへの保存に失敗しました: ' + error.message
    });
  }
};
