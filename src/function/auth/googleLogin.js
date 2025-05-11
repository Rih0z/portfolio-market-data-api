/**
 * Google認証ログインハンドラー - 認証コードを受け取りセッション作成
 * 
 * @file src/function/auth/googleLogin.js
 * @author Koki Riho
 * @created 2025-05-12
 */
'use strict';

const { 
  exchangeCodeForTokens, 
  verifyIdToken, 
  createUserSession 
} = require('../../services/googleAuthService');
const { formatResponse, formatErrorResponse } = require('../../utils/response');
const { createSessionCookie } = require('../../utils/cookieParser');

/**
 * Google認証処理ハンドラー
 * @param {Object} event - API Gatewayイベント
 * @returns {Object} - API Gatewayレスポンス
 */
exports.handler = async (event) => {
  try {
    const requestBody = JSON.parse(event.body || '{}');
    const { code, redirectUri } = requestBody;
    
    if (!code) {
      return formatErrorResponse({
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
          'Access-Control-Allow-Credentials': 'true'
        },
        message: '認証コードが不足しています'
      });
    }
    
    // Googleで認証コードをトークンに交換
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    
    // IDトークンを検証してユーザー情報を取得
    const userInfo = await verifyIdToken(tokens.id_token);
    
    // セッションを作成
    const session = await createUserSession({
      googleId: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    });
    
    // セッションCookieを作成（1週間有効）
    const maxAge = 60 * 60 * 24 * 7; // 7日間（秒単位）
    const sessionCookie = createSessionCookie(session.sessionId, maxAge);
    
    // レスポンスヘッダー
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Set-Cookie': sessionCookie
    };
    
    // レスポンスを整形
    return formatResponse({
      statusCode: 200,
      headers,
      data: {
        isAuthenticated: true,
        user: {
          id: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture
        },
        session: {
          expiresAt: session.expiresAt
        }
      },
      source: 'Google OAuth',
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Google認証エラー:', error);
    return formatErrorResponse({
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ALLOW_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      message: '認証に失敗しました: ' + error.message
    });
  }
};
