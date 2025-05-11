/**
 * Google認証サービス - OAuth認証とGoogleドライブ連携機能
 * 
 * @file src/services/googleAuthService.js
 * @author Koki Riho
 * @created 2025-05-12
 * @updated 2025-05-13
 */
'use strict';

const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');
const uuid = require('uuid');
const { addItem, getItem, deleteItem } = require('../utils/dynamoDbService');

// 定数定義
const SESSION_TABLE = process.env.SESSION_TABLE || `${process.env.DYNAMODB_TABLE_PREFIX || 'portfolio-market-data-'}-sessions`;
const SESSION_EXPIRES_DAYS = parseInt(process.env.SESSION_EXPIRES_DAYS || '7', 10); // セッション有効期限（日）
const DRIVE_FOLDER_NAME = process.env.DRIVE_FOLDER_NAME || 'PortfolioManagerData';

// Google OAuth2 クライアントの初期化
const oAuth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

/**
 * 認証コードをトークンと交換する
 * @param {string} code - Google認証コード
 * @param {string} redirectUri - リダイレクトURI
 * @returns {Promise<Object>} - トークン情報
 */
const exchangeCodeForTokens = async (code, redirectUri) => {
  try {
    const { tokens } = await oAuth2Client.getToken({
      code,
      redirect_uri: redirectUri
    });
    
    return tokens;
  } catch (error) {
    console.error('トークン交換エラー:', error);
    throw new Error('認証コードからトークンへの交換に失敗しました');
  }
};

/**
 * IDトークンを検証してユーザー情報を取得する
 * @param {string} idToken - Google ID Token
 * @returns {Promise<Object>} - ユーザー情報
 */
const verifyIdToken = async (idToken) => {
  try {
    const ticket = await oAuth2Client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    return ticket.getPayload();
  } catch (error) {
    console.error('IDトークン検証エラー:', error);
    throw new Error('IDトークンの検証に失敗しました');
  }
};

/**
 * ユーザーセッションを作成する
 * @param {Object} userData - ユーザーデータ
 * @returns {Promise<Object>} - セッション情報
 */
const createUserSession = async (userData) => {
  const sessionId = uuid.v4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  
  const sessionItem = {
    sessionId,
    googleId: userData.googleId,
    email: userData.email,
    name: userData.name,
    picture: userData.picture,
    accessToken: userData.accessToken,
    refreshToken: userData.refreshToken || null, // リフレッシュトークンがない場合もある
    tokenExpiry: userData.tokenExpiry || null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    // TTL属性（DynamoDBの自動削除用）
    ttl: Math.floor(expiresAt.getTime() / 1000)
  };
  
  try {
    await addItem(SESSION_TABLE, sessionItem);
    
    return {
      sessionId,
      expiresAt: expiresAt.toISOString()
    };
  } catch (error) {
    console.error('セッション作成エラー:', error);
    throw new Error('ユーザーセッションの作成に失敗しました');
  }
};

/**
 * セッション情報を取得する
 * @param {string} sessionId - セッションID
 * @returns {Promise<Object|null>} - セッション情報
 */
const getSession = async (sessionId) => {
  try {
    const session = await getItem(SESSION_TABLE, { sessionId });
    
    if (!session) {
      return null;
    }
    
    // セッションの有効期限をチェック
    const expiresAt = new Date(session.expiresAt);
    const now = new Date();
    
    if (expiresAt <= now) {
      // 期限切れの場合はセッションを削除
      await deleteItem(SESSION_TABLE, { sessionId });
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('セッション取得エラー:', error);
    return null;
  }
};

/**
 * セッションを無効化する
 * @param {string} sessionId - セッションID
 * @returns {Promise<boolean>} - 成功したかどうか
 */
const invalidateSession = async (sessionId) => {
  try {
    await deleteItem(SESSION_TABLE, { sessionId });
    return true;
  } catch (error) {
    console.error('セッション無効化エラー:', error);
    return false;
  }
};

/**
 * アクセストークンを更新する
 * @param {string} refreshToken - リフレッシュトークン
 * @returns {Promise<Object>} - 新しいトークン情報
 */
const refreshAccessToken = async (refreshToken) => {
  try {
    oAuth2Client.setCredentials({
      refresh_token: refreshToken
    });
    
    const { credentials } = await oAuth2Client.refreshAccessToken();
    return credentials;
  } catch (error) {
    console.error('トークン更新エラー:', error);
    throw new Error('アクセストークンの更新に失敗しました');
  }
};

/**
 * Google Driveのデータフォルダを検索または作成する
 * @param {string} accessToken - アクセストークン
 * @returns {Promise<string>} - フォルダID
 */
const getOrCreateDriveFolder = async (accessToken) => {
  try {
    // Google Drive APIクライアントの設定
    const drive = google.drive({
      version: 'v3',
      auth: new google.auth.OAuth2().setCredentials({ access_token: accessToken })
    });
    
    // 既存のフォルダを検索
    const response = await drive.files.list({
      q: `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name)'
    });
    
    const folders = response.data.files;
    
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
    console.error('Driveフォルダ作成エラー:', error);
    throw new Error('Google Driveフォルダの作成に失敗しました');
  }
};

/**
 * ポートフォリオデータをGoogle Driveに保存する
 * @param {string} accessToken - アクセストークン
 * @param {Object} portfolioData - 保存するポートフォリオデータ
 * @returns {Promise<Object>} - 保存結果
 */
const savePortfolioToDrive = async (accessToken, portfolioData) => {
  try {
    // Google Drive APIクライアントの設定
    const drive = google.drive({
      version: 'v3',
      auth: new google.auth.OAuth2().setCredentials({ access_token: accessToken })
    });
    
    // フォルダの取得または作成
    const folderId = await getOrCreateDriveFolder(accessToken);
    
    // ファイル名の生成（現在のタイムスタンプを含む）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `portfolio-data-${timestamp}.json`;
    
    // ファイルのメタデータ
    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };
    
    // ファイルのコンテンツ
    const media = {
      mimeType: 'application/json',
      body: JSON.stringify(portfolioData, null, 2)
    };
    
    // ファイルのアップロード
    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, createdTime'
    });
    
    return {
      success: true,
      fileId: file.data.id,
      fileName: file.data.name,
      webViewLink: file.data.webViewLink,
      createdTime: file.data.createdTime
    };
  } catch (error) {
    console.error('Drive保存エラー:', error);
    throw new Error('Google Driveへのデータ保存に失敗しました');
  }
};

/**
 * Google Driveからポートフォリオデータのファイル一覧を取得する
 * @param {string} accessToken - アクセストークン
 * @returns {Promise<Array>} - ファイル一覧
 */
const listPortfolioFiles = async (accessToken) => {
  try {
    // Google Drive APIクライアントの設定
    const drive = google.drive({
      version: 'v3',
      auth: new google.auth.OAuth2().setCredentials({ access_token: accessToken })
    });
    
    // フォルダの取得または作成
    const folderId = await getOrCreateDriveFolder(accessToken);
    
    // フォルダ内のファイル一覧を取得
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)',
      orderBy: 'createdTime desc'
    });
    
    return response.data.files || [];
  } catch (error) {
    console.error('Driveファイル一覧取得エラー:', error);
    throw new Error('Google Driveのファイル一覧取得に失敗しました');
  }
};

/**
 * Google Driveからポートフォリオデータを読み込む
 * @param {string} accessToken - アクセストークン
 * @param {string} fileId - ファイルID
 * @returns {Promise<Object>} - ポートフォリオデータ
 */
const loadPortfolioFromDrive = async (accessToken, fileId) => {
  try {
    // Google Drive APIクライアントの設定
    const drive = google.drive({
      version: 'v3',
      auth: new google.auth.OAuth2().setCredentials({ access_token: accessToken })
    });
    
    // ファイルの内容を取得
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media'
    });
    
    // ファイルのメタデータも取得
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: 'name, createdTime, modifiedTime'
    });
    
    return {
      success: true,
      data: response.data,
      fileName: fileMetadata.data.name,
      createdTime: fileMetadata.data.createdTime,
      modifiedTime: fileMetadata.data.modifiedTime
    };
  } catch (error) {
    console.error('Drive読み込みエラー:', error);
    throw new Error('Google Driveからのデータ読み込みに失敗しました');
  }
};

// エクスポート
module.exports = {
  exchangeCodeForTokens,
  verifyIdToken,
  createUserSession,
  getSession,
  invalidateSession,
  refreshAccessToken,
  savePortfolioToDrive,
  listPortfolioFiles,
  loadPortfolioFromDrive
};
