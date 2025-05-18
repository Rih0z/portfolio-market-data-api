# テストファイル作成ガイドライン

## 1. 概要

本ドキュメントでは、テストファイルを作成する際の基準と手順を定義します。テストファイルとソースコードの一貫性を保ち、参照エラーを防止するためのガイドラインです。プロジェクトでは次の3種類のテストを実装しています：

- **ユニットテスト**: 個々の関数やクラスの機能をテスト
- **統合テスト**: 複数のコンポーネントの連携をテスト
- **E2Eテスト**: エンドユーザーの視点からシステム全体の動作をテスト

## 2. ディレクトリ構造と命名規則

### 2.1 ディレクトリ構造

```
__tests__/
├── e2e/                    # エンドツーエンドテスト
│   ├── API_test.js
│   └── ...
├── integration/            # 統合テスト
│   ├── auth/
│   │   ├── authFlow.test.js
│   │   └── ...
│   └── marketData/
│       └── ...
├── unit/                   # ユニットテスト
│   ├── function/
│   │   ├── auth/
│   │   │   ├── getSession.test.js
│   │   │   └── ...
│   │   └── ...
│   ├── services/
│   │   ├── cache.test.js
│   │   └── ...
│   └── utils/
│       ├── responseUtils.test.js
│       └── ...
├── setup.js                # Jest設定ファイル
└── testUtils/              # テスト用ユーティリティ
    ├── apiMocks.js
    ├── apiServer.js
    ├── environment.js
    └── ...
```

### 2.2 命名規則

1. **ユニットテスト・統合テスト**
   - テストファイル名: `{ソースファイル名}.test.js`
   - 例: `src/services/cache.js` → `__tests__/unit/services/cache.test.js`

2. **E2Eテスト**
   - テストファイル名: `{機能名}_test.js` または `{機能名}.test.js`
   - 例: `__tests__/e2e/API_test.js`, `__tests__/e2e/authenticatedDataAccess.test.js`

3. **ディレクトリ構造の反映**
   - ソースコードのディレクトリ構造をテストディレクトリにも反映させる
   - 例: `src/services/sources/yahooFinance.js` → `__tests__/unit/services/sources/yahooFinance.test.js`

## 3. テストファイルの基本構造

```javascript
/**
 * ファイルパス: __tests__/unit/services/example.test.js
 * 
 * ExampleServiceのユニットテスト
 * サービスの主な機能と目的の説明
 * 
 * @author 開発者名
 * @created YYYY-MM-DD
 * @updated YYYY-MM-DD 修正内容の簡単な説明
 */

// テスト対象モジュールのインポート
const exampleService = require('../../../src/services/example');

// 依存モジュールのインポート
const dependencyModule = require('../../../src/utils/dependency');
const externalModule = require('external-package');

// モジュールのモック化
jest.mock('../../../src/utils/dependency');
jest.mock('external-package');

describe('Example Service', () => {
  // テスト用データ
  const mockData = {
    id: '123',
    name: 'Test Item'
  };
  
  // 各テスト前の準備
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // モックの実装を設定
    dependencyModule.someFunction.mockReturnValue('mocked value');
    externalModule.callApi.mockResolvedValue({ data: { result: 'success' } });
  });
  
  // 各テスト後のクリーンアップ
  afterEach(() => {
    // 必要に応じてクリーンアップ処理
  });
  
  describe('functionName', () => {
    test('正常系のテスト: 期待される動作の説明', async () => {
      // テスト実行
      const result = await exampleService.functionName(mockData.id);
      
      // 検証
      expect(result).toBeDefined();
      expect(result.name).toBe('Test Item');
      
      // モックが正しく呼ばれたことを検証
      expect(dependencyModule.someFunction).toHaveBeenCalledWith(mockData.id);
      expect(externalModule.callApi).toHaveBeenCalledTimes(1);
    });
    
    test('異常系のテスト: エラーケース', async () => {
      // エラーをスローするようにモック
      externalModule.callApi.mockRejectedValue(new Error('API error'));
      
      // テスト実行と例外の検証
      await expect(exampleService.functionName(mockData.id))
        .rejects.toThrow('処理に失敗しました');
    });
  });
});
```

## 4. テスト種別ごとの実装パターン

### 4.1 ユニットテスト

ユニットテストは小さく独立した機能単位をテストします。外部依存はすべてモック化します。

```javascript
// src/utils/formatter.js のユニットテストの例
describe('Formatter Utils', () => {
  describe('formatCurrency', () => {
    test('日本円のフォーマット', () => {
      const result = formatter.formatCurrency(1000, 'JPY');
      expect(result).toBe('¥1,000');
    });
    
    test('米ドルのフォーマット', () => {
      const result = formatter.formatCurrency(1000, 'USD');
      expect(result).toBe('$1,000.00');
    });
  });
});
```

### 4.2 統合テスト

統合テストは複数のコンポーネントの連携をテストします。一部の依存をモック化する場合もあります。

```javascript
// src/function/auth/googleLogin.js の統合テストの例
describe('Google Login Handler', () => {
  test('認証コードからユーザー情報を取得してセッションを作成する', async () => {
    // Google APIレスポンスをモック
    googleAuthService.exchangeCodeForTokens.mockResolvedValue({
      id_token: 'test-id-token',
      access_token: 'test-access-token'
    });
    
    // リクエストイベントを作成
    const event = {
      body: JSON.stringify({
        code: 'valid-auth-code',
        redirectUri: 'https://app.example.com/callback'
      })
    };
    
    // テスト実行
    const response = await handler(event);
    
    // 検証
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).isAuthenticated).toBe(true);
    
    // セッションが作成されたことを検証
    expect(googleAuthService.createUserSession).toHaveBeenCalled();
  });
});
```

### 4.3 E2Eテスト

E2Eテストはユーザーの視点からシステム全体の動作をテストします。実際のAPIエンドポイントを呼び出すか、精度の高いモックを使用します。

```javascript
// マーケットデータAPIのE2Eテストの例
describe('マーケットデータAPI', () => {
  conditionalTest('米国株データ取得', async () => {
    try {
      // APIリクエスト
      const response = await axios.get(`${API_BASE_URL}/api/market-data`, {
        params: {
          type: 'us-stock',
          symbols: TEST_DATA.usStock.symbol
        }
      });
      
      // レスポンス検証
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      
      const stockData = response.data.data[TEST_DATA.usStock.symbol];
      expect(stockData).toBeDefined();
      expect(stockData.ticker).toBe(TEST_DATA.usStock.symbol);
      expect(stockData.price).toBeGreaterThan(0);
    } catch (error) {
      console.error('テストエラー:', error.message);
      throw error;
    }
  });
});
```

## 5. モックの設定パターン

### 5.1 基本的なモック

```javascript
// モジュール全体をモック
jest.mock('../../../src/utils/logger');

// 特定の関数をモック
logger.logError = jest.fn();
logger.logInfo.mockImplementation((message) => {
  console.log(`[INFO MOCK] ${message}`);
});

// 戻り値を設定
someFunction.mockReturnValue('固定値');
someFunction.mockReturnValueOnce('1回目の呼び出し').mockReturnValueOnce('2回目の呼び出し');

// Promise戻り値を設定
asyncFunction.mockResolvedValue({ success: true });
asyncFunction.mockRejectedValue(new Error('エラー'));
```

### 5.2 AWS SDKのモック

```javascript
// DynamoDBクライアントのモック
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

// モックの実装
const mockSend = jest.fn();
DynamoDBClient.mockImplementation(() => ({
  send: mockSend
}));

// コマンドのモック
const mockGetCommand = jest.fn();
GetCommand.mockImplementation((params) => {
  mockGetCommand(params);
  return { params };
});

// モックレスポンスの設定
mockSend.mockResolvedValueOnce({
  Item: {
    id: { S: 'test-id' },
    data: { S: JSON.stringify({ name: 'Test Item' }) }
  }
});
```

### 5.3 外部APIのモック

```javascript
// axiosのモック
jest.mock('axios');

// モックレスポンスの設定
axios.get.mockResolvedValue({
  data: {
    success: true,
    results: [{ id: 1, name: 'Item 1' }]
  }
});

// モックエラーの設定
axios.post.mockRejectedValue({
  response: {
    status: 400,
    data: { error: 'Bad Request' }
  }
});
```

### 5.4 プロジェクト固有のモックユーティリティ

プロジェクトには便利なモックユーティリティが用意されています。

```javascript
// APIリクエストのモック
const { mockApiRequest, resetApiMocks } = require('../../testUtils/apiMocks');

// テスト前にモックをリセット
beforeEach(() => {
  resetApiMocks();
});

// APIリクエストをモック
mockApiRequest(`${API_BASE_URL}/api/market-data`, 'GET', {
  success: true,
  data: {
    'AAPL': {
      ticker: 'AAPL',
      price: 190.5,
      change: 2.3,
      currency: 'USD'
    }
  }
}, 200, {}, { 
  queryParams: { 
    type: 'us-stock', 
    symbols: 'AAPL' 
  } 
});
```

## 6. 非同期テストのパターン

### 6.1 async/awaitパターン

```javascript
test('非同期関数のテスト', async () => {
  // 非同期関数の実行
  const result = await asyncFunction();
  
  // 結果の検証
  expect(result).toBe(expectedValue);
});
```

### 6.2 例外のテスト

```javascript
test('非同期関数の例外テスト', async () => {
  // エラーが発生することを検証
  await expect(asyncFunction()).rejects.toThrow('エラーメッセージ');
  
  // 特定のエラーオブジェクトが返されることを検証
  await expect(asyncFunction()).rejects.toEqual(
    expect.objectContaining({
      code: 'ERROR_CODE',
      message: expect.stringContaining('エラー')
    })
  );
});
```

### 6.3 タイムアウトのテスト

```javascript
test('タイムアウトのテスト', async () => {
  // タイムアウトを設定
  jest.setTimeout(1000);
  
  // タイマーをモック
  jest.useFakeTimers();
  
  // 非同期処理を開始
  const promise = longRunningFunction();
  
  // タイマーを進める
  jest.advanceTimersByTime(2000);
  
  // タイムアウトが発生することを検証
  await expect(promise).rejects.toThrow('Timeout');
  
  // タイマーをリセット
  jest.useRealTimers();
});
```

## 7. 環境変数の取り扱い

### 7.1 環境変数の設定とリセット

```javascript
describe('環境変数を使用するテスト', () => {
  // 元の環境変数を保存
  const originalEnv = process.env;
  
  beforeEach(() => {
    // 環境変数をリセット
    process.env = { ...originalEnv };
    
    // テスト用の環境変数を設定
    process.env.API_KEY = 'test-api-key';
    process.env.DEBUG = 'true';
  });
  
  afterAll(() => {
    // テスト後に環境変数を元に戻す
    process.env = originalEnv;
  });
  
  test('環境変数を使用する関数のテスト', () => {
    const result = getApiConfig();
    expect(result.apiKey).toBe('test-api-key');
  });
});
```

### 7.2 NODE_ENVの設定

```javascript
test('開発環境での動作テスト', () => {
  process.env.NODE_ENV = 'development';
  
  const result = getEnvironmentConfig();
  expect(result.isDevelopment).toBe(true);
});

test('本番環境での動作テスト', () => {
  process.env.NODE_ENV = 'production';
  
  const result = getEnvironmentConfig();
  expect(result.isDevelopment).toBe(false);
});
```

## 8. テスト環境のセットアップと破棄

### 8.1 テスト環境セットアップ

```javascript
// テスト環境のセットアップ
beforeAll(async () => {
  await setupTestEnvironment();
  
  // APIサーバーの起動確認またはモック設定
  try {
    if (USE_MOCKS) {
      // モックAPIレスポンスを設定
      setupMockResponses();
      console.log(`✅ Using mock API responses`);
      apiServerAvailable = true;
    } else {
      // 実際のAPIサーバーを使用する場合の確認
      const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
      apiServerAvailable = response.status === 200;
      console.log(`✅ API server is running at ${API_BASE_URL}`);
    }
  } catch (error) {
    console.warn(`❌ API server is not running: ${error.message}`);
    console.warn(`Tests will be skipped unless mocks are enabled`);
  }
});

// テスト環境のクリーンアップ
afterAll(async () => {
  await teardownTestEnvironment();
});
```

### 8.2 条件付きテスト

```javascript
// 条件付きテスト関数 - APIサーバーが実行されていない場合はスキップ
const conditionalTest = (name, fn) => {
  if (!apiServerAvailable && !USE_MOCKS) {
    test.skip(name, () => {
      console.log(`Skipping test: ${name} - API server not available and mocks not enabled`);
    });
  } else {
    test(name, fn);
  }
};

// 条件付きテストの使用
conditionalTest('APIが利用可能な場合のみ実行するテスト', async () => {
  // テスト内容
});
```

## 9. テストユーティリティの活用

プロジェクトには以下のテストユーティリティが用意されています：

### 9.1 環境セットアップユーティリティ

- `environment.js`: テスト環境のセットアップと破棄
- `awsEmulator.js`: AWS サービスのローカルエミュレーション
- `dynamodbLocal.js`: DynamoDB Localの管理

### 9.2 モックユーティリティ

- `apiMocks.js`: APIリクエストのモック設定
- `googleMock.js`: Google OAuth2認証のモック
- `mockServer.js`: 外部APIのモックサーバー
- `failureSimulator.js`: データソース障害のシミュレーション

### 9.3 APIサーバーユーティリティ

- `apiServer.js`: テスト用APIサーバーの起動と停止

```javascript
// ユーティリティの使用例
const { setupTestEnvironment, teardownTestEnvironment } = require('../testUtils/environment');
const { mockApiRequest, resetApiMocks } = require('../testUtils/apiMocks');
const { simulateDataSourceFailure, resetDataSources } = require('../testUtils/failureSimulator');

beforeAll(async () => {
  await setupTestEnvironment();
});

afterAll(async () => {
  await teardownTestEnvironment();
});

beforeEach(() => {
  resetApiMocks();
});

test('データソース障害時のフォールバック動作', async () => {
  // Yahoo Finance APIの障害をシミュレート
  await simulateDataSourceFailure('yahoo-finance-api');
  
  // テスト実行
  const result = await marketDataService.getStockData('AAPL');
  
  // フォールバック結果の検証
  expect(result.source).toContain('fallback');
  
  // データソースをリセット
  await resetDataSources();
});
```

## 10. 前提条件確認

テストファイル作成前に、以下の確認を必ず行ってください：

1. **ソースコードの存在確認**
   ```bash
   # ソースファイルの存在を確認
   ls -la src/services/cache.js
   
   # ファイルが存在しない場合は検索で確認
   find src -name "cache*.js"
   ```

2. **ファイル内容の確認**
   ```bash
   # ファイルの内容を確認して、正確な関数名やモジュール構造を把握
   cat src/services/cache.js
   ```

3. **エクスポートの確認**
   ```bash
   # どの関数がエクスポートされているかを確認
   grep -n "module.exports" src/services/cache.js
   ```

4. **依存関係の確認**
   ```bash
   # ソースファイルの依存関係を確認
   grep -n "require(" src/services/cache.js
   ```

## 11. テストファイル作成フロー

1. **適切なディレクトリを選択する**
   - ユニットテスト: `__tests__/unit/{カテゴリ}/`
   - 統合テスト: `__tests__/integration/{カテゴリ}/`
   - E2Eテスト: `__tests__/e2e/`

2. **テストファイルを作成する**
   ```bash
   mkdir -p __tests__/unit/services
   touch __tests__/unit/services/example.test.js
   ```

3. **インポートを設定する**
   ```javascript
   // テスト対象モジュールをインポート
   const exampleService = require('../../../src/services/example');
   
   // 依存モジュールをインポート
   const dependency = require('../../../src/utils/dependency');
   ```

4. **モックを設定する**
   ```javascript
   // 依存モジュールをモック化
   jest.mock('../../../src/utils/dependency');
   
   // モック実装を設定
   dependency.someFunction.mockReturnValue('mocked result');
   ```

5. **テストケースを作成する**
   ```javascript
   describe('Example Service', () => {
     // テスト用データ
     const mockData = { id: '123', name: 'Test' };
     
     // モックリセット
     beforeEach(() => {
       jest.clearAllMocks();
     });
     
     // テストケース
     test('正常系テスト', async () => {
       const result = await exampleService.someFunction(mockData);
       expect(result).toBeDefined();
     });
   });
   ```

6. **テストを実行する**
   ```bash
   # 特定のテストファイルを実行
   npm test -- __tests__/unit/services/example.test.js
   
   # 特定のテストケースを実行
   npm test -- -t "正常系テスト"
   ```

## 12. チェックリスト

テストファイル作成完了時に以下のチェックリストを確認してください：

- [ ] テストファイル名と格納先ディレクトリは命名規則に準拠している
- [ ] インポートパスは正確で、実際に存在するファイルを参照している
- [ ] モック化する対象モジュールは、ソースコードで実際に使用されている
- [ ] エクスポートされる全ての公開関数に対するテストが網羅されている
- [ ] 正常系と異常系の両方のテストケースを含んでいる
- [ ] 非同期関数は適切に await または .then/.catch を使用している
- [ ] 環境変数を変更する場合は、テスト後に元の値に戻している
- [ ] モックは各テスト前に正しくリセットされている
- [ ] テスト実行時に不要なコンソール出力やエラーが発生していない
- [ ] テストの説明文は明確で、何をテストしているか理解できる

## 13. 参考リソース

- Jest ドキュメント: https://jestjs.io/docs/
- JavaScript テスティングのベストプラクティス: https://github.com/goldbergyoni/javascript-testing-best-practices
- AWS SDK JavaScript v3 テスト: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/testing-mocking.html
