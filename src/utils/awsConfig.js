/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/utils/awsConfig.js
 * 
 * 説明: 
 * AWS SDKの初期化と各種クライアントの取得を一元管理するユーティリティモジュール。
 * 開発環境と本番環境での設定を統一的に処理します。
 *
 * @author Portfolio Manager Team
 * @created 2025-05-13
 */
'use strict';

const AWS = require('aws-sdk');

// 環境変数からリージョンを取得
const region = process.env.AWS_REGION || 'ap-northeast-1';

// 開発モードかどうかを判定
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

/**
 * AWS SDKの基本設定を行い、設定済みのAWSオブジェクトを返す
 * @returns {Object} 設定済みのAWSオブジェクト
 */
const configureAWS = () => {
  // リージョンを設定
  AWS.config.update({ region });
  
  // ローカル開発モードの場合の設定
  if (isDevelopment && process.env.AWS_ENDPOINT) {
    AWS.config.update({
      endpoint: process.env.AWS_ENDPOINT
    });
  }
  
  return AWS;
};

/**
 * DynamoDB DocumentClientインスタンスを取得
 * @returns {AWS.DynamoDB.DocumentClient} DynamoDBクライアント
 */
const getDynamoDb = () => {
  const AWS = configureAWS();
  
  // ローカル開発モードの場合の設定
  if (isDevelopment && process.env.DYNAMODB_ENDPOINT) {
    return new AWS.DynamoDB.DocumentClient({
      endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000'
    });
  }
  
  return new AWS.DynamoDB.DocumentClient();
};

/**
 * SNSクライアントインスタンスを取得
 * @returns {AWS.SNS} SNSクライアント
 */
const getSNS = () => {
  const AWS = configureAWS();
  
  // ローカル開発モードの場合の設定
  if (isDevelopment && process.env.SNS_ENDPOINT) {
    return new AWS.SNS({
      endpoint: process.env.SNS_ENDPOINT
    });
  }
  
  return new AWS.SNS();
};

/**
 * STS (Security Token Service) クライアントインスタンスを取得
 * @returns {AWS.STS} STSクライアント
 */
const getSTS = () => {
  const AWS = configureAWS();
  
  // ローカル開発モードの場合の設定
  if (isDevelopment && process.env.STS_ENDPOINT) {
    return new AWS.STS({
      endpoint: process.env.STS_ENDPOINT
    });
  }
  
  return new AWS.STS();
};

module.exports = {
  configureAWS,
  getDynamoDb,
  getSNS,
  getSTS
};
