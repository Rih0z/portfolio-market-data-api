# ポートフォリオマネージャー マーケットデータAPI

**ポートフォリオマネージャーWebアプリケーション用の市場データ取得APIサービス**

## 📑 目次

- [概要](#概要)
- [主要機能](#主要機能)
- [技術スタック](#技術スタック)
- [アーキテクチャ](#アーキテクチャ)
- [APIリファレンス](#apiリファレンス)
- [セットアップ手順](#セットアップ手順)
- [デプロイ手順](#デプロイ手順)
- [環境変数](#環境変数)
- [開発ガイド](#開発ガイド)
- [認証フロー](#認証フロー)
- [Google Drive連携](#google-drive連携)
- [テスト実行ガイド](#テスト実行ガイド)
- [トラブルシューティング](#トラブルシューティング)
- [ライセンス](#ライセンス)

## 概要

このプロジェクトは、ポートフォリオマネージャーWebアプリケーションで使用する市場データ取得APIサービスです。以前はNetlify Functionsで運用していましたが、月間使用制限(125,000回)を超過したため、より効率的で安全なAWS Lambdaへの移行を実施しました。

DynamoDBを使ったキャッシュシステムにより、同じデータに対するAPIリクエストを1時間に1回に制限し、コストと応答時間を最適化しています。

## 主要機能

- **市場データ取得**: 米国株、日本株、投資信託、ETFの価格データ取得
- **為替レート取得**: USD/JPYなどの為替レートデータ取得
- **キャッシュ機構**: DynamoDBを使用した効率的なキャッシュ管理
- **安全策**: 使用量制限と自動停止機能による予期せぬ課金の防止
- **自動予熱**: 人気銘柄の定期的なキャッシュ予熱
- **管理者API**: 使用状況監視とメンテナンス用の管理者機能
- **Google認証**: Google OAuthを使用したユーザー認証
- **Google Drive連携**: ポートフォリオデータのクラウド保存・読み込み

## 技術スタック

| カテゴリ | 技術 | バージョン | 用途 |
|---------|------|-----------|------|
| サーバーレス | AWS Lambda | - | APIバックエンド |
| フレームワーク | Serverless Framework | ^3.32.2 | インフラ構成・デプロイ |
| データベース | Amazon DynamoDB | - | キャッシュストレージ |
| 通知 | Amazon SNS | - | アラート通知 |
| 監視 | Amazon CloudWatch | - | ログ・メトリクス |
| 予算管理 | AWS Budgets | - | コスト制限 |
| 開発言語 | Node.js | >=16.x | サーバーサイドロジック |
| HTTPクライアント | axios | ^1.6.2 | API・スクレイピング |
| HTML解析 | cheerio | ^1.0.0-rc.12 | スクレイピング |
| 認証 | Google OAuth 2.0 | - | ユーザー認証 |
| クラウドストレージ | Google Drive API | - | データ同期 |

## アーキテクチャ

システムアーキテクチャの概要図：

```
+-------------------+       +-------------------+         +-------------------+
| API Gateway       | ----> | Lambda Functions  | ------> | DynamoDB          |
| (REST API)        |       | (市場データAPI)    |         | (キャッシュ)      |
+-------------------+       +-------------------+         +-------------------+
         ^                          |                              
         |                          v                              
+-------------------+       +-------------------+         +-------------------+
| CloudWatch        | <---- | CloudWatch Events | ------> | SNS Topics        |
| (ログ・メトリクス)  |       | (Cron予熱)        |         | (アラート通知)    |
+-------------------+       +-------------------+         +-------------------+
                                    ^                              |
                                    |                              v
                            +-------------------+         +-------------------+
                            | AWS Budgets       |         | Email Notification|
                            | (予算アラート)    |         | (管理者通知)      |
                            +-------------------+         +-------------------+
```

詳細なデータフロー図については [document/market-data-flow.mmd](document/market-data-flow.mmd) を参照してください。

## APIリファレンス

### 市場データAPI

**エンドポイント**: `/api/market-data`  
**メソッド**: GET  
**認証**: 不要

#### パラメータ

| パラメータ | 必須 | 説明 | 例 |
|-----------|------|------|-----|
| `type` | はい | データタイプ | `us-stock`, `jp-stock`, `mutual-fund`, `exchange-rate` |
| `symbols` | type≠exchange-rate | 取得する銘柄シンボル(カンマ区切り) | `AAPL,MSFT` または `7203,9984` |
| `base` | いいえ | 為替レートの基準通貨 | `USD` (デフォルト) |
| `target` | いいえ | 為替レートの対象通貨 | `JPY` (デフォルト) |
| `refresh` | いいえ | キャッシュ強制更新フラグ | `true` または `false` (デフォルト) |

#### リクエスト例

```
# 米国株データ取得
GET /api/market-data?type=us-stock&symbols=AAPL,MSFT

# 日本株データ取得
GET /api/market-data?type=jp-stock&symbols=7203,9984

# 投資信託データ取得
GET /api/market-data?type=mutual-fund&symbols=8630042,2931102

# 為替レート取得
GET /api/market-data?type=exchange-rate&base=USD&target=JPY

# キャッシュ強制更新
GET /api/market-data?type=us-stock&symbols=AAPL&refresh=true
```

#### レスポンス例

```json
{
  "success": true,
  "data": {
    "AAPL": {
      "ticker": "AAPL",
      "price": 174.79,
      "name": "Apple Inc.",
      "currency": "USD",
      "lastUpdated": "2025-05-09T14:25:36.789Z",
      "source": "Yahoo Finance",
      "isStock": true,
      "isMutualFund": false
    },
    "MSFT": {
      "ticker": "MSFT",
      "price": 287.23,
      "name": "Microsoft Corporation",
      "currency": "USD",
      "lastUpdated": "2025-05-09T14:25:36.789Z",
      "source": "Yahoo Finance",
      "isStock": true,
      "isMutualFund": false
    }
  },
  "source": "AWS Lambda & DynamoDB",
  "lastUpdated": "2025-05-09T14:25:37.123Z",
  "processingTime": "325ms",
  "usage": {
    "daily": 543,
    "monthly": 12876,
    "dailyLimit": 5000,
    "monthlyLimit": 100000
  }
}
```

### 管理者API（ステータス確認）

**エンドポイント**: `/admin/status`  
**メソッド**: GET  
**認証**: API Key (x-api-key ヘッダー)

### 管理者API（使用量リセット）

**エンドポイント**: `/admin/reset`  
**メソッド**: POST  
**認証**: API Key (x-api-key ヘッダー)

### 認証API

**エンドポイント**: `/auth/google/login`  
**メソッド**: POST  
**認証**: なし

### セッション確認API

**エンドポイント**: `/auth/session`  
**メソッド**: GET  
**認証**: HTTPクッキー

### ログアウトAPI

**エンドポイント**: `/auth/logout`  
**メソッド**: POST  
**認証**: HTTPクッキー

### Google Drive連携API

**エンドポイント**: `/drive/save`  
**メソッド**: POST  
**認証**: HTTPクッキー

**エンドポイント**: `/drive/load`  
**メソッド**: GET  
**認証**: HTTPクッキー

**エンドポイント**: `/drive/files`  
**メソッド**: GET  
**認証**: HTTPクッキー

## セットアップ手順

### 環境要件

- Node.js 16.x以上
- AWS CLIがインストール済み
- AWS IAMユーザー（適切な権限を持つ）
- Serverless Frameworkがインストール済み

### ローカル開発環境の構築

```bash
# 1. リポジトリのクローン
git clone https://github.com/your-organization/portfolio-market-data-api.git
cd portfolio-market-data-api

# 2. 依存関係のインストール
npm install

# 3. 環境変数の設定
cp .env.example .env
# .envファイルを編集

# 4. ローカルでのテスト起動
npm run dev
```

## デプロイ手順

```bash
# 開発環境へのデプロイ
npm run deploy

# 本番環境へのデプロイ
npm run deploy:prod
```

デプロイ後、以下のようなエンドポイント情報が表示されます：

```
endpoints:
  GET - https://xxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod/api/market-data
  GET - https://xxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod/admin/status
  POST - https://xxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod/admin/reset
```

詳細なデプロイガイドについては [document/deploy-guide.md](document/deploy-guide.md) を参照してください。

## 環境変数

`.env`ファイルには以下の変数を設定：

```
# 管理者設定
ADMIN_EMAIL=your-email@example.com     # 通知先メールアドレス
ADMIN_API_KEY=your-secure-api-key      # 管理者API用キー
CRON_SECRET=your-cron-secret-key       # Cronジョブ認証用

# 使用量制限
DAILY_REQUEST_LIMIT=5000               # 日次リクエスト上限
MONTHLY_REQUEST_LIMIT=100000           # 月次リクエスト上限
DISABLE_ON_LIMIT=true                  # 制限到達時に自動停止

# キャッシュ設定
CACHE_TIME_US_STOCK=3600               # 米国株キャッシュ時間(秒)
CACHE_TIME_JP_STOCK=3600               # 日本株キャッシュ時間(秒)
CACHE_TIME_MUTUAL_FUND=10800           # 投資信託キャッシュ時間(秒)
CACHE_TIME_EXCHANGE_RATE=21600         # 為替レートキャッシュ時間(秒)

# Google OAuth設定
GOOGLE_CLIENT_ID=your-client-id        # Google OAuth クライアントID
GOOGLE_CLIENT_SECRET=your-client-secret # Google OAuth クライアントシークレット
SESSION_TABLE=session-table-name       # セッション情報テーブル名
SESSION_EXPIRES_DAYS=7                 # セッション有効期間（日）
```

## 開発ガイド

### プロジェクト構造

```
portfolio-market-data-api/
├── serverless.yml          # メインのServerless設定ファイル
├── package.json            # 依存関係
├── .env                    # 環境変数（.gitignoreに追加）
├── .env.example            # 環境変数のサンプル
├── .gitignore              # Git除外設定
├── README.md               # プロジェクト説明
│
├── src/                    # ソースコード
│   ├── functions/          # Lambda関数
│   │   ├── marketData.js   # 市場データAPI関数
│   │   ├── preWarmCache.js # キャッシュ予熱関数
│   │   ├── auth/           # 認証関連関数
│   │   │   ├── googleLogin.js # Google認証ログイン
│   │   │   ├── getSession.js  # セッション確認
│   │   │   └── logout.js      # ログアウト
│   │   ├── drive/          # Google Drive関連関数
│   │   │   ├── saveFile.js    # ファイル保存
│   │   │   ├── loadFile.js    # ファイル読み込み
│   │   │   └── listFiles.js   # ファイル一覧取得
│   │   ├── admin/          # 管理者関数
│   │       ├── getStatus.js   # ステータス取得
│   │       └── resetUsage.js  # 使用量リセット
│   │
│   ├── services/           # サービス層
│   │   ├── cache.js        # キャッシュサービス
│   │   ├── usage.js        # 使用量追跡サービス
│   │   ├── alerts.js       # アラート通知サービス
│   │   ├── googleAuthService.js # Google認証サービス
│   │   └── sources/        # データソース
│   │       ├── yahooFinance.js  # Yahoo Finance API
│   │       ├── exchangeRate.js  # 為替レート取得 
│   │       └── scraping.js      # スクレイピング
│   │
│   ├── utils/              # ユーティリティ関数
│   │   ├── response.js     # レスポンス整形
│   │   └── logger.js       # ロギング
│   │
│   └── config/             # 設定ファイル
│       └── constants.js    # 定数設定
│
├── resources/              # CloudFormationリソース
│   ├── dynamodb.yml        # DynamoDB設定
│   └── alarms.yml          # CloudWatchアラーム設定
│
└── scripts/                # 運用スクリプト
    └── deploy.sh           # デプロイスクリプト
```

## 認証フロー

アプリケーションはGoogle OAuth 2.0を使用してユーザー認証を行います。認証フローの詳細は以下のシーケンス図を参照してください：

![Google認証フロー図](document/google-auth-flow.mmd)

詳細なフロー図については [document/google-auth-flow.mmd](document/google-auth-flow.mmd) を参照してください。

## Google Drive連携

認証されたユーザーはGoogle Driveを使用してポートフォリオデータの保存と読み込みが可能です：

![Google Drive連携図](document/google-drive.mmd)

詳細なフロー図については [document/google-drive.mmd](document/google-drive.mmd) を参照してください。

API利用方法の詳細については [document/how-to-call-api.md](document/how-to-call-api.md) を参照してください。

## テスト実行ガイド

プロジェクトには単体テスト、統合テスト、E2Eテストが含まれています。テストの実行方法は以下の通りです：

### テスト環境のセットアップ

```bash
# 依存関係のインストール
npm install

# DynamoDB Localのセットアップ
mkdir -p ./dynamodb-local
curl -L -o ./dynamodb-local/dynamodb-local-latest.tar.gz https://d1ni2b6xgvw0s0.cloudfront.net/dynamodb_local_latest.tar.gz
tar -xzf ./dynamodb-local/dynamodb-local-latest.tar.gz -C ./dynamodb-local

# テスト実行スクリプトに実行権限を付与
chmod +x scripts/run-tests.sh
```

### テスト実行

```bash
# すべてのテストを実行
npm test

# 単体テストのみ実行
npm run test:unit

# 統合テストのみ実行
npm run test:integration

# E2Eテストのみ実行
npm run test:e2e

# テストカバレッジを計測
npm run test:coverage
```

### 最新のテスト結果

**テスト実行日時**: 2025-05-13T09:43:50.382Z  
**所要時間**: 1174ms

#### テスト統計
- 合計テスト数: 27
- 成功: 27
- 失敗: 0
- 保留: 0

#### 動作確認済み機能

**1. 認証機能 (googleLogin.test.js)**
- ✅ 正常なGoogleログイン処理の実行
- ✅ 認証コードなしでの呼び出し（エラー処理）
- ✅ 認証コード交換エラー時の処理
- ✅ IDトークン検証エラー時の処理
- ✅ セッション作成エラー時の処理
- ✅ 完全な認証フロー（ログイン→セッション確認→ログアウト）

**2. API機能のE2Eテスト (API_test.js)**
- ✅ マーケットデータAPI: 米国株データ取得
- ✅ マーケットデータAPI: 日本株データ取得
- ✅ マーケットデータAPI: 投資信託データ取得
- ✅ マーケットデータAPI: 為替レートデータ取得
- ✅ マーケットデータAPI: 無効なパラメータでのエラーハンドリング
- ✅ 認証API: ログイン、セッション取得、ログアウトのフロー
- ✅ Google Drive API: ポートフォリオデータの保存と読み込み
- ✅ Google Drive API: 認証なしでのアクセス拒否
- ✅ API基本機能: ヘルスチェックエンドポイント

**3. ユーティリティ関数 (responseUtils.test.js)**
- ✅ formatResponse: 通常レスポンス、カスタムステータスコード、予算警告スキップ
- ✅ formatErrorResponse: 通常エラー、詳細エラー情報、使用量情報
- ✅ formatRedirectResponse: 一時的リダイレクト、恒久的リダイレクト
- ✅ formatOptionsResponse: デフォルト設定、カスタムヘッダー
- ✅ handleOptions: OPTIONSメソッド処理、その他メソッド処理

#### コードカバレッジ
- ステートメント: 5.73% (目標: 80%)
- ブランチ: 5.82% (目標: 70%)
- 関数: 4.08% (目標: 80%)
- 行: 5.89% (目標: 80%)

**課題**: 現在のコードカバレッジは目標を大幅に下回っています。主要機能の基本的な動作は確認できていますが、エッジケースや例外処理、内部モジュールのテストカバレッジを向上させる必要があります。特に以下の領域のテスト強化が必要です：

- キャッシュメカニズムのテスト
- 外部APIフォールバック機能のテスト
- 使用量制限機能のテスト
- データ検証ロジックのテスト
- 各種エラー状態のテスト

詳細なテスト実行ガイドについては [document/how-to-test.md](document/how-to-test.md) と [document/test-plan.md](document/test-plan.md) を参照してください。

## トラブルシューティング

### よくある問題と解決策

| 問題 | 原因 | 解決策 |
|-----|------|--------|
| 429エラー | 使用量制限に達した | 管理者APIでリセットするか、翌日まで待つ |
| データ取得エラー | スクレイピング元サイトの構造変更 | サービスコードの更新が必要 |
| 高いレイテンシ | キャッシュミス率の上昇 | 予熱対象の銘柄を増やす |
| 予算超過アラート | 予想以上の使用量 | 使用量分析と制限値の見直し |
| 認証エラー | Googleトークンの期限切れ | ユーザーに再ログインを促す |
| Google Drive APIエラー | スコープ不足 | 認証スコープの追加と再認証 |

### 緊急対応手順

```bash
# 使用量リセットAPI呼び出し
curl -X POST https://your-api-url.execute-api.ap-northeast-1.amazonaws.com/prod/admin/reset \
  -H "x-api-key: YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"resetType":"all"}'
```

詳細な技術仕様については [document/specification.md](document/specification.md) を参照してください。

## ライセンス

&copy; 2025 Koki Riho. All Rights Reserved.
