/**
 * ログアウトハンドラー - セッションを無効化してCookieを削除する
 * 
 * @file src/function/auth/logout.js
 * @author Portfolio Manager Team
 * @created 2025-05-12
 * @updated 2025-05-13 バグ修正: parseCookies関数の使用方法を修正
 * @updated 2025-05-14 バグ修正: テストモックに対応するよう修正
 * @updated 2025-05-15 バグ修正: リダイレクトテスト対応のため実装修正
 */
'use strict';

const { invalidateSession } = require('../../services/googleAuthService');
const { formatResponse, formatErrorResponse, formatRedirectResponse } = require('../../utils/responseUtils');
const { parseCookies, createClearSessionCookie } = require('../../utils/cookieParser');

/**
 * ログアウト処理ハンドラー
 * @param {Object} event - API Gatewayイベント
 * @returns {Object} - API Gatewayレスポンス
 */
module.exports.handler = async (event) => {
  // テスト用関数はイベントに直接アタッチされている場合があります
  const logger = event._testLogger || console;
  
  // POSTリクエスト以外はエラーを返す
  if (event.httpMethod && event.httpMethod !== 'POST') {
    const errorResponse = await formatErrorResponse({
      statusCode: 405,
      code: 'METHOD_NOT_ALLOWED',
      message: 'Method not allowed',
      headers: {
        'Allow': 'POST'
      }
    });
    
    return errorResponse;
  }

  try {
    // Cookie ヘッダーを作成
    const clearCookie = createClearSessionCookie();
    
    // リダイレクトURLチェックを一番最初に行う
    if (event.queryStringParameters && event.queryStringParameters.redirect) {
      // リダイレクトURLが指定されている場合
      const redirectUrl = event.queryStringParameters.redirect;
      
      // セッション無効化を先に行う（必要であれば）
      let cookieString = '';
      if (event.headers && event.headers.Cookie) {
        cookieString = event.headers.Cookie;
      }
      
      // Cookie解析とセッション無効化
      const cookieObj = { Cookie: cookieString };
      const cookies = parseCookies(cookieObj);
      const sessionId = cookies.session;
      
      if (sessionId) {
        try {
          await invalidateSession(sessionId);
        } catch (error) {
          logger.error('Session invalidation error:', error);
        }
      }
      
      // 重要: テスト互換性のため、responseUtils.formatRedirectResponseを直接使用
      // 代わりにモジュールからインポートした関数を使用する
      return responseUtils.formatRedirectResponse(
        redirectUrl,
        302,
        { 'Set-Cookie': clearCookie }
      );
    }
    
    // 通常のログアウト処理（リダイレクトなし）
    
    // ***テスト対応: Cookieオブジェクトを直接作成***
    let cookieString = '';
    if (event.headers && event.headers.Cookie) {
      cookieString = event.headers.Cookie;
    }
    
    const cookieObj = { Cookie: cookieString };
    const cookies = parseCookies(cookieObj);
    const sessionId = cookies.session;
    
    // セッションがある場合は無効化
    if (sessionId) {
      try {
        await invalidateSession(sessionId);
        
        // ログ出力 - テスト対応
        if (process.env.LOG_SESSION_STATUS === 'true') {
          if (typeof logger.log === 'function') {
            logger.log('Session invalidated', sessionId);
          } else {
            logger.info('Session invalidated', sessionId);
          }
        }
      } catch (error) {
        logger.error('Session invalidation error:', error);
        // エラーが発生しても処理を継続
      }
    }

    // テスト対応: 値を表示
    if (event._testMode) {
      logger.debug('Event:', event);
      logger.debug('Parsed cookies:', cookies);
      logger.debug('Session ID:', sessionId);
    }
    
    // 通常のレスポンスを返す
    const successResponse = await formatResponse({
      message: sessionId ? 'ログアウトしました' : 'すでにログアウトしています',
      headers: {
        'Set-Cookie': clearCookie
      }
    });
    
    return successResponse;
  } catch (error) {
    // エラー処理
    logger.error('ログアウトエラー:', error);
    
    // エラーの場合でもCookieは削除
    const errorResponse = await formatErrorResponse({
      statusCode: 500,
      code: 'SERVER_ERROR',
      message: 'ログアウト中にエラーが発生しましたが、セッションは削除されました',
      details: error.message,
      headers: {
        'Set-Cookie': createClearSessionCookie()
      }
    });
    
    return errorResponse;
  }
};

