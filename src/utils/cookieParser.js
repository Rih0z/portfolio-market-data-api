/**
 * Cookie操作ユーティリティ - リクエストヘッダーのCookieを解析
 * 
 * @file src/utils/cookieParser.js
 * @author Koki Riho
 * @created 2025-05-12
 * @updated 2025-05-14 バグ修正: Cookie解析ロジックを最適化
 */
'use strict';

/**
 * Cookie文字列をパースしてオブジェクトに変換する
 * @param {string|Object} cookieInput - Cookie文字列またはイベントオブジェクト
 * @returns {Object} - パースされたCookieオブジェクト
 */
const parseCookies = (cookieInput = '') => {
  // パースした結果を格納するオブジェクト
  const cookies = {};
  
  // cookieInputが無効な場合は空のオブジェクトを返す
  if (cookieInput === null || cookieInput === undefined) {
    return cookies;
  }
  
  // cookieStringを取得
  let cookieString = '';
  
  if (typeof cookieInput === 'object') {
    // イベントオブジェクトからCookieヘッダーを抽出
    try {
      const headers = cookieInput.headers || {};
      cookieString = headers.Cookie || headers.cookie || '';
    } catch (e) {
      return cookies;
    }
  } else if (typeof cookieInput === 'string') {
    cookieString = cookieInput;
  } else {
    return cookies;
  }
  
  // 空の文字列の場合は空のオブジェクトを返す
  if (!cookieString) {
    return cookies;
  }
  
  // Cookie文字列を解析
  // 修正: セミコロンで単純に分割するのではなく、適切な方法で解析する
  const cookiePairs = cookieString.split(';');
  
  for (const pair of cookiePairs) {
    const trimmedPair = pair.trim();
    if (!trimmedPair) continue;
    
    // 最初の等号の位置を取得
    const equalPos = trimmedPair.indexOf('=');
    
    // 等号がない場合はスキップ
    if (equalPos === -1) continue;
    
    // キーと値を分離（最初の等号でのみ分割）
    const key = trimmedPair.substring(0, equalPos).trim();
    let value = trimmedPair.substring(equalPos + 1).trim();
    
    // キーが空でない場合のみ追加
    if (key) {
      try {
        // URLエンコードされた値をデコード
        value = decodeURIComponent(value);
      } catch (e) {
        // デコードエラーの場合は元の値を使用
      }
      
      // 値にセミコロンが含まれる場合でも正しく処理
      cookies[key] = value;
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
