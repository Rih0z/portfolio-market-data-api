/**
 * ログアウトハンドラー - セッションを無効化してCookieを削除する
 * 
 * @file src/function/auth/logout.js
 * @author Portfolio Manager Team
 * @created 2025-05-12
 * @updated 2025-05-13
 */
'use strict';

const { invalidateSession } = require('../../services/googleAuthService');
const { formatResponse, formatErrorResponse } = require('../../utils/responseUtils');
const { parseCookies, createClearSessionCookie } = require('../../utils/cookieParser');

/**
 * ログアウト処理ハンドラー
 * @param {Object} event - API Gatewayイベント
 * @returns {Object} - API Gatewayレスポンス
 */
module.exports.handler = async (event) => {
  try {
    // Cookieからセッションを取得
    const cookies = parseCookies(event.headers.Cookie || event.headers.cookie || '');
    const sessionId = cookies.session;
    
    // セッションがない場合でも成功として処理
    if (!sessionId) {
      return formatResponse({
        statusCode: 200,
        body: {
          success: true,
          message: 'すでにログアウトしています'
        },
        headers: {
          'Set-Cookie': createClearSessionCookie()
        }
      });
    }
    
    // セッションを無効化
    await invalidateSession(sessionId);
    
    // レスポンスを整形（Cookieを削除）
    return formatResponse({
      statusCode: 200,
      body: {
        success: true,
        message: 'ログアウトしました'
      },
      headers: {
        'Set-Cookie': createClearSessionCookie()
      }
    });
  } catch (error) {
    console.error('ログアウトエラー:', error);
    
    // エラーの場合でもCookieは削除
    return formatErrorResponse({
      statusCode: 500,
      code: 'SERVER_ERROR',
      message: 'ログアウト中にエラーが発生しましたが、セッションは削除されました',
      details: error.message,
      headers: {
        'Set-Cookie': createClearSessionCookie()
      }
    });
  }
};
