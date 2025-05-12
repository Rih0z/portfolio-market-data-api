/**
 * Google Driveファイル一覧取得ハンドラー - ポートフォリオデータファイル一覧
 * 
 * @file src/function/drive/listFiles.js
 * @author Koki Riho
 * @created 2025-05-12
 * @updated 2025-05-13
 */
'use strict';

const { 
  getSession,
  refreshAccessToken,
  listPortfolioFiles 
} = require('../../services/googleAuthService');
const { formatResponse, formatErrorResponse } = require('../../utils/responseFormatter');
const { parseCookies } = require('../../utils/cookieParser');

/**
 * Google Driveファイル一覧取得ハンドラー
 * @param {Object} event - API Gatewayイベント
 * @returns {Object} - API Gatewayレスポンス
 */
module.exports.handler = async (event) => {
  try {
    // Cookieからセッションを取得
    const cookies = parseCookies(event.headers.Cookie || event.headers.cookie || '');
    const sessionId = cookies.session;
    
    if (!sessionId) {
      return formatErrorResponse({
        statusCode: 401,
        code: 'NO_SESSION',
        message: 'セッションが存在しません'
      });
    }
    
    // セッション情報を取得
    const session = await getSession(sessionId);
    
    if (!session) {
      return formatErrorResponse({
        statusCode: 401,
        code: 'INVALID_SESSION',
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
          code: 'TOKEN_REFRESH_ERROR',
          message: 'アクセストークンの更新に失敗しました',
          details: refreshError.message
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
    
    // レスポンスを整形
    return formatResponse({
      statusCode: 200,
      body: {
        success: true,
        files: formattedFiles,
        count: formattedFiles.length
      }
    });
  } catch (error) {
    console.error('Driveファイル一覧取得エラー:', error);
    return formatErrorResponse({
      statusCode: 500,
      code: 'DRIVE_LIST_ERROR',
      message: 'Google Driveのファイル一覧取得に失敗しました',
      details: error.message
    });
  }
};

