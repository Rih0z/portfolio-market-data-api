# ポートフォリオマーケットデータAPI 仕様書

## 1. システム概要

### 1.1 プロジェクト名
portfolio-market-data-api

### 1.2 概要
このAPIは株式や投資信託などの金融市場データをリアルタイムで取得し、フロントエンドアプリケーション向けに提供するサーバーレスバックエンドシステムです。AWS Lambdaを活用した効率的なアーキテクチャにより、スケーラブルかつコスト効率の良いサービスを実現しています。さらに、Google認証とGoogle Drive連携によるクロスデバイスのポートフォリオデータ管理機能も提供します。

### 1.3 主な機能
- 米国株式データの取得
- 日本株式データの取得
- 投資信託データの取得
- 為替レートデータの取得
- データキャッシング
- API使用量の監視と制限
- 管理者機能（ステータス確認、使用量リセット）
- Google認証とセッション管理（新機能）
- Google Driveデータ同期機能（新機能）

### 1.4 技術スタック
- **バックエンド**: Node.js
- **デプロイメント**: AWS Lambda + API Gateway
- **データベース**: DynamoDB
- **キャッシュ**: DynamoDB/Redis
- **フレームワーク**: Serverless Framework
- **認証サービス**: Google OAuth 2.0
- **ストレージサービス**: Google Drive API
- **データソース**: 
  - Yahoo Finance API
  - 為替レートサービス
  - Webスクレイピング

## 2. システムアーキテクチャ

### 2.1 全体アーキテクチャ
```
User Request → API Gateway → Lambda Functions → Data Sources/Google API
                                  ↓      ↑
                              DynamoDB (Cache & Sessions)
```

### 2.2 主要コンポーネント
1. **API Gateway**: リクエストのルーティングとAPI認証を担当
2. **Lambda Functions**: ビジネスロジックを実行
3. **DynamoDB**: データキャッシュ、セッション管理、使用量統計の保存
4. **外部データソース**: 株価・投資信託・為替データの取得
5. **Google API**: 認証とGoogle Driveデータ同期

### 2.3 データフロー
1. クライアントからのリクエスト受信
2. 認証確認（必要な場合）
3. キャッシュチェック（該当データが存在する場合はキャッシュから返却）
4. 外部データソースからデータ取得またはGoogle APIとの連携
5. 取得データのキャッシング
6. レスポンス整形・返却
7. 使用量カウンターの更新

## 3. ファイル構造

```
portfolio-market-data-api/
├── serverless.yml                  # Serverless Framework設定ファイル
├── package.json                    # プロジェクト依存関係
├── src/
│   ├── function/                   # Lambda関数
│   │   ├── marketData.js           # メイン API エントリポイント
│   │   ├── preWarmCache.js         # キャッシュ予熱関数
│   │   ├── admin/                  # 管理者機能
│   │   │   ├── getStatus.js        # ステータス取得
│   │   │   └── resetUsage.js       # 使用量リセット
│   │   ├── auth/                   # 認証機能（新規追加）
│   │   │   ├── googleLogin.js      # Google認証処理
│   │   │   ├── getSession.js       # セッション情報取得
│   │   │   └── logout.js           # ログアウト処理
│   │   ├── drive/                  # Google Drive連携（新規追加）
│   │   │   ├── saveFile.js         # ファイル保存
│   │   │   ├── loadFile.js         # ファイル読み込み
│   │   │   └── listFiles.js        # ファイル一覧取得
│   ├── services/                   # ビジネスロジック
│   │   ├── cache.js                # キャッシュ管理
│   │   ├── usage.js                # 使用量管理
│   │   ├── alerts.js               # アラート通知
│   │   ├── googleAuthService.js    # Google認証サービス（新規追加）
│   │   ├── sources/                # データソース
│   │   │   ├── yahooFinance.js     # Yahoo Finance API
│   │   │   ├── exchangeRate.js     # 為替レートサービス
│   │   │   └── scraping.js         # Webスクレイピング
│   ├── utils/                      # ユーティリティ
│   │   ├── responseFormatter.js    # レスポンスフォーマッタ
│   │   ├── cookieParser.js         # Cookie操作ユーティリティ（新規追加）
│   │   ├── dynamoDbService.js      # DynamoDB操作ユーティリティ（新規追加）
│   │   └── logger.js               # ロギングユーティリティ
│   ├── config/                     # 設定情報
│   │   ├── constants.js            # 定数定義
│   │   └── env.js                  # 環境変数
│   └── models/                     # データモデル
│       ├── stockData.js            # 株式データモデル
│       ├── usageStats.js           # 使用統計モデル
│       └── sessionData.js          # セッションデータモデル（新規追加）
├── tests/                          # テストコード
│   ├── unit/                       # ユニットテスト
│   └── integration/                # 統合テスト
└── docs/                           # ドキュメント
    ├── deploy-guide.md             # デプロイガイド
    ├── how-to-call-api.md          # API使用ガイド
    └── specification.md            # API仕様書
```

## 4. API エンドポイント

### 4.1 マーケットデータ取得

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

### 4.2 認証エンドポイント（新機能）

#### 4.2.1 Google認証ログイン
- **URL**: `/auth/google/login`
- **メソッド**: POST
- **リクエストボディ**:
```json
{
  "code": "4/P7q7W91a-oMsCeLvIaQm6bTrgtp7",
  "redirectUri": "https://portfolio.example.com/auth/callback"
}
```
- **レスポンス例**:
```json
{
  "success": true,
  "isAuthenticated": true,
  "user": {
    "id": "109476395873295845628",
    "email": "user@example.com",
    "name": "サンプルユーザー",
    "picture": "https://lh3.googleusercontent.com/a/..."
  },
  "session": {
    "expiresAt": "2025-05-18T12:34:56.789Z"
  }
}
```
- **レスポンスヘッダー**:
```
Set-Cookie: session=f8e7d6c5b4a3; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/
```

#### 4.2.2 セッション情報取得
- **URL**: `/auth/session`
- **メソッド**: GET
- **リクエストヘッダー**:
```
Cookie: session=f8e7d6c5b4a3
```
- **レスポンス例**:
```json
{
  "success": true,
  "isAuthenticated": true,
  "user": {
    "id": "109476395873295845628",
    "email": "user@example.com",
    "name": "サンプルユーザー",
    "picture": "https://lh3.googleusercontent.com/a/..."
  },
  "session": {
    "expiresAt": "2025-05-18T12:34:56.789Z"
  }
}
```

#### 4.2.3 ログアウト処理
- **URL**: `/auth/logout`
- **メソッド**: POST
- **リクエストヘッダー**:
```
Cookie: session=f8e7d6c5b4a3
```
- **レスポンス例**:
```json
{
  "success": true,
  "message": "ログアウトしました"
}
```
- **レスポンスヘッダー**:
```
Set-Cookie: session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
```

### 4.3 Google Drive連携エンドポイント（新機能）

#### 4.3.1 ファイル保存
- **URL**: `/drive/save`
- **メソッド**: POST
- **リクエストヘッダー**:
```
Cookie: session=f8e7d6c5b4a3
```
- **リクエストボディ**:
```json
{
  "portfolioData": {
    "name": "マイポートフォリオ",
    "holdings": [
      {
        "ticker": "AAPL",
        "shares": 10,
        "costBasis": 150.25
      },
      {
        "ticker": "7203.T",
        "shares": 100,
        "costBasis": 2100
      }
    ],
    "createdAt": "2025-05-11T12:34:56.789Z"
  }
}
```
- **レスポンス例**:
```json
{
  "success": true,
  "message": "ポートフォリオデータをGoogle Driveに保存しました",
  "file": {
    "id": "1Zt8jKX7H3gFzN9v2X5yM6fGhJkLpQr7s",
    "name": "portfolio-data-2025-05-11T12-34-56-789Z.json",
    "url": "https://drive.google.com/file/d/1Zt8jKX7H3gFzN9v2X5yM6fGhJkLpQr7s/view",
    "createdAt": "2025-05-11T12:34:56.789Z"
  }
}
```

#### 4.3.2 ファイル読み込み
- **URL**: `/drive/load`
- **メソッド**: GET
- **リクエストヘッダー**:
```
Cookie: session=f8e7d6c5b4a3
```
- **パラメータ**:
  - `fileId`: Google DriveファイルID（必須）
- **レスポンス例**:
```json
{
  "success": true,
  "message": "ポートフォリオデータをGoogle Driveから読み込みました",
  "file": {
    "name": "portfolio-data-2025-05-10T15-22-33-456Z.json",
    "createdAt": "2025-05-10T15:22:33.456Z",
    "modifiedAt": "2025-05-10T15:22:33.456Z"
  },
  "data": {
    "name": "マイポートフォリオ",
    "holdings": [
      {
        "ticker": "AAPL",
        "shares": 10,
        "costBasis": 150.25
      },
      {
        "ticker": "7203.T",
        "shares": 100,
        "costBasis": 2100
      }
    ],
    "createdAt": "2025-05-10T15:22:33.456Z"
  }
}
```

#### 4.3.3 ファイル一覧取得
- **URL**: `/drive/files`
- **メソッド**: GET
- **リクエストヘッダー**:
```
Cookie: session=f8e7d6c5b4a3
```
- **レスポンス例**:
```json
{
  "success": true,
  "files": [
    {
      "id": "1Zt8jKX7H3gFzN9v2X5yM6fGhJkLpQr7s",
      "name": "portfolio-data-2025-05-11T12-34-56-789Z.json",
      "size": 1024,
      "mimeType": "application/json",
      "createdAt": "2025-05-11T12:34:56.789Z",
      "modifiedAt": "2025-05-11T12:34:56.789Z",
      "webViewLink": "https://drive.google.com/file/d/1Zt8jKX7H3gFzN9v2X5yM6fGhJkLpQr7s/view"
    },
    {
      "id": "2Ab9cDe3F4gHi5J6kLmN7oP8qRsT9uVw",
      "name": "portfolio-data-2025-05-10T15-22-33-456Z.json",
      "size": 980,
      "mimeType": "application/json",
      "createdAt": "2025-05-10T15:22:33.456Z",
      "modifiedAt": "2025-05-10T15:22:33.456Z",
      "webViewLink": "https://drive.google.com/file/d/2Ab9cDe3F4gHi5J6kLmN7oP8qRsT9uVw/view"
    }
  ],
  "count": 2
}
```

### 4.4 管理者エンドポイント

#### 4.4.1 ステータス取得
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
  "sessions": {
    "active": 15,
    "total": 45
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

#### 4.4.2 使用量リセット
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

### 4.5 内部エンドポイント

#### 4.5.1 キャッシュ予熱
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

#### 5.1.1 メインハンドラー（marketData.js）
API Gatewayからのリクエストを受け取り、パラメータの検証、キャッシュチェック、データ取得、レスポンス生成を担当します。

#### 5.1.2 認証ハンドラー（新規追加）
- **googleLogin.js**: Google認証コードを受け取り、トークン交換、ユーザー情報取得、セッション作成を行います。
- **getSession.js**: 現在のセッション情報を取得します。
- **logout.js**: セッションを無効化し、クッキーをクリアします。

#### 5.1.3 Google Drive連携ハンドラー（新規追加）
- **saveFile.js**: ポートフォリオデータをGoogle Driveに保存します。
- **loadFile.js**: Google Driveからポートフォリオデータを読み込みます。
- **listFiles.js**: Google Drive内のポートフォリオデータファイル一覧を取得します。

#### 5.1.4 その他ハンドラー
- **preWarmCache.js**: 人気銘柄のデータを事前に取得してキャッシュに保存します。
- **getStatus.js**: API使用状況とキャッシュ情報を取得します。管理者のみアクセス可能です。
- **resetUsage.js**: API使用量カウンターをリセットします。管理者のみアクセス可能です。

### 5.2 サービス層

#### 5.2.1 Google認証サービス（新規追加、googleAuthService.js）
Google OAuth認証と連携機能を提供します。主な関数：
- `exchangeCodeForTokens(code, redirectUri)`: 認証コードをトークンと交換
- `verifyIdToken(idToken)`: IDトークンの検証とユーザー情報取得
- `createUserSession(userData)`: ユーザーセッションの作成
- `getSession(sessionId)`: セッション情報の取得
- `invalidateSession(sessionId)`: セッションの無効化
- `refreshAccessToken(refreshToken)`: アクセストークンの更新
- `savePortfolioToDrive(accessToken, portfolioData)`: データ保存
- `loadPortfolioFromDrive(accessToken, fileId)`: データ読み込み
- `listPortfolioFiles(accessToken)`: ファイル一覧取得

#### 5.2.2 キャッシュサービス（cache.js）
DynamoDB/Redisを使用したデータキャッシュ機能を提供します。主な関数：
- `get(key)`: キャッシュからデータを取得
- `set(key, value, ttl)`: データをキャッシュに保存
- `getStats()`: キャッシュの統計情報を取得
- `cleanup()`: 期限切れのキャッシュを削除

#### 5.2.3 使用量サービス（usage.js）
APIの使用量を管理します。主な関数：
- `incrementUsage()`: 使用量カウンターをインクリメント
- `getUsageStats()`: 使用量統計を取得
- `resetUsage(type)`: 使用量カウンターをリセット
- `checkUsageLimits()`: 使用量が制限を超えていないか確認

#### 5.2.4 アラートサービス（alerts.js）
エラーや重要なイベントを通知します。主な関数：
- `sendAlert(options)`: アラートメッセージを送信

#### 5.2.5 データソースサービス
金融データを取得するための外部サービスとの連携を担当します。

- **Yahoo Finance（yahooFinance.js）**
  - `getStockData(symbol)`: 米国株式データを取得

- **為替レート（exchangeRate.js）**
  - `getExchangeRate(base, target)`: 為替レートを取得

- **スクレイピング（scraping.js）**
  - `scrapeJpStock(symbol)`: 日本株式データをスクレイプ
  - `scrapeMutualFund(code)`: 投資信託データをスクレイプ

### 5.3 ユーティリティ

#### 5.3.1 レスポンスフォーマッター（responseFormatter.js）
APIレスポンスを標準形式に整形します。主な関数：
- `formatResponse(options)`: 成功レスポンスを整形
- `formatErrorResponse(options)`: エラーレスポンスを整形
- `formatRedirectResponse(location, statusCode)`: リダイレクトレスポンスを整形

#### 5.3.2 クッキーパーサー（cookieParser.js、新規追加）
HTTPクッキーの操作を担当します。主な関数：
- `parseCookies(cookieString)`: クッキー文字列をパース
- `createSessionCookie(sessionId, maxAge, secure, sameSite)`: セッションクッキーを生成
- `createClearSessionCookie(secure)`: セッションクッキーを削除するためのクッキーを生成

#### 5.3.3 DynamoDBサービス（dynamoDbService.js、新規追加）
DynamoDBとのデータやり取りを担当します。主な関数：
- `getItem(tableName, key)`: アイテムを取得
- `addItem(tableName, item)`: アイテムを追加
- `updateItem(tableName, key, updates)`: アイテムを更新
- `deleteItem(tableName, key)`: アイテムを削除
- `queryItems(tableName, keyCondition, options)`: アイテムをクエリ
- `scanItems(tableName, options)`: テーブルをスキャン

#### 5.3.4 ロガー（logger.js）
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

// Google認証設定（新規追加）
const GOOGLE_AUTH = {
  CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  SCOPES: [
    'email', 
    'profile', 
    'https://www.googleapis.com/auth/drive.file'
  ],
  SESSION_EXPIRES_DAYS: 7
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

### 6.3 セッションモデル（新規追加）
```javascript
{
  sessionId: String,      // セッションID（プライマリキー）
  googleId: String,       // GoogleユーザーID
  email: String,          // メールアドレス
  name: String,           // ユーザー名
  picture: String,        // プロフィール画像URL
  accessToken: String,    // Googleアクセストークン
  refreshToken: String,   // Googleリフレッシュトークン
  tokenExpiry: String,    // トークン有効期限
  createdAt: String,      // 作成日時
  updatedAt: String,      // 更新日時
  expiresAt: String,      // セッション有効期限
  ttl: Number             // TTL属性（DynamoDBの自動削除用）
}
```

### 6.4 キャッシュエントリモデル（DynamoDB）
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

### 6.5 使用量統計モデル（DynamoDB）
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
- `NO_SESSION`: セッションが存在しない
- `INVALID_SESSION`: セッションが無効
- `TOKEN_REFRESH_ERROR`: トークン更新エラー
- `DRIVE_SAVE_ERROR`: Google Driveへの保存エラー
- `DRIVE_LOAD_ERROR`: Google Driveからの読み込みエラー
- `DRIVE_LIST_ERROR`: Google Driveのファイル一覧取得エラー

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

## 8. 認証フロー（新機能）

### 8.1 Google OAuth認証フロー
1. フロントエンドでGoogle認証ボタンを表示（@react-oauth/googleライブラリなど）
2. ユーザーがGoogle認証ボタンをクリック
3. Googleの認証画面が表示され、ユーザーがアカウントでログイン
4. 認証コードをフロントエンドが受け取る
5. フロントエンドが認証コードをバックエンドに送信（`/auth/google/login`エンドポイント）
6. バックエンドでGoogle OAuth APIを呼び出し、認証コードをトークンと交換
7. IDトークンを検証してユーザー情報を取得
8. セッションを作成してCookieに保存（HttpOnly, Secure, SameSite設定付き）
9. フロントエンドにユーザー情報とセッション情報を返却
10. フロントエンドでユーザー状態を更新

### 8.2 セッション管理
- セッションIDはランダムUUIDで生成
- セッション情報はDynamoDBに保存（TTL機能で自動削除）
- セッションCookieはHttpOnly, Secure, SameSite=Strictで設定
- セッション有効期限はデフォルト7日間（環境変数で設定可能）
- アクセストークンの期限が切れた場合は自動的に更新

### 8.3 ログアウト処理
1. フロントエンドがログアウトリクエストを送信（`/auth/logout`エンドポイント）
2. バックエンドでセッションをDynamoDBから削除
3. セッションCookieを無効化（有効期限を過去に設定）
4. フロントエンドでユーザー状態をクリア

## 9. Google Drive連携（新機能）

### 9.1 データ保存フロー
1. フロントエンドからポートフォリオデータを送信（`/drive/save`エンドポイント）
2. バックエンドでセッション確認と権限チェック
3. アクセストークンが有効期限切れの場合は更新
4. Google Drive APIを使用してポートフォリオ用フォルダを検索または作成
5. JSONファイルを作成してアップロード
6. ファイル情報をフロントエンドに返却

### 9.2 データ読み込みフロー
1. フロントエンドからファイルIDを送信（`/drive/load`エンドポイント）
2. バックエンドでセッション確認と権限チェック
3. アクセストークンが有効期限切れの場合は更新
4. Google Drive APIを使用してファイル内容とメタデータを取得
5. ポートフォリオデータをフロントエンドに返却

### 9.3 ファイル一覧取得フロー
1. フロントエンドがファイル一覧リクエストを送信（`/drive/files`エンドポイント）
2. バックエンドでセッション確認と権限チェック
3. アクセストークンが有効期限切れの場合は更新
4. Google Drive APIを使用してポートフォリオフォルダ内のファイル一覧を取得
5. ファイル一覧情報をフロントエンドに返却

### 9.4 Google Driveフォルダ構造
- トップレベルフォルダ: `PortfolioManagerData`（環境変数で設定可能）
- ファイル命名規則: `portfolio-data-[timestamp].json`
- ファイルは作成日時の降順でソートされる

## 10. パフォーマンス最適化

### 10.1 キャッシュ戦略
- 頻繁にアクセスされる銘柄のデータは自動的に予熱
- データタイプごとに適切なキャッシュ時間を設定
- キャッシュヒット率の監視と最適化

### 10.2 バッチ処理
- 複数銘柄のデータを1つのリクエストで取得可能
- データソースからのバッチ取得機能

### 10.3 使用量制限
- 日次・月次の使用量制限を設定
- 制限に達した場合は警告またはAPIを無効化
- 使用量をユーザーに通知

### 10.4 セッション最適化（新規追加）
- DynamoDBのTTL機能によるセッション自動クリーンアップ
- アクセストークンの必要時のみ更新
- セッションデータの最小化（必要な情報のみ保存）

## 11. セキュリティ

### 11.1 API認証
- プライベートAPIは管理者APIキーで保護
- パブリックAPIはAPIキーによるアクセス制限（オプション）
- 認証が必要なAPIはセッションCookieで保護

### 11.2 セッションセキュリティ（新規追加）
- セッションIDは強力なランダムUUID（v4）
- セッションCookieはHTTP Only, Secure, SameSite=Strictで設定
- セッション有効期限の設定と自動削除
- セッションデータの暗号化（オプション）

### 11.3 CORS設定
- 許可されたオリジンからのアクセスのみ許可
- プリフライトリクエストのサポート
- Cookieを含むクロスオリジンリクエストの適切な設定

### 11.4 入力バリデーション
- すべてのリクエストパラメータを検証
- SQLインジェクションなどの攻撃を防止

### 11.5 トークンセキュリティ（新規追加）
- Google APIトークンはセッションに保存し、フロントエンドには返却しない
- リフレッシュトークンはバックエンドのみで使用
- トークンの自動更新メカニズム

## 12. デプロイメント

### 12.1 環境
- 開発環境（dev）
- ステージング環境（staging）
- 本番環境（prod）

### 12.2 デプロイメントプロセス
1. Gitリポジトリへのプッシュ
2. CI/CDパイプラインによる自動テスト
3. Serverless Frameworkによるデプロイ
4. 動作確認
5. Slackへのデプロイメント通知

### 12.3 環境変数
```
# 共通
NODE_ENV=production
REGION=ap-northeast-1
DYNAMODB_TABLE_PREFIX=portfolio-market-data-

# Google認証（新規追加）
GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
SESSION_TABLE=portfolio-market-data-prod-sessions
SESSION_EXPIRES_DAYS=7
DRIVE_FOLDER_NAME=PortfolioManagerData

# CORS設定
CORS_ALLOW_ORIGIN=https://portfolio.example.com

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

## 13. モニタリング

### 13.1 メトリクス
- API呼び出し回数
- エラーレート
- レスポンス時間
- キャッシュヒット率
- Lambda実行回数と実行時間
- アクティブセッション数（新規追加）
- 認証成功率（新規追加）
- Google Drive操作成功率（新規追加）

### 13.2 ロギング
- CloudWatchにログを保存
- エラーとワーニングはSNSトピックへ通知
- 重大エラーはメール通知
- 認証とセッション関連のエラーを分離（新規追加）

### 13.3 ダッシュボード
- CloudWatch Dashboardで主要メトリクスを可視化
- 管理者パネルで使用量とキャッシュ統計を表示
- セッション管理とユーザーアクティビティの可視化（新規追加）

## 14. 拡張計画

### 14.1 短期的拡張（3ヶ月以内）
- ETFデータの追加
- 複数通貨ペアのサポート強化
- ヒストリカルデータAPIの追加
- Google認証と連携のテスト強化（新規追加）
- サーバーサイドセッション管理の最適化（新規追加）

### 14.2 中期的拡張（6ヶ月以内）
- リアルタイムデータのWebSocketサポート
- より詳細な企業財務データの提供
- ポートフォリオ分析APIの追加
- 複数ユーザー間のポートフォリオ共有機能（新規追加）
- カスタムデータ同期スケジュール機能（新規追加）

### 14.3 長期的拡張（12ヶ月以内）
- AIによる株価予測機能
- カスタムアラート通知システム
- マーケットニュースAPIの統合
- ソーシャルフィーチャー統合（新規追加）
- 複数アカウント間のデータマージ（新規追加）

## 15. 付録

### 15.1 用語集
- **銘柄コード**: 証券取引所で使用される銘柄識別子
- **TTL**: Time To Live（キャッシュの有効期限）
- **API制限**: サービスの過剰使用を防ぐための呼び出し回数制限
- **キャッシュ予熱**: 事前にデータをキャッシュに保存すること
- **OAuth2.0**: 認可の標準プロトコル（新規追加）
- **IDトークン**: ユーザー情報を含む署名付きJWTトークン（新規追加）
- **リフレッシュトークン**: アクセストークンを更新するための長期トークン（新規追加）
- **セッションID**: ユーザーセッションを識別するための一意の識別子（新規追加）

### 15.2 リファレンス
- [Serverless Framework ドキュメント](https://www.serverless.com/framework/docs/)
- [AWS Lambda ドキュメント](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html)
- [DynamoDB ドキュメント](https://docs.aws.amazon.com/dynamodb/latest/developerguide/Introduction.html)
- [Google OAuth 2.0 ドキュメント](https://developers.google.com/identity/protocols/oauth2)（新規追加）
- [Google Drive API ドキュメント](https://developers.google.com/drive/api/v3/about-sdk)（新規追加）

### 15.3 APIリファレンス
詳細なAPIリファレンスドキュメントは `docs/how-to-call-api.md` を参照してください。
