# テスト結果ログ

以下は `npm run test:full:mock` と `npm test` を実行した際の出力例です。

## `npm run test:full:mock`

```
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> pfwise-api@1.0.0 test:full:mock
> npm run test:reset && npm run test:setup && cross-env USE_API_MOCKS=true npm run test

npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> pfwise-api@1.0.0 test:reset
> rm -rf ./test-results && mkdir -p ./test-results

npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> pfwise-api@1.0.0 test:setup
> node scripts/setup-test-env.js

[WARNING] @aws-sdk/client-dynamodb が見つかりません。DynamoDB 関連の処理をスキップします
[INFO] テスト環境のセットアップを開始します...
=====================================
[STEP] テストディレクトリを作成しています...
[INFO] ディレクトリは既に存在します: ./test-results
[SUCCESS] ディレクトリを作成しました: ./test-results/junit
[INFO] ディレクトリは既に存在します: ./coverage
[INFO] ディレクトリは既に存在します: ./.jest-cache
[STEP] モックセットアップファイルを確認しています...
[SUCCESS] モックファイルの確認が完了しました
[STEP] テスト環境変数を設定しています...
[INFO] .env.test ファイルが見つかりました
[SUCCESS] 環境変数の設定が完了しました
[STEP] DynamoDB Local の確認・起動...
[WARNING] SKIP_DYNAMODB_CHECKS=true のため DynamoDB Local の起動をスキップします
[STEP] テスト実行前の準備...
[SUCCESS] テスト実行前の準備が完了しました
=====================================
[WARNING] DynamoDBの起動に問題があります。モックモードでテストを実行してください:
[INFO]   USE_API_MOCKS=true npm test
sh: 1: cross-env: not found
```

## `npm test`

```
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> pfwise-api@1.0.0 test
> jest --forceExit

sh: 1: jest: not found
```
