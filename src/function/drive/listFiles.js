/**
 * Google Driveファイル一覧取得ハンドラー - ポートフォリオデータファイル一覧
 * 
 * @file src/function/drive/listFiles.js
 * @author Koki Riho
 * @created 2025-05-12
 * @updated 2025-05-13
 * @updated 2025-05-20 改善: エラーハンドリング強化とモジュール参照の統一
 */
'use strict';

const { getSession } = require('../../services/googleAuthService');
const { refreshSessionToken } = require('../../services/googleAuthService');
const { listPortfolioFiles } = require('../../services/googleDriveService');
const { formatResponse, formatErrorResponse } = require('../../utils/responseUtils');
const { parseCookies } = require('../../utils/cookieParser');

/**
 * Google Driveファイル一覧取得ハンドラー
 * @param {Object} event - API Gatewayイベント
 * @returns {Object} - API Gatewayレスポンス
 */
module.exports.handler = async (event) => {
  try {
    // Cookieからセッションを取得
    const cookies = parseCookies(event.headers || {});
    const sessionId = cookies.session;
    
    if (!sessionId) {
      return formatErrorResponse({
        statusCode: 401,
        code: 'NO_SESSION',
        message: 'セッションが存在しません'
      });
    }
    
    // セッション情報を取得
    const session = await getSession(sessionId);
    
    if (!session) {
      return formatErrorResponse({
        statusCode: 401,
        code: 'INVALID_SESSION',
        message: 'セッションが無効です'
      });
    }
    
    // トークンを検証・更新
    let accessToken;
    try {
      const tokenResult = await refreshSessionToken(sessionId);
      accessToken = tokenResult.accessToken;
    } catch (tokenError) {
      console.error('トークン更新エラー:', tokenError);
      return formatErrorResponse({
        statusCode: 401,
        code: 'TOKEN_REFRESH_ERROR',
        message: 'アクセストークンの更新に失敗しました',
        details: tokenError.message
      });
    }
    
    // クエリパラメータ取得
    const queryParams = event.queryStringParameters || {};
    const { maxResults, orderBy, nameFilter } = queryParams;
    
    // カスタム検索オプション
    const searchOptions = {};
    if (maxResults) searchOptions.maxResults = parseInt(maxResults, 10);
    if (orderBy) searchOptions.orderBy = orderBy;
    if (nameFilter) searchOptions.nameFilter = nameFilter;
    
    // Google Driveのファイル一覧を取得
    const files = await listPortfolioFiles(accessToken, searchOptions);
    
    // ファイル情報を整形
    const formattedFiles = files.map(file => ({
      id: file.id,
      name: file.name,
      size: file.size ? parseInt(file.size, 10) : 0,
      mimeType: file.mimeType,
      createdAt: file.createdTime,
      modifiedAt: file.modifiedTime,
      webViewLink: file.webViewLink
    }));
    
    // レスポンスを整形
    return formatResponse({
      statusCode: 200,
      data: {
        files: formattedFiles,
        count: formattedFiles.length
      }
    });
  } catch (error) {
    console.error('Driveファイル一覧取得エラー:', error);
    return formatErrorResponse({
      statusCode: 500,
      code: 'DRIVE_LIST_ERROR',
      message: 'Google Driveのファイル一覧取得に失敗しました',
      details: error.message
    });
  }
};
