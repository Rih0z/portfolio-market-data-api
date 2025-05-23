#!/bin/bash
# deploy.sh - デプロイ用最適化スクリプト

# クリーンアップ
rm -rf .serverless node_modules package-lock.json

# デプロイに必要な最小限の依存関係をインストール
npm install --production
npm install --no-save serverless serverless-dotenv-plugin serverless-offline

# デプロイ実行
npm run deploy

# 結果を表示
serverless info --stage dev
