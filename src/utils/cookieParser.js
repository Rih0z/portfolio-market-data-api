/**
 * Cookie操作ユーティリティ - リクエストヘッダーのCookieを解析
 * 
 * @file src/utils/cookieParser.js
 * @author Koki Riho
 * @created 2025-05-12
 * @updated 2025-05-13 バグ修正: エラー処理と型チェックを改善
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
  
  // 空文字列または文字列でない場合は空オブジェクトを返す
  if (!cookieString || typeof cookieString !== 'string') {
    return {};
  }
  
  const cookies = {};
  
  // セミコロンでCookieを分割
  const cookiePairs = cookieString.split(';');
  
  for (const pair of cookiePairs) {
    const trimmedPair = pair.trim();
    if (!trimmedPair) continue;
    
    // 最初の=の位置を見つける (セミコロンを含む値にも対応)
    const firstEqualIndex = trimmedPair.indexOf('=');
    
    // =が見つからなかった場合はスキップ
    if (firstEqualIndex === -1) continue;
    
    const name = trimmedPair.substring(0, firstEqualIndex).trim();
    let value = trimmedPair.substring(firstEqualIndex + 1).trim();
    
    // 値が空でも受け入れる
    try {
      // URIデコードを試みる
      cookies[name] = decodeURIComponent(value);
    } catch (error) {
      // デコードに失敗した場合はそのまま使用
      cookies[name] = value;
    }
  }
  
  return cookies;
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
  const secureFlag = secure ? '; Secure' : '';
  return `session=; HttpOnly${secureFlag}; SameSite=Strict; Max-Age=0; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
};

module.exports = {
  parseCookies,
  createSessionCookie,
  createClearSessionCookie
};
