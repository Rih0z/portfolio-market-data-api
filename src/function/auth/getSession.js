/**
 * ファイルパス: src/function/auth/getSession.js
 * 
 * セッション情報取得ハンドラー
 * ブラウザから送信されたCookieに基づいてセッション情報を取得する
 * 
 * @file src/function/auth/getSession.js
 * @author Portfolio Manager Team
 * @updated Koki - 2025-05-12 バグ修正: モジュールパスを修正
 * @updated Koki - 2025-05-13 バグ修正: parseCookies関数の使用方法を修正
 * @updated Koki - 2025-05-14 バグ修正: レスポンス形式とエラーハンドリングを修正
 */

const googleAuthService = require('../../services/googleAuthService');
const cookieParser = require('../../utils/cookieParser');

// モジュールパス修正: response → responseUtils
const { formatResponseSync, formatErrorResponseSync } = require('../../utils/responseUtils');

/**
 * セッション情報取得ハンドラー関数
 * 
 * @param {Object} event - API Gatewayイベントオブジェクト
 * @returns {Object} API Gateway形式のレスポンス
 */
const handler = async (event) => {
  try {
    // Cookieからセッションを取得 - イベントオブジェクト全体を渡す
    const cookies = cookieParser.parseCookies(event);
    const sessionId = cookies.session;
    
    if (!sessionId) {
      return formatErrorResponseSync({
        statusCode: 401,
        code: 'NO_SESSION',
        message: 'セッションが存在しません'
      });
    }
    
    // セッション情報を取得
    const session = await googleAuthService.getSession(sessionId);
    
    if (!session) {
      return formatErrorResponseSync({
        statusCode: 401,
        code: 'NO_SESSION',
        message: 'セッションが存在しません'
      });
    }
    
    // セッションが有効期限切れの場合
    const expiresAt = new Date(session.expiresAt).getTime();
    if (expiresAt < Date.now()) {
      await googleAuthService.invalidateSession(sessionId);
      
      return formatErrorResponseSync({
        statusCode: 401,
        code: 'SESSION_EXPIRED',
        message: 'セッションの有効期限が切れています'
      });
    }
    
    // 認証済みユーザー情報を返す - テストが期待する形式に合わせる
    const responseData = {
      isAuthenticated: true,
      user: {
        id: session.googleId,
        email: session.email,
        name: session.name || '',
        picture: session.picture || ''
      }
    };
    
    // デバッグモードの場合、追加情報を含める
    if (event.queryStringParameters && event.queryStringParameters.debug === 'true') {
      responseData.debug = {
        sessionId,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt
      };
    }
    
    return formatResponseSync({
      statusCode: 200,
      body: {
        success: true,
        data: responseData
      }
    });
  } catch (error) {
    console.error('Session retrieval error:', error);
    
    return formatErrorResponseSync({
      statusCode: 401,  // 500 ではなく 401 を返す
      code: 'AUTH_ERROR',
      message: 'セッション情報の取得中に認証エラーが発生しました',
      details: error.message
    });
  }
};

module.exports = {
  handler
};
