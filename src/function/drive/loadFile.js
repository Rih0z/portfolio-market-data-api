/**
 * Google Driveファイル読み込みハンドラー - ポートフォリオデータの読み込み
 * 
 * @file src/function/drive/loadFile.js
 * @author Portfolio Manager Team
 * @created 2025-05-13
 */
'use strict';

const { 
  getSession,
  refreshAccessToken,
  loadPortfolioFromDrive 
} = require('../../services/googleAuthService');
const { formatResponse, formatErrorResponse } = require('../../utils/responseFormatter');
const { parseCookies } = require('../../utils/cookieParser');

/**
 * Google Driveデータ読み込みハンドラー
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
    
    // クエリパラメータからファイルIDを取得
    const queryParams = event.queryStringParameters || {};
    const { fileId } = queryParams;
    
    if (!fileId) {
      return formatErrorResponse({
        statusCode: 400,
        code: 'INVALID_PARAMS',
        message: 'ファイルIDが不足しています'
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
    
    // Google Driveからデータを読み込み
    const result = await loadPortfolioFromDrive(accessToken, fileId);
    
    // レスポンスを整形
    return formatResponse({
      statusCode: 200,
      body: {
        success: true,
        message: 'ポートフォリオデータをGoogle Driveから読み込みました',
        file: {
          name: result.fileName,
          createdAt: result.createdTime,
          modifiedAt: result.modifiedTime
        },
        data: result.data
      }
    });
  } catch (error) {
    console.error('Drive読み込みエラー:', error);
    return formatErrorResponse({
      statusCode: 500,
      code: 'DRIVE_LOAD_ERROR',
      message: 'Google Driveからの読み込みに失敗しました',
      details: error.message
    });
  }
};
