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

## アーキテクチャ

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
│   │   ├── admin/          # 管理者関数
│   │       ├── getStatus.js   # ステータス取得
│   │       └── resetUsage.js  # 使用量リセット
│   │
│   ├── services/           # サービス層
│   │   ├── cache.js        # キャッシュサービス
│   │   ├── usage.js        # 使用量追跡サービス
│   │   ├── alerts.js       # アラート通知サービス
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

## トラブルシューティング

### よくある問題と解決策

| 問題 | 原因 | 解決策 |
|-----|------|--------|
| 429エラー | 使用量制限に達した | 管理者APIでリセットするか、翌日まで待つ |
| データ取得エラー | スクレイピング元サイトの構造変更 | サービスコードの更新が必要 |
| 高いレイテンシ | キャッシュミス率の上昇 | 予熱対象の銘柄を増やす |
| 予算超過アラート | 予想以上の使用量 | 使用量分析と制限値の見直し |

### 緊急対応手順

```bash
# 使用量リセットAPI呼び出し
curl -X POST https://your-api-url.execute-api.ap-northeast-1.amazonaws.com/prod/admin/reset \
  -H "x-api-key: YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"resetType":"all"}'
```

## ライセンス

&copy; 2025 Your Company. All Rights Reserved.
