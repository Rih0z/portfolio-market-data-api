# PFWise-API テスト修正ガイド

## 1. モック化の問題と修正方針

PFWise-APIのテスト失敗の主な原因はモック化の不一致です。このドキュメントではテストを修正するための一般的な方針を説明します。

### 根本的な問題

1. **インポート方式の不一致**
   - テスト側: モジュール全体をモック化 (`jest.mock('../path/to/module')`)
   - 実装側: 分割代入でメソッドを直接インポート (`const { method1, method2 } = require('../path/to/module')`)

2. **呼び出し方式の不一致**
   - テスト側: `module.method()` の形式を期待
   - 実装側: 直接 `method()` を呼び出す

### 修正方針

1. **実装ファイルのインポート修正**
   - 分割代入を避け、モジュール全体をインポート
   ```javascript
   // 修正前
   const { method1, method2 } = require('../path/to/module');
   
   // 修正後
   const module = require('../path/to/module');
   ```

2. **関数呼び出しの修正**
   - メソッド呼び出しを `module.method()` 形式に変更
   ```javascript
   // 修正前
   method1(param1, param2);
   
   // 修正後
   module.method1(param1, param2);
   ```

## 2. 修正済みの例: googleAuthService.js

```javascript
/**
 * Google認証サービス - OAuth認証とセッション管理機能
 */
'use strict';

const uuid = require('uuid');
// 分割代入でのインポートからモジュールとしてのインポートに変更
const dynamoDbService = require('../utils/dynamoDbService');
const tokenManager = require('../utils/tokenManager');

// ... (中略)

const createUserSession = async (userData) => {
  // ... (前略)
  
  try {
    // 関数呼び出しをdynamoDbService.関数名の形式に変更
    await dynamoDbService.addItem(SESSION_TABLE, sessionItem);
    
    return {
      sessionId,
      expiresAt: expiresAt.toISOString()
    };
  } catch (error) {
    console.error('セッション作成エラー:', error);
    throw new Error('ユーザーセッションの作成に失敗しました');
  }
};

// ... (後略)
```

## 3. 各ファイルの修正ポイント

### tokenManager.test.js

1. **問題点**: モック化されている `google-auth-library` や他のモジュールとの不整合
2. **修正点**:
   - `tokenManager.js` 内でのインポート方法を確認
   - 分割代入を避け、モジュール全体をインポートするよう修正

### yahooFinance.test.js

1. **問題点**: API呼び出しのモックと実装の不一致
2. **修正点**:
   - `axios` のモック化方法の確認
   - モックされた関数の呼び出し方法が正しいか確認

### responseUtils.test.js

1. **問題点**: レスポンス生成関数のモック化の問題
2. **修正点**:
   - リクエスト/レスポンスオブジェクトのモック化方法の確認
   - 呼び出しパターンの一致確認

### portfolioService.test.js

1. **問題点**: ファイル名や日付パターンの不一致
2. **修正点**:
   - 日付生成のモック化 (例: `Date.now()` をモックして固定値を返す)
   - ファイル名生成部分の確認と修正

### googleDriveService.test.js

1. **問題点**: Google APIとの連携部分のモック化不備
2. **修正点**:
   - Google Drive APIクライアントのモック化確認
   - ファイル操作関数の呼び出し方法の修正

## 4. テスト環境設定の確認

1. **jest.config.js の確認**
   - モックが正しく設定されているか
   - 適切な変換設定があるか

2. **環境変数の設定**
   - テスト用の環境変数が適切に設定されているか
   - `process.env.NODE_ENV = 'test'` などが設定されているか

3. **モックの初期化タイミング**
   - `beforeEach` や `beforeAll` でモックが正しく初期化されているか
   - テスト後に `jest.clearAllMocks()` などが実行されているか

## 5. 一般的なモックのベストプラクティス

1. **一貫性のあるインポート方法を使用する**
   - モジュール全体をインポートする方法を優先
   - 分割代入を使用する場合は、テスト側でも分割代入に対応したモック化が必要

2. **モック関数の戻り値を明示的に設定する**
   ```javascript
   // 良い例
   moduleName.methodName = jest.fn().mockResolvedValue({ key: 'value' });
   // または
   moduleName.methodName = jest.fn().mockImplementation(() => Promise.resolve({ key: 'value' }));
   ```

3. **非同期関数の適切なモック化**
   - Promise を返す関数には `mockResolvedValue` または `mockRejectedValue` を使用
   - 複雑なケースでは `mockImplementation` を使用

4. **外部依存モジュールを完全にモック化**
   ```javascript
   // モジュール全体をモック化
   jest.mock('module-name');
   
   // 特定のメソッドだけをモック化
   jest.mock('module-name', () => ({
     ...jest.requireActual('module-name'),
     specificMethod: jest.fn().mockResolvedValue('mocked value')
   }));
   ```

これらの方針に従って修正することで、テストの失敗を解決できる可能性が高まります。各ファイルの具体的な修正は、コード構造と依存関係を詳細に確認する必要があります。
