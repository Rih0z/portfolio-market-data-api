/**
 * セッション情報取得ハンドラー - 現在のセッション情報を取得
 * 
 * @file src/function/auth/getSession.js
 * @author Koki Riho
 * @created 2025-05-12
 */
'use strict';

const { getSession } = require('../../services/googleAuthService');
const { formatResponse, formatErrorResponse } = require('../../utils/response');
const { parseCookies } = require('../../utils/cookieParser');

/**
 * セッション情報取得ハンドラー
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
      },
      source: 'Session Store',
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('セッション取得エラー:', error);
    return formatErrorResponse({
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      message: 'サーバーエラーが発生しました'
    });
  }
};

