/**
 * Cookie操作ユーティリティ - リクエストヘッダーのCookieを解析
 * 
 * @file src/utils/cookieParser.js
 * @author Koki Riho
 * @created 2025-05-12
 * @updated 2025-05-14 バグ修正: Cookie解析ロジックを全面的に書き直し
 */
'use strict';

/**
 * Cookie文字列をパースしてオブジェクトに変換する
 * @param {string|Object} cookieInput - Cookie文字列またはイベントオブジェクト
 * @returns {Object} - パースされたCookieオブジェクト
 */
const parseCookies = (cookieInput = '') => {
  // cookieInputがオブジェクトの場合、ヘッダーからCookie文字列を抽出
  let cookieString = '';
  
  if (typeof cookieInput === 'object' && cookieInput !== null) {
    // イベントオブジェクトからCookieヘッダーを抽出
    const headers = cookieInput.headers || {};
    cookieString = headers.Cookie || headers.cookie || '';
  } else if (typeof cookieInput === 'string') {
    cookieString = cookieInput;
  }
  
  // 空文字列の場合は空オブジェクトを返す
  if (cookieString === undefined || cookieString === null) {
    return {};
  }
  
  // Cookieの処理
  const result = {};
  
  // パターン1: 文字列型の入力
  if (typeof cookieString === 'string') {
    if (cookieString.trim() === '') {
      return {};
    }
    
    // セミコロンで分割
    const pairs = cookieString.split(';');
    
    for (const pair of pairs) {
      const trimmedPair = pair.trim();
      if (!trimmedPair) continue;
      
      // 最初の=で分割
      const eqIdx = trimmedPair.indexOf('=');
      if (eqIdx === -1) continue;
      
      const key = trimmedPair.substring(0, eqIdx).trim();
      const value = trimmedPair.substring(eqIdx + 1).trim();
      
      if (key) {
        try {
          result[key] = decodeURIComponent(value);
        } catch (e) {
          result[key] = value;
        }
      }
    }
  }
  
  return result;
};

/**
 * セッションCookieを生成する
 * @param {string} sessionId - セッションID
 * @param {number} [maxAge=604800] - Cookieの有効期間（秒）、デフォルトは1週間
 * @param {boolean} [secure=true] - セキュアCookieかどうか
 * @param {string} [sameSite='Strict'] - SameSite属性
 * @returns {string} - Cookie文字列
 */
const createSessionCookie = (sessionId, maxAge = 604800, secure = true, sameSite = 'Strict') => {
  const secureFlag = secure ? '; Secure' : '';
  return `session=${encodeURIComponent(sessionId)}; HttpOnly${secureFlag}; SameSite=${sameSite}; Max-Age=${maxAge}; Path=/`;
};

/**
 * セッションCookieを削除するためのCookieを生成する
 * @param {boolean} [secure=true] - セキュアCookieかどうか
 * @returns {string} - Cookie文字列
 */
const createClearSessionCookie = (secure = true) => {
  // 開発環境では secure フラグを省略
  const isDevEnv = process.env.NODE_ENV === 'development';
  const secureFlag = (secure && !isDevEnv) ? '; Secure' : '';
  
  return `session=; HttpOnly${secureFlag}; SameSite=Strict; Max-Age=0; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
};

module.exports = {
  parseCookies,
  createSessionCookie,
  createClearSessionCookie
};
