/**
 * ファイルパス: __tests__/unit/function/auth/googleLogin.test.js
 *
 * Googleログインハンドラーのユニットテスト
 */

const { handler } = require('../../../../src/function/auth/googleLogin');
const googleAuthService = require('../../../../src/services/googleAuthService');
const responseUtils = require('../../../../src/utils/responseUtils');
const cookieParser = require('../../../../src/utils/cookieParser');

jest.mock('../../../../src/services/googleAuthService');
jest.mock('../../../../src/utils/responseUtils');
jest.mock('../../../../src/utils/cookieParser');

beforeEach(() => {
  jest.clearAllMocks();
  responseUtils.formatResponse.mockResolvedValue({ ok: true });
  responseUtils.formatErrorResponse.mockResolvedValue({ ok: false });
  cookieParser.createSessionCookie.mockReturnValue('session=test; HttpOnly');
});

describe('googleLogin handler', () => {
  test('正常系: 認証コードからセッションを作成する', async () => {
    googleAuthService.exchangeCodeForTokens.mockResolvedValue({
      id_token: 'id',
      access_token: 'access',
      refresh_token: 'refresh',
      expires_in: 3600
    });
    googleAuthService.verifyIdToken.mockResolvedValue({
      sub: 'uid',
      email: 'user@example.com',
      name: 'User',
      picture: 'pic'
    });
    googleAuthService.createUserSession.mockResolvedValue({ sessionId: 'sid' });

    const event = { body: JSON.stringify({ code: 'abc', redirectUri: 'u' }) };
    const res = await handler(event);

    expect(googleAuthService.exchangeCodeForTokens).toHaveBeenCalledWith('abc', 'u');
    expect(googleAuthService.verifyIdToken).toHaveBeenCalledWith('id');
    expect(googleAuthService.createUserSession).toHaveBeenCalledWith(expect.objectContaining({ googleId: 'uid' }));
    expect(cookieParser.createSessionCookie).toHaveBeenCalledWith('sid', expect.any(Number));
    expect(responseUtils.formatResponse).toHaveBeenCalled();
    expect(res).toEqual({ ok: true });
  });

  test('異常系: 認証コードが無い場合', async () => {
    const event = { body: JSON.stringify({}) };
    const res = await handler(event);

    expect(responseUtils.formatErrorResponse).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      code: 'INVALID_PARAMS'
    }));
    expect(res).toEqual({ ok: false });
  });

  test('異常系: トークン交換失敗', async () => {
    googleAuthService.exchangeCodeForTokens.mockRejectedValue(new Error('fail'));

    const event = { body: JSON.stringify({ code: 'bad', redirectUri: 'u' }) };
    const res = await handler(event);

    expect(responseUtils.formatErrorResponse).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      code: 'AUTH_ERROR'
    }));
    expect(res).toEqual({ ok: false });
  });

  test('異常系: IDトークン検証失敗', async () => {
    googleAuthService.exchangeCodeForTokens.mockResolvedValue({ id_token: 'id' });
    googleAuthService.verifyIdToken.mockRejectedValue(new Error('bad id'));

    const event = { body: JSON.stringify({ code: 'abc', redirectUri: 'u' }) };
    const res = await handler(event);

    expect(responseUtils.formatErrorResponse).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      code: 'AUTH_ERROR'
    }));
    expect(res).toEqual({ ok: false });
  });

  test('異常系: セッション作成失敗', async () => {
    googleAuthService.exchangeCodeForTokens.mockResolvedValue({ id_token: 'id' });
    googleAuthService.verifyIdToken.mockResolvedValue({ sub: 'uid', email: 'e' });
    googleAuthService.createUserSession.mockRejectedValue(new Error('ng'));

    const event = { body: JSON.stringify({ code: 'abc', redirectUri: 'u' }) };
    const res = await handler(event);

    expect(responseUtils.formatErrorResponse).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      code: 'AUTH_ERROR'
    }));
    expect(res).toEqual({ ok: false });
  });
});
