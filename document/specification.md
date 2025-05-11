# ポートフォリオマーケットデータAPI 仕様書

## 1. システム概要

### 1.1 プロジェクト名
portfolio-market-data-api

### 1.2 概要
このAPIは株式や投資信託などの金融市場データをリアルタイムで取得し、フロントエンドアプリケーション向けに提供するサーバーレスバックエンドシステムです。AWS Lambdaを活用した効率的なアーキテクチャにより、スケーラブルかつコスト効率の良いサービスを実現しています。

### 1.3 主な機能
- 米国株式データの取得
- 日本株式データの取得
- 投資信託データの取得
- 為替レートデータの取得
- データキャッシング
- API使用量の監視と制限
- 管理者機能（ステータス確認、使用量リセット）

### 1.4 技術スタック
- **バックエンド**: Node.js
- **デプロイメント**: AWS Lambda + API Gateway
- **データベース**: DynamoDB
- **キャッシュ**: DynamoDB/Redis
- **フレームワーク**: Serverless Framework
- **データソース**: 
  - Yahoo Finance API
  - 為替レートサービス
  - Webスクレイピング

## 2. システムアーキテクチャ

### 2.1 全体アーキテクチャ
```
User Request → API Gateway → Lambda Functions → Data Sources
                                  ↓      ↑
                              DynamoDB Cache
```

### 2.2 主要コンポーネント
1. **API Gateway**: リクエストのルーティングとAPI認証を担当
2. **Lambda Functions**: ビジネスロジックを実行
3. **DynamoDB**: データキャッシュと使用量統計の保存
4. **外部データソース**: 株価・投資信託・為替データの取得

### 2.3 データフロー
1. クライアントからのリクエスト受信
2. キャッシュチェック（該当データが存在する場合はキャッシュから返却）
3. 外部データソースからデータ取得
4. 取得データのキャッシング
5. レスポンス整形・返却
6. 使用量カウンターの更新

## 3. ファイル構造

```
portfolio-market-data-api/
├── serverless.yml                  # Serverless Framework設定ファイル
├── package.json                    # プロジェクト依存関係
├── src/
│   ├── functions/                  # Lambda関数
│   │   ├── index.js                # メイン API エントリポイント
│   │   ├── preWarmCache.js         # キャッシュ予熱関数
│   │   ├── admin/                  # 管理者機能
│   │   │   ├── getStatus.js        # ステータス取得
│   │   │   └── resetUsage.js       # 使用量リセット
│   ├── services/                   # ビジネスロジック
│   │   ├── cache.js                # キャッシュ管理
│   │   ├── usage.js                # 使用量管理
│   │   ├── alerts.js               # アラート通知
│   │   ├── sources/                # データソース
│   │   │   ├── yahooFinance.js     # Yahoo Finance API
│   │   │   ├── exchangeRate.js     # 為替レートサービス
│   │   │   └── scraping.js         # Webスクレイピング
│   ├── utils/                      # ユーティリティ
│   │   ├── response.js             # レスポンスフォーマッタ
│   │   └── logger.js               # ロギングユーティリティ
│   ├── config/                     # 設定情報
│   │   ├── constants.js            # 定数定義
│   │   └── env.js                  # 環境変数
│   └── models/                     # データモデル
│       ├── stockData.js            # 株式データモデル
│       └── usageStats.js           # 使用統計モデル
├── tests/                          # テストコード
│   ├── unit/                       # ユニットテスト
│   └── integration/                # 統合テスト
└── docs/                           # ドキュメント
    └── how-to-call-api.md          # API使用ガイド
```

## 4. API エンドポイント

### 4.1 メインエンドポイント

#### 4.1.1 マーケットデータ取得
- **URL**: `/api/market-data`
- **メソッド**: GET
- **パラメータ**:
  - `type`: データタイプ（必須）- 'us-stock', 'jp-stock', 'mutual-fund', 'exchange-rate'
  - `symbols`: 銘柄コード（必須）- カンマ区切りで複数指定可能
  - `base`: 為替レートのベース通貨（オプション、デフォルト: 'USD'）
  - `target`: 為替レートの対象通貨（オプション、デフォルト: 'JPY'）
  - `refresh`: キャッシュを無視して最新データを取得（オプション、デフォルト: false）
- **レスポンス例**:
```json
{
  "success": true,
  "data": {
    "AAPL": {
      "ticker": "AAPL",
      "price": 174.79,
      "name": "Apple Inc.",
      "currency": "USD",
      "lastUpdated": "2025-05-11T12:34:56.789Z",
      "source": "AlpacaAPI",
      "isStock": true,
      "isMutualFund": false
    }
  },
  "source": "AWS Lambda & DynamoDB",
  "lastUpdated": "2025-05-11T12:34:56.789Z",
  "processingTime": "210ms",
  "usage": {
    "daily": 31,
    "monthly": 512,
    "dailyLimit": 5000,
    "monthlyLimit": 100000
  }
}
```

### 4.2 管理者エンドポイント

#### 4.2.1 ステータス取得
- **URL**: `/admin/status`
- **メソッド**: GET
- **ヘッダー**: `x-api-key`: 管理者APIキー（必須）
- **レスポンス例**:
```json
{
  "success": true,
  "timestamp": "2025-05-11T12:34:56.789Z",
  "usage": {
    "daily": 31,
    "monthly": 512,
    "dailyLimit": 5000,
    "monthlyLimit": 100000
  },
  "history": [
    { "date": "2025-05-10", "count": 423 },
    { "date": "2025-05-09", "count": 385 }
  ],
  "cache": {
    "items": 243,
    "sizeInBytes": 1458745,
    "hitRate": 0.87
  },
  "config": {
    "disableOnLimit": true,
    "cacheTimes": {
      "US_STOCK": 3600,
      "JP_STOCK": 3600,
      "MUTUAL_FUND": 7200,
      "EXCHANGE_RATE": 900
    },
    "adminEmail": "adm...@example.com"
  }
}
```

#### 4.2.2 使用量リセット
- **URL**: `/admin/reset`
- **メソッド**: POST
- **ヘッダー**: `x-api-key`: 管理者APIキー（必須）
- **リクエストボディ**:
```json
{
  "resetType": "daily" // "daily", "monthly", "all"のいずれか
}
```
- **レスポンス例**:
```json
{
  "success": true,
  "resetType": "daily",
  "timestamp": "2025-05-11T12:34:56.789Z",
  "previousCount": 31,
  "currentCount": 0
}
```

### 4.3 内部エンドポイント

#### 4.3.1 キャッシュ予熱
- **URL**: `/internal/prewarm-cache`
- **メソッド**: GET
- **ヘッダー**: `x-cron-secret`: スケジューラシークレット（オプション）
- **レスポンス例**:
```json
{
  "success": true,
  "message": "Cache pre-warm completed successfully",
  "summary": {
    "usStock": {
      "success": 5,
      "fail": 0,
      "total": 5
    },
    "jpStock": {
      "success": 3,
      "fail": 1,
      "total": 4
    },
    "mutualFund": {
      "success": 2,
      "fail": 0,
      "total": 2
    },
    "exchangeRate": {
      "success": 1,
      "fail": 0,
      "total": 1
    },
    "cleanup": {
      "removed": 12
    },
    "processingTime": "4562ms",
    "timestamp": "2025-05-11T12:34:56.789Z"
  }
}
```

## 5. コアモジュール

### 5.1 Lambda関数

#### 5.1.1 メインハンドラー（index.js）
API Gatewayからのリクエストを受け取り、パラメータの検証、キャッシュチェック、データ取得、レスポンス生成を担当します。

#### 5.1.2 キャッシュ予熱（preWarmCache.js）
人気銘柄のデータを事前に取得してキャッシュに保存します。CloudWatch Eventsによって定期的に実行されます。

#### 5.1.3 ステータス取得（getStatus.js）
API使用状況とキャッシュ情報を取得します。管理者のみアクセス可能です。

#### 5.1.4 使用量リセット（resetUsage.js）
API使用量カウンターをリセットします。管理者のみアクセス可能です。

### 5.2 サービス層

#### 5.2.1 キャッシュサービス（cache.js）
DynamoDB/Redisを使用したデータキャッシュ機能を提供します。主な関数：
- `get(key)`: キャッシュからデータを取得
- `set(key, value, ttl)`: データをキャッシュに保存
- `getStats()`: キャッシュの統計情報を取得
- `cleanup()`: 期限切れのキャッシュを削除

#### 5.2.2 使用量サービス（usage.js）
APIの使用量を管理します。主な関数：
- `incrementUsage()`: 使用量カウンターをインクリメント
- `getUsageStats()`: 使用量統計を取得
- `resetUsage(type)`: 使用量カウンターをリセット
- `checkUsageLimits()`: 使用量が制限を超えていないか確認

#### 5.2.3 アラートサービス（alerts.js）
エラーや重要なイベントを通知します。主な関数：
- `sendAlert(options)`: アラートメッセージを送信

#### 5.2.4 データソースサービス
金融データを取得するための外部サービスとの連携を担当します。

- **Yahoo Finance（yahooFinance.js）**
  - `getStockData(symbol)`: 米国株式データを取得

- **為替レート（exchangeRate.js）**
  - `getExchangeRate(base, target)`: 為替レートを取得

- **スクレイピング（scraping.js）**
  - `scrapeJpStock(symbol)`: 日本株式データをスクレイプ
  - `scrapeMutualFund(code)`: 投資信託データをスクレイプ

### 5.3 ユーティリティ

#### 5.3.1 レスポンスフォーマッター（response.js）
APIレスポンスを標準形式に整形します。主な関数：
- `formatResponse(options)`: 成功レスポンスを整形
- `formatErrorResponse(options)`: エラーレスポンスを整形

#### 5.3.2 ロガー（logger.js）
システムログを管理します。

### 5.4 設定

#### 5.4.1 定数（constants.js）
システム全体で使用される定数を定義します：
```javascript
// データタイプ
const DATA_TYPES = {
  US_STOCK: 'us-stock',
  JP_STOCK: 'jp-stock',
  MUTUAL_FUND: 'mutual-fund',
  EXCHANGE_RATE: 'exchange-rate'
};

// キャッシュ時間（秒）
const CACHE_TIMES = {
  US_STOCK: 3600,        // 1時間
  JP_STOCK: 3600,        // 1時間
  MUTUAL_FUND: 7200,     // 2時間
  EXCHANGE_RATE: 900     // 15分
};

// 予熱対象シンボル
const PREWARM_SYMBOLS = {
  US_STOCK: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'],
  JP_STOCK: ['7203', '9984', '6758', '6861'],
  MUTUAL_FUND: ['2931113C', '0131103C']
};

// 管理者設定
const ADMIN = {
  API_KEY: process.env.ADMIN_API_KEY,
  EMAIL: process.env.ADMIN_EMAIL
};
```

## 6. データモデル

### 6.1 株式データモデル
```javascript
{
  ticker: String,         // 銘柄コード
  price: Number,          // 現在価格
  change: Number,         // 価格変動
  changePercent: Number,  // 変動率（%）
  name: String,           // 企業名/ファンド名
  currency: String,       // 通貨（USD/JPY）
  lastUpdated: String,    // 最終更新日時（ISO形式）
  source: String,         // データソース
  isStock: Boolean,       // 株式フラグ
  isMutualFund: Boolean,  // 投資信託フラグ
  
  // 追加情報（データタイプによって異なる）
  marketCap: Number,      // 時価総額（株式のみ）
  volume: Number,         // 出来高（株式のみ）
  assetSize: Number,      // 純資産（投資信託のみ）
  expenseRatio: Number    // 経費率（投資信託のみ）
}
```

### 6.2 為替レートモデル
```javascript
{
  pair: String,           // 通貨ペア（例: "USDJPY"）
  base: String,           // ベース通貨（例: "USD"）
  target: String,         // 対象通貨（例: "JPY"）
  rate: Number,           // 為替レート
  change: Number,         // 変動額
  changePercent: Number,  // 変動率
  lastUpdated: String,    // 最終更新日時
  source: String          // データソース
}
```

### 6.3 キャッシュエントリモデル（DynamoDB）
```javascript
{
  key: String,            // キャッシュキー（プライマリキー）
  data: Object,           // キャッシュデータ（JSON）
  ttl: Number,            // 有効期限（Unix timestamp）
  createdAt: String,      // 作成日時
  dataType: String,       // データタイプ
  size: Number            // データサイズ（バイト）
}
```

### 6.4 使用量統計モデル（DynamoDB）
```javascript
{
  id: String,             // 識別子（プライマリキー）
  date: String,           // 日付（YYYY-MM-DD形式）
  count: Number,          // API呼び出し回数
  uniqueUsers: Number,    // ユニークユーザー数
  dataTypes: {            // データタイプ別呼び出し回数
    usStock: Number,
    jpStock: Number,
    mutualFund: Number,
    exchangeRate: Number
  },
  timestamps: [Number]    // 呼び出しタイムスタンプリスト
}
```

## 7. エラーハンドリング

### 7.1 エラーコード
- `INVALID_PARAMS`: パラメータ不正
- `LIMIT_EXCEEDED`: 使用量制限超過
- `SOURCE_ERROR`: データソースからの取得エラー
- `NOT_FOUND`: 指定された銘柄が見つからない
- `SERVER_ERROR`: サーバー内部エラー
- `AUTH_ERROR`: 認証エラー

### 7.2 共通エラーレスポンス形式
```json
{
  "success": false,
  "error": {
    "message": "エラーメッセージ",
    "code": "エラーコード",
    "details": "エラー詳細（開発環境のみ）"
  }
}
```

## 8. パフォーマンス最適化

### 8.1 キャッシュ戦略
- 頻繁にアクセスされる銘柄のデータは自動的に予熱
- データタイプごとに適切なキャッシュ時間を設定
- キャッシュヒット率の監視と最適化

### 8.2 バッチ処理
- 複数銘柄のデータを1つのリクエストで取得可能
- データソースからのバッチ取得機能

### 8.3 使用量制限
- 日次・月次の使用量制限を設定
- 制限に達した場合は警告またはAPIを無効化
- 使用量をユーザーに通知

## 9. デプロイメント

### 9.1 環境
- 開発環境（dev）
- ステージング環境（staging）
- 本番環境（prod）

### 9.2 デプロイメントプロセス
1. Gitリポジトリへのプッシュ
2. CI/CDパイプラインによる自動テスト
3. Serverless Frameworkによるデプロイ
4. 動作確認
5. Slackへのデプロイメント通知

### 9.3 環境変数
```
# 共通
NODE_ENV=production
REGION=ap-northeast-1
DYNAMODB_TABLE_PREFIX=portfolio-market-data-

# キャッシュ設定
CACHE_ENABLED=true
REDIS_ENABLED=false

# API制限
DAILY_LIMIT=5000
MONTHLY_LIMIT=100000
DISABLE_ON_LIMIT=true

# 管理者設定
ADMIN_API_KEY=xxxxxxxxxxxxxxxxxxxxx
ADMIN_EMAIL=admin@example.com

# アラート設定
ALERT_SNS_TOPIC=arn:aws:sns:ap-northeast-1:123456789012:portfolio-market-data-alerts
ALERT_EMAIL=alert@example.com

# データソース
YAHOO_FINANCE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EXCHANGE_RATE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 10. モニタリング

### 10.1 メトリクス
- API呼び出し回数
- エラーレート
- レスポンス時間
- キャッシュヒット率
- Lambda実行回数と実行時間

### 10.2 ロギング
- CloudWatchにログを保存
- エラーとワーニングはSNSトピックへ通知
- 重大エラーはメール通知

### 10.3 ダッシュボード
- CloudWatch Dashboardで主要メトリクスを可視化
- 管理者パネルで使用量とキャッシュ統計を表示

## 11. セキュリティ

### 11.1 API認証
- プライベートAPIは管理者APIキーで保護
- パブリックAPIはAPIキーによるアクセス制限（オプション）

### 11.2 CORS設定
- 許可されたオリジンからのアクセスのみ許可
- プリフライトリクエストのサポート

### 11.3 入力バリデーション
- すべてのリクエストパラメータを検証
- SQLインジェクションなどの攻撃を防止

## 12. 拡張計画

### 12.1 短期的拡張（3ヶ月以内）
- ETFデータの追加
- 複数通貨ペアのサポート強化
- ヒストリカルデータAPIの追加

### 12.2 中期的拡張（6ヶ月以内）
- リアルタイムデータのWebSocketサポート
- より詳細な企業財務データの提供
- ポートフォリオ分析APIの追加

### 12.3 長期的拡張（12ヶ月以内）
- AIによる株価予測機能
- カスタムアラート通知システム
- マーケットニュースAPIの統合

## 13. 付録

### 13.1 用語集
- **銘柄コード**: 証券取引所で使用される銘柄識別子
- **TTL**: Time To Live（キャッシュの有効期限）
- **API制限**: サービスの過剰使用を防ぐための呼び出し回数制限
- **キャッシュ予熱**: 事前にデータをキャッシュに保存すること

### 13.2 リファレンス
- [Serverless Framework ドキュメント](https://www.serverless.com/framework/docs/)
- [AWS Lambda ドキュメント](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html)
- [DynamoDB ドキュメント](https://docs.aws.amazon.com/dynamodb/latest/developerguide/Introduction.html)

### 13.3 APIリファレンス
詳細なAPIリファレンスドキュメントは `docs/how-to-call-api.md` を参照してください。
