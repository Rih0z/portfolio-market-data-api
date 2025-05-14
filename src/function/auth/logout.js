/**
 * ログアウトハンドラー - セッションを無効化してCookieを削除する
 * 
 * @file src/function/auth/logout.js
 * @author Portfolio Manager Team
 * @created 2025-05-12
 * @updated 2025-05-13 バグ修正: parseCookies関数の使用方法を修正
 */
'use strict';

const { invalidateSession } = require('../../services/googleAuthService');
const { formatResponseSync, formatErrorResponseSync, formatRedirectResponseSync } = require('../../utils/responseUtils');
const { parseCookies, createClearSessionCookie } = require('../../utils/cookieParser');

/**
 * ログアウト処理ハンドラー
 * @param {Object} event - API Gatewayイベント
 * @returns {Object} - API Gatewayレスポンス
 */
module.exports.handler = async (event) => {
  // POSTリクエスト以外はエラーを返す
  if (event.httpMethod !== 'POST') {
    return formatErrorResponseSync({
      statusCode: 405,
      code: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed',
      headers: {
        'Allow': 'POST'
      }
    });
  }

  try {
    // Cookieからセッションを取得 - イベントオブジェクト全体を渡す
    const cookies = parseCookies(event);
    const sessionId = cookies.session;
    
    // リダイレクトURLがクエリパラメータにある場合は処理
    let redirectUrl = null;
    if (event.queryStringParameters && event.queryStringParameters.redirect) {
      redirectUrl = event.queryStringParameters.redirect;
    }
    
    // セッションがない場合でも成功として処理
    if (!sessionId) {
      // リダイレクトURLがある場合
      if (redirectUrl) {
        return formatRedirectResponseSync(redirectUrl, 302, {
          'Set-Cookie': createClearSessionCookie()
        });
      }

      return formatResponseSync({
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
    console.info('Session invalidated', sessionId);
    
    // リダイレクトURLがある場合
    if (redirectUrl) {
      return formatRedirectResponseSync(redirectUrl, 302, {
        'Set-Cookie': createClearSessionCookie()
      });
    }
    
    // レスポンスを整形（Cookieを削除）- テストが期待する形式に合わせる
    return formatResponseSync({
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
    return formatErrorResponseSync({
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
