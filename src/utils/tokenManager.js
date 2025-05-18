/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/utils/tokenManager.js
 * 
 * 説明: 
 * OAuth トークン管理のためのユーティリティ。
 * トークンの検証、更新、暗号化/復号化を一元管理します。
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-20
 */
'use strict';

const { OAuth2Client } = require('google-auth-library');
const { withRetry } = require('./retry');
const logger = require('./logger');

// 環境変数から設定を取得
const oAuth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

/**
 * アクセストークンの有効期限をチェックし、必要に応じて更新する
 * @param {Object} session - セッション情報
 * @returns {Promise<Object>} 更新されたトークン情報
 */
const validateAndRefreshToken = async (session) => {
  if (!session) {
    throw new Error('セッション情報が不足しています');
  }

  try {
    // アクセストークンの有効期限をチェック
    const tokenExpiry = new Date(session.tokenExpiry);
    const now = new Date();
    
    // 現在の有効なトークン情報を返す
    if (tokenExpiry > now) {
      return {
        accessToken: session.accessToken,
        refreshed: false
      };
    }
    
    // リフレッシュトークンがない場合はエラー
    if (!session.refreshToken) {
      throw new Error('リフレッシュトークンが存在しません');
    }
    
    // トークンを更新
    const newTokens = await refreshAccessToken(session.refreshToken);
    
    return {
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token || session.refreshToken,
      tokenExpiry: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
      refreshed: true
    };
  } catch (error) {
    logger.error('トークン検証/更新エラー:', error);
    throw new Error(`アクセストークンの検証または更新に失敗しました: ${error.message}`);
  }
};

/**
 * リフレッシュトークンを使用してアクセストークンを更新する
 * @param {string} refreshToken - リフレッシュトークン
 * @returns {Promise<Object>} 新しいトークン情報
 */
const refreshAccessToken = async (refreshToken) => {
  try {
    // リトライロジックを適用してトークン更新
    return await withRetry(
      async () => {
        oAuth2Client.setCredentials({
          refresh_token: refreshToken
        });
        
        const { credentials } = await oAuth2Client.refreshAccessToken();
        return credentials;
      },
      {
        maxRetries: 3,
        baseDelay: 300,
        shouldRetry: (error) => {
          // 一時的なエラーや接続エラーの場合のみリトライ
          return error.code === 'ETIMEDOUT' || 
                 error.code === 'ECONNRESET' ||
                 error.message?.includes('network') ||
                 error.response?.status >= 500;
        }
      }
    );
  } catch (error) {
    logger.error('トークン更新エラー:', error);
    throw new Error('アクセストークンの更新に失敗しました');
  }
};

/**
 * IDトークンを検証してユーザー情報を取得する
 * @param {string} idToken - Google ID Token
 * @returns {Promise<Object>} ユーザー情報
 */
const verifyIdToken = async (idToken) => {
  try {
    // リトライロジックを適用してIDトークン検証
    return await withRetry(
      async () => {
        const ticket = await oAuth2Client.verifyIdToken({
          idToken,
          audience: process.env.GOOGLE_CLIENT_ID
        });
        
        return ticket.getPayload();
      },
      {
        maxRetries: 2,
        baseDelay: 200
      }
    );
  } catch (error) {
    logger.error('IDトークン検証エラー:', error);
    
    // より詳細なエラーメッセージを提供
    if (error.message?.includes('expired')) {
      throw new Error('IDトークンの有効期限が切れています');
    } else if (error.message?.includes('audience')) {
      throw new Error('IDトークンの対象者(audience)が不正です');
    } else {
      throw new Error(`IDトークンの検証に失敗しました: ${error.message}`);
    }
  }
};

/**
 * 認証コードをトークンと交換する
 * @param {string} code - Google認証コード
 * @param {string} redirectUri - リダイレクトURI
 * @returns {Promise<Object>} - トークン情報
 */
const exchangeCodeForTokens = async (code, redirectUri) => {
  try {
    // リトライロジックを適用してトークン交換
    return await withRetry(
      async () => {
        const { tokens } = await oAuth2Client.getToken({
          code,
          redirect_uri: redirectUri
        });
        
        return tokens;
      },
      {
        maxRetries: 2,
        baseDelay: 300
      }
    );
  } catch (error) {
    logger.error('トークン交換エラー:', error);
    
    // エラーメッセージを適切に変換
    if (error.message?.includes('invalid_grant')) {
      throw new Error('認証コードが無効または期限切れです');
    } else if (error.message?.includes('redirect_uri_mismatch')) {
      throw new Error('リダイレクトURIが一致しません');
    } else {
      throw new Error(`認証コードからトークンへの交換に失敗しました: ${error.message}`);
    }
  }
};

module.exports = {
  validateAndRefreshToken,
  refreshAccessToken,
  verifyIdToken,
  exchangeCodeForTokens
};
