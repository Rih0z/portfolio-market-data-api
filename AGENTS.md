# Portfolio Market Data API - Codex エージェントガイド

> **注意**: このドキュメントはCodexエージェント向けのガイドラインです。詳細情報は各トピック専用ドキュメントを参照してください。

## プロジェクト概要

Portfolio Market Data APIは、投資ポートフォリオ管理のための金融データAPIサービスです。米国株、日本株、投資信託、為替レート情報を様々なデータソースから取得し、統一的なインターフェースで提供します。また、Google認証、Google Driveとの連携、キャッシュ機能、フォールバックデータ管理などの機能を備えています。

このAPIはAWS Lambda上で動作するように設計されており、DynamoDB、SNSなどのAWSサービスを活用しています。

## 主要な機能と特徴

1. **複数のデータソース対応**
   - Yahoo Finance API
   - スクレイピング（Yahoo Finance、Yahoo Finance Japan、Minkabu、Kabutan、MarketWatch）
   - モーニングスターCSVデータ
   - 為替レートAPI

2. **高い可用性**
   - キャッシュ機能
   - フォールバックデータ管理
   - 複数ソースからの段階的取得
   - スクレイピングブラックリスト

3. **認証とセキュリティ**
   - Google OAuth認証
   - セッション管理
   - API Keyベースの管理者認証

4. **Google Drive連携**
   - ポートフォリオデータの保存
   - ファイル一覧取得
   - データ読み込み

## コーディング規約

### 一般規則

1. **コードスタイル**
   - セミコロンを使用する
   - シングルクォート（'）を使用する
   - インデントはスペース2文字
   - 関数宣言は `const functionName = () => {}` 形式を優先

2. **エラーハンドリング**
   - すべての非同期関数呼び出しは try/catch でラップする
   - 詳細なエラーメッセージを提供する
   - エラーは常にログに記録する

3. **ログ出力**
   - `logger.js` を使用し、直接 `console.log` を使用しない
   - 適切なログレベル（debug、info、warn、error、critical）を使用する

### モジュール構造

1. **サービスモジュール設計**
   - 自己参照オブジェクトパターンを使用する
   ```javascript
   // 推奨パターン
   const serviceModule = {
     method1: function(param1) {
       // 実装...
     },
     
     method2: function(param1) {
       // 同じモジュール内の他のメソッドを呼び出す場合
       return serviceModule.method1(param1);
     }
   };
   
   module.exports = serviceModule;
   ```

2. **インポート/エクスポートの一貫性**
   ```javascript
   // 推奨パターン
   const service = {
     method1: () => { /* 実装 */ },
     method2: () => { /* 実装 */ }
   };
   module.exports = service;
   
   // 避けるべきパターン
   exports.method1 = () => { /* 実装 */ };
   module.exports.method2 = () => { /* 実装 */ };
   ```

3. **依存性の明示**
   - モジュールの先頭でインポートを宣言
   - 依存モジュールをモックしやすくするためにモジュール全体をインポート
   ```javascript
   // 推奨
   const dynamoDbService = require('../utils/dynamoDbService');
   
   // 避ける（テストでモック化が困難）
   const { addItem } = require('../utils/dynamoDbService');
   ```

## API規約

### エンドポイント構造

- **マーケットデータ**: `/api/market-data`
- **認証**: `/auth/*`
- **Google Drive連携**: `/drive/*`
- **管理者**: `/admin/*`

詳細なAPI仕様については、[API利用ガイド](document/how-to-call-api.md)を参照してください。

### レスポンス形式

すべてのAPIは統一されたレスポンス形式に従います：

```json
{
  "success": true,
  "data": { /* APIレスポンスデータ */ },
  "source": "API",
  "lastUpdated": "2025-05-11T15:35:22.123Z",
  "processingTime": "523ms",
  "usage": {
    "daily": {
      "count": 125,
      "limit": 5000,
      "percentage": 2.5
    },
    "monthly": {
      "count": 2450,
      "limit": 100000,
      "percentage": 2.45
    }
  }
}
```

### エラーレスポンス形式

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "details": "追加の詳細情報（オプション）"
  }
}
```

## テスト戦略

### テスト種類

1. **ユニットテスト**: 個々の関数やクラスの機能をテスト
2. **統合テスト**: 複数のコンポーネントの連携をテスト
3. **E2Eテスト**: エンドユーザーの視点からシステム全体の動作をテスト

詳細なテスト方法については以下のドキュメントを参照してください：
- [テスト作成ガイドライン](document/how-to-make-test.md)
- [テスト実行ガイド](document/how-to-test.md)
- [モックテスト戦略ガイド](document/how-to-make-test-mock.md)

### テストファイル命名規則

1. **ユニットテスト・統合テスト**
   - テストファイル名: `{ソースファイル名}.test.js`
   - 例: `src/services/cache.js` → `__tests__/unit/services/cache.test.js`

2. **E2Eテスト**
   - テストファイル名: `{機能名}_test.js` または `{機能名}.test.js`
   - 例: `__tests__/e2e/API_test.js`

### モックの設定パターン

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

// Promise戻り値を設定
asyncFunction.mockResolvedValue({ success: true });
asyncFunction.mockRejectedValue(new Error('エラー'));
```

## よくある問題と解決方法

### テスト環境の問題

1. **APIサーバーが起動しない**
   ```bash
   # APIサーバーの状態を確認
   lsof -i :3000

   # モックを使用してテストを実行
   ./scripts/run-tests.sh -m e2e
   ```

2. **DynamoDB Localの問題**
   ```bash
   # DynamoDB Localの状態を確認
   lsof -i :8000

   # 強制的に停止して再起動
   npm run dynamodb:stop
   npm run dynamodb:start
   ```

### テスト失敗の一般的な原因

1. **インポート方式の不一致**
   - テスト側: モジュール全体をモック化 (`jest.mock('../path/to/module')`)
   - 実装側: 分割代入でメソッドを直接インポート (`const { method1, method2 } = require('../path/to/module')`)

2. **呼び出し方式の不一致**
   - テスト側: `module.method()` の形式を期待
   - 実装側: 直接 `method()` を呼び出す

3. **循環参照の問題**
   - 自身のモジュールを参照すると（例: `module.exports.method()`）、循環参照エラーが発生する可能性がある
   - 特に相互に呼び出し合う関数で問題が起きやすい

### 解決策

1. **自己参照オブジェクトパターンの使用**
   ```javascript
   const serviceModule = {
     method1: function() { /* 実装 */ },
     method2: function() { return serviceModule.method1(); }
   };
   module.exports = serviceModule;
   ```

2. **テスト環境の独立性確保**
   ```javascript
   // 環境変数の保存と復元
   const originalEnv = { ...process.env };
   afterEach(() => {
     process.env = { ...originalEnv };
   });
   ```

## 主要ファイル構造

```
src/
├── config/            # 設定ファイル
│   ├── constants.js   # 定数定義
│   └── envConfig.js   # 環境変数設定
├── function/          # Lambda関数ハンドラー
│   ├── admin/         # 管理者向けAPI
│   ├── auth/          # 認証関連API
│   ├── drive/         # Google Drive連携API
│   ├── marketData.js  # 市場データAPI
│   └── preWarmCache.js # キャッシュ予熱
├── services/          # サービスモジュール
│   ├── alerts.js      # アラート通知
│   ├── cache.js       # キャッシュ
│   ├── googleAuthService.js # Google認証
│   └── sources/       # データソース別サービス
└── utils/             # ユーティリティ関数
    ├── awsConfig.js   # AWS設定
    ├── logger.js      # ロギング
    └── responseUtils.js # レスポンス処理
```

詳細なファイル構造とモジュール説明は[プロジェクト構造とモジュール説明ドキュメント](document/structure-and-modules.md)を参照してください。

## 推奨する開発フロー

1. **機能追加/変更プロセス**
   - 仕様理解と設計
   - ユニットテスト作成
   - 実装
   - ユニットテストの実行・修正
   - 統合テスト
   - E2Eテスト
   - デプロイ

2. **コードレビュープロセス**
   - コーディング規約準拠
   - 適切なエラーハンドリング
   - テストカバレッジ確認 (目標: 80%)
   - パフォーマンス考慮点

3. **テスト実行方法**
   ```bash
   # 開発中はリアルタイムテスト
   npm run test:dev
   
   # プルリクエスト前に全テスト
   npm run test:full:mock
   
   # デプロイ前に実環境テスト
   npm run test:full:auto
   ```

## 環境設定とデプロイメント

### 開発環境のセットアップ

```bash
# 依存関係のインストール
npm install

# DynamoDB Local のセットアップ
mkdir -p ./dynamodb-local
curl -L -o ./dynamodb-local/dynamodb-local-latest.tar.gz https://d1ni2b6xgvw0s0.cloudfront.net/dynamodb_local_latest.tar.gz
tar -xzf ./dynamodb-local/dynamodb-local-latest.tar.gz -C ./dynamodb-local
```

### ローカル開発の実行

```bash
# DynamoDB Local の起動
npm run dynamodb:start

# ローカルサーバーの起動
npm run dev
```

### デプロイメント

```bash
# 開発環境へのデプロイ
npm run deploy

# 本番環境へのデプロイ
npm run deploy:prod
```

### 環境変数設定

主要な環境変数：

```
# AWS設定
AWS_REGION=ap-northeast-1
DYNAMODB_TABLE_PREFIX=portfolio-market-data-

# APIキー
ADMIN_API_KEY=your-admin-api-key

# 使用量制限
DAILY_REQUEST_LIMIT=5000
MONTHLY_REQUEST_LIMIT=100000

# Google認証
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## プロジェクト固有の注意点

1. **データソースの優先順位**
   - 各データタイプに対して複数のデータソースが定義されている
   - 優先順位によって順番に試行される
   - システム運用中にデータソースの信頼性や応答速度に変化があった場合、この優先順位は動的に調整される

2. **キャッシュ管理**
   - システムは自動的にキャッシュのプリウォーミングを行う
   - 人気銘柄のデータをあらかじめキャッシュに保存
   - キャッシュの有効期間はデータタイプによって異なる

3. **AWS無料枠の制限対応**
   - AWS Free Tierの上限に近づくと、より保守的な動作モードに移行
   - Budget StatusがCRITICALになると、キャッシュの強制リフレッシュリクエスト（`refresh=true`）が拒否される

4. **エラー監視**
   - システムは自動的にデータ取得の失敗や異常値を検出
   - 特定の閾値を超えた場合にはアラートを送信
   - 重要なエラーが発生した場合は管理者に通知される

## コントリビューションガイドライン

### PR提出前のチェックリスト

1. **コード品質**
   - コーディング規約に準拠していることを確認
   - 不要なコンソールログを削除
   - コメントが適切に追加されている

2. **テスト**
   - 新機能・変更に対するテストが追加されている
   - すべてのテストが成功する
   - カバレッジレポートを確認（目標: ライン80%以上）

3. **ドキュメント**
   - 必要に応じてドキュメントを更新
   - 新しいAPI、関数、設定オプションが文書化されている
   - CHANGELOG.mdが更新されている

4. **セキュリティとパフォーマンス**
   - セキュリティ上の懸念がないことを確認
   - パフォーマンスへの影響を考慮している
   - エラーハンドリングが適切に実装されている

### 新機能実装のワークフロー

1. 機能仕様書の作成・レビュー
2. 実装計画とタスク分割
3. テストケースの作成
4. 機能実装
5. コードレビュー
6. テスト実行と修正
7. ドキュメント更新
8. PR提出と最終レビュー
