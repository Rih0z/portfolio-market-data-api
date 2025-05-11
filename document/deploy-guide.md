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

### 1.3 Google Cloud Platform
- Googleアカウント
- Google Cloud Platformプロジェクト
- OAuth 2.0クライアントID（Google認証に必要）

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
mkdir -p src/{function/{admin,auth,drive},services,utils,config} resources scripts
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

# Google OAuth設定
GOOGLE_CLIENT_ID=<Google Cloud Consoleから取得したクライアントID>
GOOGLE_CLIENT_SECRET=<Google Cloud Consoleから取得したシークレット>
SESSION_TABLE=pfwise-api-${stage}-sessions
SESSION_EXPIRES_DAYS=7
DRIVE_FOLDER_NAME=PortfolioManagerData

# CORS設定
CORS_ALLOW_ORIGIN=http://localhost:3000,https://portfolio.example.com

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

### 6.2 基本的なserverless.yml設定（Google認証追加）
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
    GOOGLE_CLIENT_ID: ${env:GOOGLE_CLIENT_ID, ''}
    GOOGLE_CLIENT_SECRET: ${env:GOOGLE_CLIENT_SECRET, ''}
    SESSION_TABLE: ${env:SESSION_TABLE, '${self:service}-${self:provider.stage}-sessions'}
    CORS_ALLOW_ORIGIN: ${env:CORS_ALLOW_ORIGIN, '*'}
    DRIVE_FOLDER_NAME: ${env:DRIVE_FOLDER_NAME, 'PortfolioManagerData'}
  
  iamRoleStatements:
    - Effect: Allow
      Action:
        - dynamodb:*
      Resource: 
        - !GetAtt MarketDataCacheTable.Arn
        - !GetAtt SessionsTable.Arn
    - Effect: Allow
      Action:
        - sns:Publish
      Resource: !Ref AlertTopic

functions:
  # 既存のマーケットデータ関連機能
  marketData:
    handler: src/function/marketData.handler
    events:
      - http:
          path: api/market-data
          method: get
          cors: true
  
  preWarmCache:
    handler: src/function/preWarmCache.handler
    events:
      - schedule: rate(1 hour)
  
  getStatus:
    handler: src/function/admin/getStatus.handler
    events:
      - http:
          path: admin/status
          method: get
          cors: true
          private: true
  
  resetUsage:
    handler: src/function/admin/resetUsage.handler
    events:
      - http:
          path: admin/reset
          method: post
          cors: true
          private: true
  
  # 新規追加: Google認証関連
  googleLogin:
    handler: src/function/auth/googleLogin.handler
    events:
      - http:
          path: auth/google/login
          method: post
          cors: true
  
  getSession:
    handler: src/function/auth/getSession.handler
    events:
      - http:
          path: auth/session
          method: get
          cors: true
  
  logout:
    handler: src/function/auth/logout.handler
    events:
      - http:
          path: auth/logout
          method: post
          cors: true
  
  # Google Drive連携
  saveFile:
    handler: src/function/drive/saveFile.handler
    events:
      - http:
          path: drive/save
          method: post
          cors: true
  
  loadFile:
    handler: src/function/drive/loadFile.handler
    events:
      - http:
          path: drive/load
          method: get
          cors: true
  
  listFiles:
    handler: src/function/drive/listFiles.handler
    events:
      - http:
          path: drive/files
          method: get
          cors: true

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
    
    # 新規追加: セッション管理用DynamoDBテーブル
    SessionsTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: ${env:SESSION_TABLE, '${self:service}-${self:provider.stage}-sessions'}
        BillingMode: PAY_PER_REQUEST
        AttributeDefinitions:
          - AttributeName: sessionId
            AttributeType: S
        KeySchema:
          - AttributeName: sessionId
            KeyType: HASH
        TimeToLiveSpecification:
          AttributeName: ttl
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

# セッション情報の取得テスト
curl -H "Cookie: session=test-session-id" "http://localhost:3000/dev/auth/session" | jq

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

### 8.3 Google認証関連の問題

#### 8.3.1 リダイレクトURI不一致エラー
```
error=redirect_uri_mismatch&error_description=The+redirect+URI+in+the+request
```

**解決策**:
Google Cloud Consoleで認証済みリダイレクトURIを正しく設定します：
1. Google Cloud Consoleにアクセス
2. 「認証情報」→「OAuth 2.0 クライアントID」
3. 使用しているクライアントIDを選択
4. 「承認済みのリダイレクトURI」に以下を追加：
   - 開発環境: `http://localhost:3000/auth/callback`
   - 本番環境: `https://portfolio.example.com/auth/callback`

#### 8.3.2 セッション関連のエラー
**解決策**:
セッションテーブルが正しく作成されていることを確認：
```bash
# セッションテーブルの確認
aws dynamodb describe-table --table-name pfwise-api-dev-sessions
```

Cookie設定が正しいことを確認：
- HttpOnly
- Secure（本番環境では必須）
- SameSite=Strict

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

## 10. Google Cloud設定

### 10.1 Google Cloud Projectの設定
1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成または既存のプロジェクトを選択
3. 左メニューから「APIとサービス」→「ダッシュボード」を選択
4. 「APIとサービスの有効化」をクリック
5. 以下のAPIを有効化：
   - Google OAuth2 API
   - Google Drive API

### 10.2 OAuth同意画面の設定
1. 左メニューから「APIとサービス」→「OAuth同意画面」を選択
2. ユーザータイプ（外部または内部）を選択
3. アプリ情報を入力：
   - アプリ名: ポートフォリオマネージャー
   - ユーザーサポートメール: your-email@example.com
   - デベロッパーの連絡先情報: your-email@example.com
4. スコープの追加：
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `.../auth/drive.file`
5. テストユーザーの追加（外部タイプの場合）

### 10.3 OAuth認証情報の作成
1. 左メニューから「APIとサービス」→「認証情報」を選択
2. 「認証情報を作成」→「OAuth 2.0 クライアントID」をクリック
3. アプリケーションタイプ: Webアプリケーション
4. 名前: ポートフォリオマネージャーWeb
5. 承認済みのリダイレクトURI:
   - 開発環境: `http://localhost:3000/auth/callback`
   - 本番環境: `https://portfolio.example.com/auth/callback`
6. 「作成」をクリック
7. 表示されたクライアントIDとクライアントシークレットを保存

### 10.4 認証情報の環境変数への設定
```bash
# .envファイルに追加
GOOGLE_CLIENT_ID=<作成したクライアントID>
GOOGLE_CLIENT_SECRET=<作成したクライアントシークレット>
```

## 11. ロギングとモニタリング

### 11.1 ログの確認
```bash
# 特定の関数のログを確認
serverless logs -f googleLogin -t --stage dev

# または複数の関数を同時に確認
serverless logs -f googleLogin -f getSession -t --stage dev
```

### 11.2 CloudWatch Logsの確認
```bash
# AWS CLIでの最新ログの表示
aws logs filter-log-events --log-group-name "/aws/lambda/pfwise-api-dev-googleLogin" --limit 20

# エラーログのみ表示
aws logs filter-log-events --log-group-name "/aws/lambda/pfwise-api-dev-googleLogin" --filter-pattern "ERROR"
```

## 12. 効率的な開発のためのTips

### 12.1 ターミナルエイリアスの設定
~/.zshrcに以下を追加:
```bash
# AWS/Serverlessのエイリアス
alias aws-prod="export AWS_PROFILE=portfolio-prod"
alias aws-dev="export AWS_PROFILE=portfolio-dev"
alias sls-deploy-dev="serverless deploy --stage dev"
alias sls-deploy-prod="serverless deploy --stage prod"
alias sls-logs="serverless logs -f marketData -t"
```

### 12.2 MacBook省エネ対策
長時間のデプロイ中にスリープを防止:
```bash
# デプロイ中にディスプレイをオンに維持
caffeinate -d npm run deploy:prod
```

### 12.3 デプロイ進行状況の視覚化
```bash
# カラー表示有効化
export FORCE_COLOR=1
FORCE_COLOR=1 npm run deploy
```

## 13. セキュリティのベストプラクティス

- `.env`ファイル内のキーは定期的に更新する
- 本番環境ではAWS Secret ManagerやParameter Storeを使用する
- IAMロールは最小権限の原則に従って設定する
- API Gatewayでのレート制限を設定する
- CloudWatch Alarmsを設定して異常な使用パターンを検出する
- セッションCookieは必ずHTTP Only, Secure, SameSiteの設定を行う
- Google OAuth認証情報は安全に管理し、公開リポジトリにコミットしない

## 14. フロントエンド側の更新

### 14.1 Google認証のフロントエンド実装
フロントエンドアプリケーションでのGoogle認証の実装例:

```javascript
// 必要なパッケージ
// npm install @react-oauth/google axios
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';

const handleGoogleLogin = async (credentialResponse) => {
  try {
    // バックエンドに認証コードを送信
    const response = await axios.post(
      'https://xxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod/auth/google/login',
      {
        code: credentialResponse.code,
        redirectUri: window.location.origin + '/auth/callback'
      },
      {
        withCredentials: true // Cookieを送受信するために必要
      }
    );
    
    if (response.data.success) {
      // ログイン成功処理
      setUser(response.data.user);
      setIsAuthenticated(true);
    }
  } catch (error) {
    console.error('Google認証エラー:', error);
  }
};

// Googleログインボタンの表示
<GoogleOAuthProvider clientId="YOUR_GOOGLE_CLIENT_ID">
  <GoogleLogin
    flow="auth-code"
    onSuccess={handleGoogleLogin}
    onError={() => {
      console.log('ログインに失敗しました');
    }}
    useOneTap
  />
</GoogleOAuthProvider>
```

### 14.2 セッション管理
```javascript
// セッション情報の取得
const checkSession = async () => {
  try {
    const response = await axios.get(
      'https://xxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod/auth/session',
      { withCredentials: true }
    );
    
    if (response.data.success && response.data.isAuthenticated) {
      setUser(response.data.user);
      setIsAuthenticated(true);
    }
  } catch (error) {
    console.error('セッション確認エラー:', error);
    setUser(null);
    setIsAuthenticated(false);
  }
};

// ページロード時にセッション確認
useEffect(() => {
  checkSession();
}, []);
```

### 14.3 ログアウト処理
```javascript
const handleLogout = async () => {
  try {
    await axios.post(
      'https://xxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod/auth/logout',
      {},
      { withCredentials: true }
    );
    
    setUser(null);
    setIsAuthenticated(false);
  } catch (error) {
    console.error('ログアウトエラー:', error);
  }
};
```

---

このガイドは、特にMacBookでの開発に最適化されています。実際のプロジェクト要件に応じて適宜調整してください。
