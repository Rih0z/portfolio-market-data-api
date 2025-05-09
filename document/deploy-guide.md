# MacBook向け マーケットデータAPI デプロイガイド

このガイドはMacBook環境でのポートフォリオマネージャーマーケットデータAPIの開発・デプロイ手順をまとめたものです。特に発生しやすい問題と解決方法に焦点を当てています。

## 1. 前提条件

### 1.1 必要なツール
- Node.js（**18.x系推奨**）
- npm または yarn
- AWS CLI（設定済み）
- Serverless Framework
- Git

### 1.2 AWSアカウント情報
- AWS IAMユーザー（プログラムによるアクセス）
- アクセスキーとシークレットアクセスキー
- AWSアカウントID（デプロイ時に必要）

## 2. 開発環境のセットアップ

### 2.1 Homebrewのインストール（未導入の場合）
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2.2 Node.jsのインストール

**重要**: Serverless Framework（特にserverless-offlineプラグイン）は最新の Node.js との互換性に問題があります。Node.js 18.x系を使用してください。

#### 推奨: nvmを使用したNode.jsバージョン管理
```bash
# nvmのインストール
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# ターミナルを再起動するか、以下を実行
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Node.js 18.xをインストール
nvm install 18

# Node.js 18.xを使用
nvm use 18

# バージョン確認
node -v  # -> v18.x.x
```

#### 代替: Homebrewでのインストール
```bash
brew install node@18
brew link node@18
```

### 2.3 AWSツールのインストール
```bash
# AWS CLIのインストール
brew install awscli

# Serverless Frameworkのグローバルインストール
npm install -g serverless
```

### 2.4 開発ツール（オプション）
```bash
brew install --cask visual-studio-code  # VSCode
brew install jq                        # JSONデータ処理ツール
```

## 3. プロジェクトのセットアップ

### 3.1 リポジトリのクローン（既存プロジェクトの場合）
```bash
git clone <リポジトリURL>
cd pfwise-api
```

### 3.2 新規プロジェクト作成（リポジトリがない場合）
```bash
# プロジェクトディレクトリの作成
mkdir pfwise-api
cd pfwise-api

# package.jsonの初期化
npm init -y

# 基本的な依存関係のインストール
npm install --save axios cheerio
npm install --save-dev serverless serverless-offline serverless-dotenv-plugin
```

#### package.jsonの編集
```json
{
  "name": "pfwise-api",
  "version": "1.0.0",
  "description": "ポートフォリオマネージャーWebアプリケーション用の市場データ取得APIサービス",
  "main": "index.js",
  "scripts": {
    "dev": "serverless offline start",
    "deploy": "serverless deploy --stage dev",
    "deploy:prod": "serverless deploy --stage prod",
    "logs": "serverless logs -f marketData -t"
  },
  "engines": {
    "node": ">=16.x <=18.x"
  }
}
```

### 3.3 プロジェクト構造の作成（新規プロジェクトの場合）
```bash
# ディレクトリ構造の作成
mkdir -p src/{functions,services/{sources},utils,config} resources scripts
```

### 3.4 Node.jsバージョンの固定
```bash
# .nvmrcファイルの作成
echo "18.20.8" > .nvmrc  # または使用している18.x系の特定バージョン
```

## 4. AWS認証情報の設定

### 4.1 AWS CLIの設定
```bash
aws configure
```

プロンプトに従って入力:
- AWS Access Key ID
- AWS Secret Access Key
- Default region name: `ap-northeast-1` (または必要なリージョン)
- Default output format: `json`

### 4.2 複数プロファイルの設定（オプション）
```bash
# 開発環境用
aws configure --profile portfolio-dev

# 本番環境用
aws configure --profile portfolio-prod
```

### 4.3 AWS Account IDの確認
```bash
# AWSアカウントIDの取得
aws sts get-caller-identity --query "Account" --output text
```

## 5. 環境変数の設定

### 5.1 環境変数ファイルの作成
```bash
touch .env .env.example
```

### 5.2 APIキーと秘密キーの生成
```bash
# ADMIN_API_KEYの生成
openssl rand -hex 16

# CRON_SECRETの生成
openssl rand -hex 16
```

### 5.3 .envファイルの設定
```
# 管理者設定
ADMIN_EMAIL=your-email@example.com
ADMIN_API_KEY=<生成したランダム値>
CRON_SECRET=<生成したランダム値>

# AWS設定
AWS_ACCOUNT_ID=123456789012
AWS_REGION=ap-northeast-1

# 外部APIキー（必要に応じて）
ALPACA_API_KEY=
ALPACA_API_SECRET=
ALPHA_VANTAGE_API_KEY=
OPEN_EXCHANGE_RATES_APP_ID=

# 使用量制限
DAILY_REQUEST_LIMIT=5000
MONTHLY_REQUEST_LIMIT=100000
DISABLE_ON_LIMIT=true

# キャッシュ設定
CACHE_TIME_US_STOCK=3600
CACHE_TIME_JP_STOCK=3600
CACHE_TIME_MUTUAL_FUND=10800
CACHE_TIME_EXCHANGE_RATE=21600

# スクレイピング設定
JP_STOCK_SCRAPING_TIMEOUT=30000
MUTUAL_FUND_SCRAPING_TIMEOUT=30000

# デフォルト値
DEFAULT_EXCHANGE_RATE=150.0
```

### 5.4 環境変数ファイルの保護
```bash
# .envファイルの権限を制限
chmod 600 .env

# .gitignoreに.envを追加
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

## 6. Serverless設定

### 6.1 serverless.ymlファイルの作成
```bash
touch serverless.yml
```

### 6.2 基本的なserverless.yml設定
```yaml
service: pfwise-api

frameworkVersion: '3'

provider:
  name: aws
  runtime: nodejs18.x
  region: ${opt:region, 'ap-northeast-1'}
  stage: ${opt:stage, 'dev'}
  profile: ${opt:profile, ''}
  memorySize: 256
  timeout: 30
  
  environment:
    NODE_ENV: ${self:provider.stage}
    ADMIN_EMAIL: ${env:ADMIN_EMAIL, ''}
    ADMIN_API_KEY: ${env:ADMIN_API_KEY, ''}
    CRON_SECRET: ${env:CRON_SECRET, ''}
    DAILY_REQUEST_LIMIT: ${env:DAILY_REQUEST_LIMIT, '5000'}
    MONTHLY_REQUEST_LIMIT: ${env:MONTHLY_REQUEST_LIMIT, '100000'}
    DISABLE_ON_LIMIT: ${env:DISABLE_ON_LIMIT, 'true'}
    CACHE_TIME_US_STOCK: ${env:CACHE_TIME_US_STOCK, '3600'}
    CACHE_TIME_JP_STOCK: ${env:CACHE_TIME_JP_STOCK, '3600'}
    CACHE_TIME_MUTUAL_FUND: ${env:CACHE_TIME_MUTUAL_FUND, '10800'}
    CACHE_TIME_EXCHANGE_RATE: ${env:CACHE_TIME_EXCHANGE_RATE, '21600'}
  
  iamRoleStatements:
    - Effect: Allow
      Action:
        - dynamodb:*
      Resource: !GetAtt MarketDataCacheTable.Arn
    - Effect: Allow
      Action:
        - sns:Publish
      Resource: !Ref AlertTopic

functions:
  marketData:
    handler: src/functions/marketData.handler
    events:
      - http:
          path: api/market-data
          method: get
          cors: true
  
  preWarmCache:
    handler: src/functions/preWarmCache.handler
    events:
      - schedule: rate(1 hour)
  
  getStatus:
    handler: src/functions/admin/getStatus.handler
    events:
      - http:
          path: admin/status
          method: get
          cors: true
          private: true
  
  resetUsage:
    handler: src/functions/admin/resetUsage.handler
    events:
      - http:
          path: admin/reset
          method: post
          cors: true
          private: true

resources:
  Resources:
    MarketDataCacheTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: ${self:service}-${self:provider.stage}-cache
        BillingMode: PAY_PER_REQUEST
        AttributeDefinitions:
          - AttributeName: key
            AttributeType: S
        KeySchema:
          - AttributeName: key
            KeyType: HASH
        TimeToLiveSpecification:
          AttributeName: expires
          Enabled: true
    
    AlertTopic:
      Type: AWS::SNS::Topic
      Properties:
        TopicName: ${self:service}-${self:provider.stage}-alerts
        Subscription:
          - Protocol: email
            Endpoint: ${env:ADMIN_EMAIL, ''}

plugins:
  - serverless-dotenv-plugin
  - serverless-offline
```

### 6.3 基本的な関数ファイルを作成

```bash
# marketData.js関数を作成
mkdir -p src/functions/admin
touch src/functions/marketData.js
touch src/functions/preWarmCache.js
touch src/functions/admin/getStatus.js
touch src/functions/admin/resetUsage.js
```

marketData.js の基本実装:

```javascript
'use strict';

// 市場データ取得API
module.exports.handler = async (event) => {
  try {
    const queryParams = event.queryStringParameters || {};
    const { type, symbols, base, target, refresh } = queryParams;
    
    // レスポンス作成（テスト用）
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          // サンプルデータ
          AAPL: {
            ticker: 'AAPL',
            price: 174.79,
            name: 'Apple Inc.',
            currency: 'USD',
            lastUpdated: new Date().toISOString(),
            source: 'Test Data',
            isStock: true,
            isMutualFund: false
          }
        },
        source: 'AWS Lambda & DynamoDB',
        lastUpdated: new Date().toISOString(),
        processingTime: '10ms',
        usage: {
          daily: 1,
          monthly: 1,
          dailyLimit: 5000,
          monthlyLimit: 100000
        }
      })
    };
  } catch (error) {
    console.error('Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'サーバーエラーが発生しました。'
      })
    };
  }
};
```

## 7. ローカル開発

### 7.1 ローカルサーバーの起動
```bash
# ローカル開発モードでサーバーを起動
npm run dev
```

正常に起動すると以下のようなメッセージが表示されます:
```
Starting Offline at stage dev (ap-northeast-1)
...
Server ready: http://localhost:3000 🚀
```

### 7.2 API動作確認
```bash
# 米国株データの取得テスト
curl "http://localhost:3000/dev/api/market-data?type=us-stock&symbols=AAPL,MSFT" | jq

# 管理者ステータス確認（APIキー認証が必要）
curl -H "x-api-key: [生成したADMIN_API_KEY]" "http://localhost:3000/dev/admin/status" | jq
```

## 8. トラブルシューティング

### 8.1 package.jsonが見つからないエラー
```
npm error code ENOENT
npm error syscall open
npm error path .../package.json
npm error errno -2
npm error enoent Could not read package.json
```

**解決策**: 
```bash
# プロジェクトディレクトリで
npm init -y

# 必要な依存関係のインストール
npm install --save axios cheerio
npm install --save-dev serverless serverless-offline serverless-dotenv-plugin
```

### 8.2 Node.jsバージョン互換性エラー
```
Error [ERR_REQUIRE_ASYNC_MODULE]: require() cannot be used on an ESM graph with top-level await
```

**解決策**:
```bash
# nvmをインストール（まだの場合）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Node.js 18.xをインストールして使用
nvm install 18
nvm use 18

# 依存関係を再インストール
rm -rf node_modules package-lock.json
npm install
```

### 8.3 AWS認証情報エラー
```
The specified profile [profile] could not be found
```

**解決策**:
```bash
# AWS認証情報を確認
cat ~/.aws/credentials

# 必要なプロファイルを設定
aws configure --profile [profile]
```

### 8.4 Serverless Frameworkエラー
```
Cannot find module 'serverless-offline'
```

**解決策**:
```bash
npm install --save-dev serverless-offline
```

### 8.5 MacBook固有の問題

#### ターミナルでのNode.jsバージョン切り替え
```bash
# 特定のバージョンに切り替え
nvm use 18

# .nvmrcファイルに基づいて自動切り替え
nvm use
```

#### 秘密キーの管理
MacBookのKeychain Accessを使用してAPIキーを安全に管理:
```bash
# キーチェーンにAPIキーを保存
security add-generic-password -a $USER -s "pfwise_admin_api_key" -w "生成したAPIキー"

# キーチェーンからAPIキーを取得
security find-generic-password -a $USER -s "pfwise_admin_api_key" -w
```

## 9. デプロイ手順

### 9.1 開発環境へのデプロイ
```bash
# デフォルトプロファイルでデプロイ
npm run deploy

# 特定のプロファイルを使用
serverless deploy --stage dev --aws-profile portfolio-dev
```

### 9.2 本番環境へのデプロイ
```bash
# デフォルトプロファイルでデプロイ
npm run deploy:prod

# 特定のプロファイルを使用
serverless deploy --stage prod --aws-profile portfolio-prod
```

### 9.3 デプロイ後の確認
```bash
# サービス情報を表示
serverless info --stage prod

# APIエンドポイントをクリップボードにコピー
serverless info --stage prod | grep -A 3 endpoints | pbcopy
```

## 10. ロギングとモニタリング

### 10.1 ログの確認
```bash
# 特定の関数のログを確認
npm run logs

# または特定の関数を指定
serverless logs -f marketData -t --stage prod
```

### 10.2 CloudWatch Logsの確認
```bash
# AWS CLIでの最新ログの表示
aws logs filter-log-events --log-group-name "/aws/lambda/pfwise-api-prod-marketData" --limit 20

# エラーログのみ表示
aws logs filter-log-events --log-group-name "/aws/lambda/pfwise-api-prod-marketData" --filter-pattern "ERROR"
```

## 11. 効率的な開発のためのTips

### 11.1 ターミナルエイリアスの設定
~/.zshrcに以下を追加:
```bash
# AWS/Serverlessのエイリアス
alias aws-prod="export AWS_PROFILE=portfolio-prod"
alias aws-dev="export AWS_PROFILE=portfolio-dev"
alias sls-deploy-dev="serverless deploy --stage dev"
alias sls-deploy-prod="serverless deploy --stage prod"
alias sls-logs="serverless logs -f marketData -t"
```

### 11.2 MacBook省エネ対策
長時間のデプロイ中にスリープを防止:
```bash
# デプロイ中にディスプレイをオンに維持
caffeinate -d npm run deploy:prod
```

### 11.3 デプロイ進行状況の視覚化
```bash
# カラー表示有効化
export FORCE_COLOR=1
FORCE_COLOR=1 npm run deploy
```

## 12. セキュリティのベストプラクティス

- `.env`ファイル内のキーは定期的に更新する
- 本番環境ではAWS Secret ManagerやParameter Storeを使用する
- IAMロールは最小権限の原則に従って設定する
- API Gatewayでのレート制限を設定する
- CloudWatch Alarmsを設定して異常な使用パターンを検出する

## 13. フロントエンド側の更新

フロントエンドアプリケーションでのAPIエンドポイント更新例:

```javascript
// 変更前: Netlify Functions呼び出し
const fetchStockData = async (ticker) => {
  const response = await axios.get(`/.netlify/functions/alpaca-api-proxy?symbol=${ticker}`);
  return response.data;
};

// 変更後: AWS Lambda API呼び出し
const fetchStockData = async (ticker) => {
  const isJapaneseStock = /^\d{4}(\.T)?$/.test(ticker);
  const isMutualFund = /^\d{7,8}C(\.T)?$/.test(ticker);
  
  const type = isJapaneseStock 
    ? 'jp-stock' 
    : isMutualFund 
      ? 'mutual-fund' 
      : 'us-stock';
  
  try {
    const response = await axios.get(`https://xxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod/api/market-data`, {
      params: { 
        type, 
        symbols: ticker 
      }
    });
    return response.data;
  } catch (error) {
    // エラー時のフォールバック処理
    if (error.response && error.response.status === 429) {
      // 使用量制限エラー
      console.warn('API使用量制限に達しました。ローカルデータを使用します。');
    }
    
    // クライアント側でフォールバックデータを提供
    return {
      success: true,
      data: {
        [ticker]: {
          ticker: ticker,
          price: isJapaneseStock ? 2500 : isMutualFund ? 10000 : 100,
          name: ticker,
          currency: isJapaneseStock || isMutualFund ? 'JPY' : 'USD',
          lastUpdated: new Date().toISOString(),
          source: 'Client Fallback',
          isStock: !isMutualFund,
          isMutualFund: isMutualFund
        }
      }
    };
  }
};
```

---

このガイドは、特にMacBookでの開発に最適化されています。実際のプロジェクト要件に応じて適宜調整してください。
