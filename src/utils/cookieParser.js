/**
 * Cookie操作ユーティリティ - リクエストヘッダーのCookieを解析
 * 
 * @file src/utils/cookieParser.js
 * @author Koki Riho
 * @created 2025-05-12
 */
'use strict';

/**
 * Cookie文字列をパースしてオブジェクトに変換する
 * @param {string} cookieString - Cookie文字列
 * @returns {Object} - パースされたCookieオブジェクト
 */
const parseCookies = (cookieString = '') => {
  if (!cookieString) {
    return {};
  }
  
  return cookieString
    .split(';')
    .map(cookie => cookie.trim())
    .filter(cookie => cookie.length > 0)
    .reduce((result, cookie) => {
      const [name, value] = cookie.split('=').map(part => part.trim());
      try {
        // URIデコードを試みる
        result[name] = decodeURIComponent(value);
      } catch (error) {
        // デコードに失敗した場合はそのまま使用
        result[name] = value;
      }
      return result;
    }, {});
};

/**
 * セッションCookieを生成する
 * @param {string} sessionId - セッションID
 * @param {number} maxAge - Cookieの有効期間（秒）
 * @param {boolean} [secure=true] - セキュアCookieかどうか
 * @param {string} [sameSite='Strict'] - SameSite属性
 * @returns {string} - Cookie文字列
 */
const createSessionCookie = (sessionId, maxAge, secure = true, sameSite = 'Strict') => {
  const secureFlag = secure ? '; Secure' : '';
  return `session=${sessionId}; HttpOnly${secureFlag}; SameSite=${sameSite}; Max-Age=${maxAge}; Path=/`;
};

/**
 * セッションCookieを削除するためのCookieを生成する
 * @param {boolean} [secure=true] - セキュアCookieかどうか
 * @returns {string} - Cookie文字列
 */
const createClearSessionCookie = (secure = true) => {
  const secureFlag = secure ? '; Secure' : '';
  return `session=; HttpOnly${secureFlag}; SameSite=Strict; Max-Age=0; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
};

module.exports = {
  parseCookies,
  createSessionCookie,
  createClearSessionCookie
};
