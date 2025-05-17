/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/services/googleDriveService.js
 * 
 * 説明: 
 * Google Driveとの連携サービス。
 * ポートフォリオデータのファイル操作（保存、取得、一覧表示、削除）を行います。
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-12
 */
'use strict';

const { google } = require('googleapis');
const { withRetry } = require('../utils/retry');
const logger = require('../utils/logger');

// デフォルト設定
const DRIVE_FOLDER_NAME = 'PortfolioManagerData';

/**
 * Google Drive APIクライアントを初期化する
 * @param {string} accessToken - アクセストークン
 * @returns {Object} Google Drive APIクライアント
 */
const getDriveClient = (accessToken) => {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  
  return google.drive({
    version: 'v3',
    auth
  });
};

/**
 * データ保存用のフォルダを取得または作成する
 * @param {string} accessToken - アクセストークン
 * @returns {Promise<string>} フォルダID
 */
const getOrCreateFolder = async (accessToken) => {
  try {
    const drive = getDriveClient(accessToken);
    
    // 既存のフォルダを検索
    const folderResponse = await drive.files.list({
      q: `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)'
    });
    
    const folders = folderResponse.data.files;
    
    // フォルダが見つかった場合はそのIDを返す
    if (folders && folders.length > 0) {
      return folders[0].id;
    }
    
    // フォルダが見つからない場合は新規作成
    const folderMetadata = {
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    };
    
    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: 'id'
    });
    
    return folder.data.id;
  } catch (error) {
    logger.error('Error getting or creating Drive folder:', error);
    throw new Error('Failed to get or create Drive folder');
  }
};

/**
 * ファイルを保存する
 * @param {string} fileName - ファイル名
 * @param {string} content - ファイルコンテンツ
 * @param {string} mimeType - MIMEタイプ
 * @param {string} accessToken - アクセストークン
 * @param {string} [fileId] - 更新する場合のファイルID
 * @returns {Promise<Object>} 保存されたファイル情報
 */
const saveFile = async (fileName, content, mimeType, accessToken, fileId = null) => {
  try {
    const drive = getDriveClient(accessToken);
    
    // メタデータの準備
    const fileMetadata = {
      name: fileName
    };
    
    // 新規作成の場合はフォルダを指定
    if (!fileId) {
      const folderId = await getOrCreateFolder(accessToken);
      fileMetadata.parents = [folderId];
    }
    
    // メディアの準備
    const media = {
      mimeType,
      body: content
    };
    
    let response;
    
    if (fileId) {
      // 既存ファイルの更新
      response = await withRetry(() => drive.files.update({
        fileId,
        resource: fileMetadata,
        media,
        fields: 'id, name, createdTime, modifiedTime, webViewLink'
      }));
    } else {
      // 新規ファイルの作成
      response = await withRetry(() => drive.files.create({
        resource: fileMetadata,
        media,
        fields: 'id, name, createdTime, modifiedTime, webViewLink'
      }));
    }
    
    return {
      id: response.data.id,
      name: response.data.name,
      createdTime: response.data.createdTime,
      modifiedTime: response.data.modifiedTime,
      webViewLink: response.data.webViewLink
    };
  } catch (error) {
    logger.error('Error saving file to Drive:', error);
    throw new Error('Failed to save file to Google Drive');
  }
};

/**
 * ファイルを取得する
 * @param {string} fileId - 取得するファイルのID
 * @param {string} accessToken - アクセストークン
 * @returns {Promise<string>} ファイルコンテンツ
 */
const getFile = async (fileId, accessToken) => {
  try {
    const drive = getDriveClient(accessToken);
    
    // ファイルのコンテンツを取得
    const response = await withRetry(() => drive.files.get({
      fileId,
      alt: 'media'
    }));
    
    return response.data;
  } catch (error) {
    logger.error(`Error getting file ${fileId} from Drive:`, error);
    throw new Error('Failed to get file from Google Drive');
  }
};

/**
 * ファイル一覧を取得する
 * @param {string} nameFilter - 名前フィルター
 * @param {string} mimeType - MIMEタイプ
 * @param {string} accessToken - アクセストークン
 * @returns {Promise<Array>} ファイル一覧
 */
const listFiles = async (nameFilter, mimeType, accessToken) => {
  try {
    const drive = getDriveClient(accessToken);
    const folderId = await getOrCreateFolder(accessToken);
    
    // クエリの構築
    let query = `'${folderId}' in parents and trashed=false`;
    
    if (nameFilter) {
      query += ` and name contains '${nameFilter}'`;
    }
    
    if (mimeType) {
      query += ` and mimeType='${mimeType}'`;
    }
    
    // ファイル一覧を取得
    const response = await withRetry(() => drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, createdTime, modifiedTime, webViewLink)',
      orderBy: 'createdTime desc'
    }));
    
    return response.data.files || [];
  } catch (error) {
    logger.error('Error listing files from Drive:', error);
    throw new Error('Failed to list files from Google Drive');
  }
};

/**
 * ファイルを削除する
 * @param {string} fileId - 削除するファイルのID
 * @param {string} accessToken - アクセストークン
 * @returns {Promise<boolean>} 成功したらtrue
 */
const deleteFile = async (fileId, accessToken) => {
  try {
    const drive = getDriveClient(accessToken);
    
    // ファイルを削除
    await withRetry(() => drive.files.delete({
      fileId
    }));
    
    return true;
  } catch (error) {
    logger.error(`Error deleting file ${fileId} from Drive:`, error);
    throw new Error('Failed to delete file from Google Drive');
  }
};

module.exports = {
  saveFile,
  getFile,
  listFiles,
  deleteFile,
  getOrCreateFolder
};
