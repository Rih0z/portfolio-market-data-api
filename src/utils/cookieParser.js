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
      // まず、Cookieプロパティがオブジェクトに直接ある場合をチェック
      if (cookieInput.Cookie || cookieInput.cookie) {
        cookieString = cookieInput.Cookie || cookieInput.cookie;
      } else {
        // イベントオブジェクトの場合の処理
        // APIGatewayイベントの形式を想定
        const headers = cookieInput.headers || {};
        
        // テスト環境対応：headers が直接 Cookie プロパティを持つ場合と、
        // headers.Cookie または headers.cookie の形式の両方に対応
        if (typeof headers === 'object') {
          cookieString = headers.Cookie || headers.cookie || '';
        } else if (typeof headers === 'string') {
          cookieString = headers;
        }
      }
      
      // ここでデバッグ用にログを出力（テスト環境では不要）
      // console.log('Cookie string from headers:', cookieString);
    } catch (e) {
      // エラーが発生した場合は空のオブジェクトを返す
      console.error('Cookie parse error:', e);
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
  
  // ここでCookieをパースする新しいロジック
  // スペース付きセミコロンでCookieを分割します（通常のCookieの区切り）
  let remainingString = cookieString;
  let position = 0;
  
  while (position < remainingString.length) {
    // まず次のセミコロンまでの文字列を取得
    let semicolonPos = remainingString.indexOf(';', position);
    let cookiePart;
    
    if (semicolonPos === -1) {
      // 最後のCookieの場合
      cookiePart = remainingString.substring(position);
      position = remainingString.length; // ループ終了のため
    } else {
      cookiePart = remainingString.substring(position, semicolonPos);
      position = semicolonPos + 1; // セミコロンの次の文字へ
    }
    
    // 各Cookieパートを解析
    const trimmedPart = cookiePart.trim();
    if (!trimmedPart) continue;
    
    // 最初の等号の位置を取得
    const equalPos = trimmedPart.indexOf('=');
    
    // 等号がない場合はスキップ
    if (equalPos === -1) continue;
    
    // キーと値を分離
    const key = trimmedPart.substring(0, equalPos).trim();
    let value = trimmedPart.substring(equalPos + 1).trim();
    
    // キーが空でない場合のみ追加
    if (key) {
      try {
        // URLエンコードされた値をデコード
        value = decodeURIComponent(value);
      } catch (e) {
        // デコードエラーの場合は元の値を使用
      }
      
      // 値をそのまま保存（セミコロンを含む場合でも）
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
