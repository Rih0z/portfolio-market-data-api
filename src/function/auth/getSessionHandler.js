/**
 * セッション情報取得ハンドラー - 現在のセッション情報を取得する
 * 
 * @file src/functions/auth/getSessionHandler.js
 * @author Portfolio Manager Team
 * @created 2025-05-12
 */
'use strict';

const { getSession } = require('../../services/googleAuthService');
const { formatResponse, formatErrorResponse } = require('../../utils/responseFormatter');
const { parseCookies } = require('../../utils/cookieParser');

/**
 * セッション情報取得ハンドラー
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
    
    // レスポンスを整形
    return formatResponse({
      statusCode: 200,
      body: {
        success: true,
        isAuthenticated: true,
        user: {
          id: session.googleId,
          email: session.email,
          name: session.name,
          picture: session.picture
        },
        session: {
          expiresAt: session.expiresAt
        }
      }
    });
  } catch (error) {
    console.error('セッション取得エラー:', error);
    return formatErrorResponse({
      statusCode: 500,
      code: 'SERVER_ERROR',
      message: 'サーバーエラーが発生しました',
      details: error.message
    });
  }
};
