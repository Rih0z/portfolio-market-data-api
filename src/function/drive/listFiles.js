/**
 * Google Driveファイル一覧取得ハンドラー - ポートフォリオデータファイル一覧
 * 
 * @file src/function/drive/listFiles.js
 * @author Koki Riho
 * @created 2025-05-12
 */
'use strict';

const { 
  getSession,
  refreshAccessToken,
  listPortfolioFiles 
} = require('../../services/googleAuthService');
const { formatResponse, formatErrorResponse } = require('../../utils/response');
const { parseCookies } = require('../../utils/cookieParser');

/**
 * Google Driveファイル一覧取得ハンドラー
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
    
    // Google Driveのファイル一覧を取得
    const files = await listPortfolioFiles(accessToken);
    
    // ファイル情報を整形
    const formattedFiles = files.map(file => ({
      id: file.id,
      name: file.name,
      size: file.size ? parseInt(file.size, 10) : 0,
      mimeType: file.mimeType,
      createdAt: file.createdTime,
      modifiedAt: file.modifiedTime,
      webViewLink: file.webViewLink
    }));
    
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
        files: formattedFiles,
        count: formattedFiles.length
      },
      source: 'Google Drive API',
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Driveファイル一覧取得エラー:', error);
    return formatErrorResponse({
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      message: 'Google Driveのファイル一覧取得に失敗しました: ' + error.message
    });
  }
};
