/**
 * Google Driveファイル保存ハンドラー - ポートフォリオデータの保存
 * 
 * @file src/function/drive/saveFile.js
 * @author Portfolio Manager Team
 * @created 2025-05-12
 * @updated 2025-05-13
 */
'use strict';

const { 
  getSession,
  refreshAccessToken,
  savePortfolioToDrive 
} = require('../../services/googleAuthService');
const { formatResponse, formatErrorResponse } = require('../../utils/responseFormatter');
const { parseCookies } = require('../../utils/cookieParser');

/**
 * Google Driveデータ保存ハンドラー
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
    
    // リクエストボディを解析
    const requestBody = JSON.parse(event.body || '{}');
    const { portfolioData } = requestBody;
    
    if (!portfolioData) {
      return formatErrorResponse({
        statusCode: 400,
        code: 'INVALID_PARAMS',
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
          code: 'TOKEN_REFRESH_ERROR',
          message: 'アクセストークンの更新に失敗しました',
          details: refreshError.message
        });
      }
    }
    
    // Google Driveにデータを保存
    const result = await savePortfolioToDrive(accessToken, portfolioData);
    
    // レスポンスを整形
    return formatResponse({
      statusCode: 200,
      body: {
        success: true,
        message: 'ポートフォリオデータをGoogle Driveに保存しました',
        file: {
          id: result.fileId,
          name: result.fileName,
          url: result.webViewLink,
          createdAt: result.createdTime
        }
      }
    });
  } catch (error) {
    console.error('Drive保存エラー:', error);
    return formatErrorResponse({
      statusCode: 500,
      code: 'DRIVE_SAVE_ERROR',
      message: 'Google Driveへの保存に失敗しました',
      details: error.message
    });
  }
};
