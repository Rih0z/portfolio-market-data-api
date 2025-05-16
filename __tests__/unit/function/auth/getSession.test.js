// __tests__/unit/function/auth/getSession.test.js
const { handler } = require('../../../../src/function/auth/getSession');

// Fix: Properly mock all dependencies
jest.mock('../../../../src/utils/responseUtils', () => ({
  formatSuccessResponse: jest.fn().mockImplementation(data => ({
    statusCode: 200, 
    body: JSON.stringify({ success: true, data })
  })),
  formatErrorResponse: jest.fn().mockImplementation(({ statusCode, errorCode, message }) => ({
    statusCode,
    body: JSON.stringify({ 
      success: false, 
      error: { code: errorCode, message } 
    })
  }))
}));

// Mock AWS SDK modules
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  }))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn().mockImplementation(() => ({
        send: mockSend
      }))
    },
    GetCommand: jest.fn().mockImplementation(params => ({
      ...params,
      constructor: { name: 'GetCommand' }
    }))
  };
});

jest.mock('../../../../src/utils/dynamoDbService', () => {
  const mockSend = jest.fn();
  mockSend.mockImplementation((command) => {
    // Return session for test-session-id
    if (command.Key && command.Key.sessionId === 'test-session-id') {
      return Promise.resolve({
        Item: {
          sessionId: 'test-session-id',
          userId: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://example.com/profile.jpg',
          expires: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
        }
      });
    }
    
    // Return a 404 for missing sessions
    return Promise.reject(new Error('Session not found'));
  });
  
  return {
    getDynamoDBClient: jest.fn().mockReturnValue({ send: mockSend }),
    getTableName: jest.fn().mockReturnValue('test-sessions')
  };
});

// Import mocked modules
const responseUtils = require('../../../../src/utils/responseUtils');
const { getDynamoDBClient, getTableName } = require('../../../../src/utils/dynamoDbService');

describe('Get Session Handler', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });
  
  test('有効なセッションIDを含むCookieでリクエストした場合、セッション情報を返す', async () => {
    // セッションIDを含むCookieを設定
    const event = {
      headers: {
        cookie: 'session=test-session-id'
      }
    };
    
    // ハンドラーを実行
    const response = await handler(event);
    
    // レスポンスを検証
    expect(response.statusCode).toBe(200);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.success).toBe(true);
    expect(responseBody.data.userId).toBe('test-user-id');
    expect(responseBody.data.email).toBe('test@example.com');
    
    // DynamoDBが呼び出されたことを検証
    expect(getDynamoDBClient).toHaveBeenCalled();
    expect(getTableName).toHaveBeenCalledWith('sessions');
  });
  
  test('Cookieが存在しない場合、認証エラーを返す', async () => {
    // Cookieなしのリクエスト
    const event = {
      headers: {}
    };
    
    // ハンドラーを実行
    const response = await handler(event);
    
    // レスポンスを検証
    expect(response.statusCode).toBe(401);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('UNAUTHORIZED');
    
    // Fix: responseUtils.formatErrorResponseが呼び出されたことを確認
    expect(responseUtils.formatErrorResponse).toHaveBeenCalled();
  });
  
  test('無効なセッションIDを含むCookieでリクエストした場合、認証エラーを返す', async () => {
    // 無効なセッションIDを含むCookie
    const event = {
      headers: {
        cookie: 'session=invalid-session-id'
      }
    };
    
    // Fix: Mock specific behavior for invalid session ID
    const mockDynamoDbClient = getDynamoDBClient();
    mockDynamoDbClient.send.mockRejectedValueOnce(new Error('Session not found'));
    
    // ハンドラーを実行
    const response = await handler(event);
    
    // レスポンスを検証
    expect(response.statusCode).toBe(401);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('UNAUTHORIZED');
  });
  
  test('ヘッダーがない場合も認証エラーを返す', async () => {
    // ヘッダーなしのリクエスト
    const event = {};
    
    // ハンドラーを実行
    const response = await handler(event);
    
    // レスポンスを検証
    expect(response.statusCode).toBe(401);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.success).toBe(false);
    
    // responseUtils.formatErrorResponseが呼び出されたことを検証
    expect(responseUtils.formatErrorResponse).toHaveBeenCalled();
  });
  
  test('セッション取得時にエラーが発生した場合、エラーレスポンスを返す', async () => {
    // セッションIDを含むCookie
    const event = {
      headers: {
        cookie: 'session=db-session-123'
      }
    };
    
    // セッション取得時にエラーが発生するようにモック
    const mockDynamoDbClient = getDynamoDBClient();
    mockDynamoDbClient.send.mockRejectedValueOnce(new Error('Database connection error'));
    
    // ハンドラーを実行
    const response = await handler(event);
    
    // レスポンスを検証
    expect(response.statusCode).toBe(401);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('UNAUTHORIZED');
  });
  
  test('有効期限切れのセッションIDでリクエストした場合、認証エラーを返す', async () => {
    // 有効期限切れのセッションIDを含むCookie
    const event = {
      headers: {
        cookie: 'session=expired-session-id'
      }
    };
    
    // 有効期限切れのセッションを返すようにモック
    const mockDynamoDbClient = getDynamoDBClient();
    mockDynamoDbClient.send.mockResolvedValueOnce({
      Item: {
        sessionId: 'expired-session-id',
        userId: 'test-user-id',
        expires: Math.floor(Date.now() / 1000) - 3600 // 1 hour in the past
      }
    });
    
    // ハンドラーを実行
    const response = await handler(event);
    
    // レスポンスを検証
    expect(response.statusCode).toBe(401);
    const responseBody = JSON.parse(response.body);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('SESSION_EXPIRED');
  });
});
