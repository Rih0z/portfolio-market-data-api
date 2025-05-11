/**
 * ログアウトハンドラー - セッション無効化とCookie削除
 * 
 * @file src/function/auth/logout.js
 * @author Koki Riho
 * @created 2025-05-12
 */
'use strict';

const { invalidateSession } = require('../../services/googleAuthService');
const { formatResponse, formatErrorResponse } = require('../../utils/response');
const { parseCookies, createClearSessionCookie } = require('../../utils/cookieParser');

/**
 * ログアウト処理ハンドラー
 * @param {Object} event - API Gatewayイベント
 * @returns {Object} - API Gatewayレスポンス
 */
exports.handler = async (event) => {
  try {
    // Cookieからセッションを取得
    const cookies = parseCookies(event.headers.Cookie || event.headers.cookie || '');
    const sessionId = cookies.session;
    
    // セッションがない場合でも成功として処理
    if (!sessionId) {
      return formatResponse({
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
          'Access-Control-Allow-Credentials': 'true',
          'Set-Cookie': createClearSessionCookie()
        },
        data: {
          success: true,
          message: 'すでにログアウトしています'
        },
        source: 'Auth Service',
        lastUpdated: new Date().toISOString()
      });
    }
    
    // セッションを無効化
    await invalidateSession(sessionId);
    
    // レスポンスヘッダー（Cookieを削除）
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Set-Cookie': createClearSessionCookie()
    };
    
    // レスポンスを整形
    return formatResponse({
      statusCode: 200,
      headers,
      data: {
        success: true,
        message: 'ログアウトしました'
      },
      source: 'Auth Service',
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('ログアウトエラー:', error);
    
    // エラーの場合でもCookieは削除
    return formatErrorResponse({
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true',
        'Set-Cookie': createClearSessionCookie()
      },
      message: 'ログアウト中にエラーが発生しましたが、セッションは削除されました'
    });
  }
};
