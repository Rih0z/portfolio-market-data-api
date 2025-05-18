/**
 * ファイルパス: __tests__/unit/utils/tokenManager.test.js
 * 
 * TokenManagerのユニットテスト
 * 
 * @author Portfolio Manager Team
 * @created 2025-05-20
 */

// テスト対象モジュールのインポート
const tokenManager = require('../../../src/utils/tokenManager');

// 依存モジュールのインポート
const { OAuth2Client } = require('google-auth-library');
const { withRetry } = require('../../../src/utils/retry');
const logger = require('../../../src/utils/logger');

// モックの設定
jest.mock('google-auth-library');
jest.mock('../../../src/utils/retry');
jest.mock('../../../src/utils/logger');

describe('TokenManager', () => {
  // テスト用のモックデータ
  const mockSession = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    tokenExpiry: new Date(Date.now() + 1000 * 60 * 60).toISOString() // 1時間後
  };

  const mockExpiredSession = {
    accessToken: 'expired-access-token',
    refreshToken: 'test-refresh-token',
    tokenExpiry: new Date(Date.now() - 1000 * 60 * 60).toISOString() // 1時間前（期限切れ）
  };

  const mockNewTokens = {
    access_token: 'new-access-token',
    refresh_token: 'new-refresh-token',
    expires_in: 3600
  };

  const mockIdTokenPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    name: 'Test User'
  };

  let mockOAuth2Client;

  beforeEach(() => {
    // テスト前の準備
    jest.clearAllMocks();

    // モックのTicketオブジェクト
    const mockTicket = {
      getPayload: jest.fn().mockReturnValue(mockIdTokenPayload)
    };

    // OAuth2Clientのモック実装
    mockOAuth2Client = {
      // refreshAccessTokenはこの形式で返す必要があります
      refreshAccessToken: jest.fn().mockResolvedValue({
        credentials: mockNewTokens
      }),
      // verifyIdTokenはチケットオブジェクトを返す
      verifyIdToken: jest.fn().mockResolvedValue(mockTicket),
      // getTokenはtokensプロパティを返す
      getToken: jest.fn().mockResolvedValue({ 
        tokens: mockNewTokens 
      }),
      setCredentials: jest.fn()
    };

    // OAuth2Clientコンストラクタのモック
    OAuth2Client.mockImplementation(() => mockOAuth2Client);

    // withRetryのモック実装
    withRetry.mockImplementation(fn => fn());
  });
  
  afterEach(() => {
    // テスト後のクリーンアップ
  });
  
  // エクスポートされた関数をテスト
  describe('validateAndRefreshToken', () => {
    test('有効期限内のトークンの場合は更新しない', async () => {
      const result = await tokenManager.validateAndRefreshToken(mockSession);
      
      expect(result).toEqual({
        accessToken: mockSession.accessToken,
        refreshed: false
      });

      // OAuth2ClientのsetCredentialsが呼ばれていないことを確認
      expect(mockOAuth2Client.setCredentials).not.toHaveBeenCalled();
    });

    test('有効期限切れのトークンを更新する', async () => {
      const result = await tokenManager.validateAndRefreshToken(mockExpiredSession);
      
      expect(result).toEqual({
        accessToken: mockNewTokens.access_token,
        refreshToken: mockNewTokens.refresh_token,
        tokenExpiry: expect.any(String),
        refreshed: true
      });

      // OAuth2ClientのsetCredentialsが呼ばれたことを確認
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: mockExpiredSession.refreshToken
      });
    });

    test('セッションがnullの場合はエラーをスローする', async () => {
      await expect(tokenManager.validateAndRefreshToken(null))
        .rejects
        .toThrow('セッション情報が不足しています');
    });

    test('リフレッシュトークンがない場合はエラーをスローする', async () => {
      const sessionWithoutRefreshToken = {
        ...mockExpiredSession,
        refreshToken: null
      };

      await expect(tokenManager.validateAndRefreshToken(sessionWithoutRefreshToken))
        .rejects
        .toThrow('リフレッシュトークンが存在しません');
    });
  });

  describe('refreshAccessToken', () => {
    test('リフレッシュトークンを使用してアクセストークンを更新する', async () => {
      const result = await tokenManager.refreshAccessToken('test-refresh-token');
      
      expect(result).toEqual(mockNewTokens);

      // OAuth2ClientのsetCredentialsが呼ばれたことを確認
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: 'test-refresh-token'
      });
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
    });

    test('エラー発生時は適切なエラーメッセージをスローする', async () => {
      // refreshAccessTokenでエラーが発生するようにモック設定
      const mockError = new Error('Token refresh failed');
      mockOAuth2Client.refreshAccessToken.mockRejectedValueOnce(mockError);

      await expect(tokenManager.refreshAccessToken('test-refresh-token'))
        .rejects
        .toThrow('アクセストークンの更新に失敗しました');

      expect(logger.error).toHaveBeenCalledWith('トークン更新エラー:', mockError);
    });
  });

  describe('verifyIdToken', () => {
    test('IDトークンを検証してユーザー情報を取得する', async () => {
      const result = await tokenManager.verifyIdToken('test-id-token');
      
      expect(result).toEqual(mockIdTokenPayload);

      // OAuth2ClientのverifyIdTokenが呼ばれたことを確認
      expect(mockOAuth2Client.verifyIdToken).toHaveBeenCalledWith({
        idToken: 'test-id-token',
        audience: process.env.GOOGLE_CLIENT_ID
      });
    });

    test('トークン期限切れエラーの場合は適切なメッセージをスローする', async () => {
      // verifyIdTokenでトークン期限切れエラーが発生するようにモック設定
      const mockError = new Error('Token has expired');
      mockOAuth2Client.verifyIdToken.mockRejectedValueOnce(mockError);

      await expect(tokenManager.verifyIdToken('expired-token'))
        .rejects
        .toThrow('IDトークンの有効期限が切れています');

      expect(logger.error).toHaveBeenCalledWith('IDトークン検証エラー:', mockError);
    });

    test('audience不一致エラーの場合は適切なメッセージをスローする', async () => {
      // verifyIdTokenでaudience不一致エラーが発生するようにモック設定
      const mockError = new Error('Invalid audience');
      mockOAuth2Client.verifyIdToken.mockRejectedValueOnce(mockError);

      await expect(tokenManager.verifyIdToken('invalid-audience-token'))
        .rejects
        .toThrow('IDトークンの対象者(audience)が不正です');

      expect(logger.error).toHaveBeenCalledWith('IDトークン検証エラー:', mockError);
    });
  });

  describe('exchangeCodeForTokens', () => {
    test('認証コードをトークンと交換する', async () => {
      const result = await tokenManager.exchangeCodeForTokens('test-auth-code', 'https://example.com/callback');
      
      expect(result).toEqual(mockNewTokens);

      // OAuth2ClientのgetTokenが呼ばれたことを確認
      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith({
        code: 'test-auth-code',
        redirect_uri: 'https://example.com/callback'
      });
    });

    test('invalid_grantエラーの場合は適切なメッセージをスローする', async () => {
      // getTokenでinvalid_grantエラーが発生するようにモック設定
      const mockError = new Error('invalid_grant');
      mockOAuth2Client.getToken.mockRejectedValueOnce(mockError);

      await expect(tokenManager.exchangeCodeForTokens('invalid-code', 'https://example.com/callback'))
        .rejects
        .toThrow('認証コードが無効または期限切れです');

      expect(logger.error).toHaveBeenCalledWith('トークン交換エラー:', mockError);
    });

    test('redirect_uri_mismatchエラーの場合は適切なメッセージをスローする', async () => {
      // getTokenでredirect_uri_mismatchエラーが発生するようにモック設定
      const mockError = new Error('redirect_uri_mismatch');
      mockOAuth2Client.getToken.mockRejectedValueOnce(mockError);

      await expect(tokenManager.exchangeCodeForTokens('test-code', 'https://invalid-uri.com'))
        .rejects
        .toThrow('リダイレクトURIが一致しません');

      expect(logger.error).toHaveBeenCalledWith('トークン交換エラー:', mockError);
    });
  });
});
