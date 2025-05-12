/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/utils/awsConfig.js
 * 
 * 説明: 
 * AWS SDKの初期化と各種クライアントの取得を一元管理するユーティリティモジュール。
 * 開発環境と本番環境での設定を統一的に処理します。
 * クライアント初期化の重複を防ぎ、エンドポイント設定を一元化します。
 *
 * @author Portfolio Manager Team
 * @updated 2025-05-17
 */
'use strict';

const AWS = require('aws-sdk');
const { ENV, isDevelopment } = require('../config/envConfig');
const logger = require('./logger');

// AWS SDKクライアントのキャッシュ
const clients = {
  dynamoDb: null,
  sns: null,
  sts: null
};

/**
 * AWS SDKの基本設定を行い、設定済みのAWSオブジェクトを返す
 * @returns {Object} 設定済みのAWSオブジェクト
 */
const configureAWS = () => {
  // リージョンを設定
  AWS.config.update({ region: ENV.REGION });
  
  // ローカル開発モードの場合の設定
  if (isDevelopment && ENV.AWS_ENDPOINT) {
    AWS.config.update({
      endpoint: ENV.AWS_ENDPOINT
    });
  }
  
  // エラー処理とロギングを強化
  AWS.config.logger = {
    log: (message) => {
      if (ENV.LOG_LEVEL === 'debug') {
        logger.debug(`AWS SDK: ${message}`);
      }
    }
  };
  
  return AWS;
};

/**
 * DynamoDB DocumentClientインスタンスを取得
 * @returns {AWS.DynamoDB.DocumentClient} DynamoDBクライアント
 */
const getDynamoDb = () => {
  if (clients.dynamoDb) {
    return clients.dynamoDb;
  }
  
  const AWS = configureAWS();
  
  // ローカル開発モードの場合の設定
  if (isDevelopment && ENV.DYNAMODB_ENDPOINT) {
    clients.dynamoDb = new AWS.DynamoDB.DocumentClient({
      endpoint: ENV.DYNAMODB_ENDPOINT
    });
  } else {
    clients.dynamoDb = new AWS.DynamoDB.DocumentClient();
  }
  
  return clients.dynamoDb;
};

/**
 * SNSクライアントインスタンスを取得
 * @returns {AWS.SNS} SNSクライアント
 */
const getSNS = () => {
  if (clients.sns) {
    return clients.sns;
  }
  
  const AWS = configureAWS();
  
  // ローカル開発モードの場合の設定
  if (isDevelopment && ENV.SNS_ENDPOINT) {
    clients.sns = new AWS.SNS({
      endpoint: ENV.SNS_ENDPOINT
    });
  } else {
    clients.sns = new AWS.SNS();
  }
  
  return clients.sns;
};

/**
 * STS (Security Token Service) クライアントインスタンスを取得
 * @returns {AWS.STS} STSクライアント
 */
const getSTS = () => {
  if (clients.sts) {
    return clients.sts;
  }
  
  const AWS = configureAWS();
  
  // ローカル開発モードの場合の設定
  if (isDevelopment && ENV.STS_ENDPOINT) {
    clients.sts = new AWS.STS({
      endpoint: ENV.STS_ENDPOINT
    });
  } else {
    clients.sts = new AWS.STS();
  }
  
  return clients.sts;
};

/**
 * AWS設定をリセットする（テスト用）
 */
const resetAWSConfig = () => {
  clients.dynamoDb = null;
  clients.sns = null;
  clients.sts = null;
  AWS.config = new AWS.Config();
  configureAWS();
};

module.exports = {
  configureAWS,
  getDynamoDb,
  getSNS,
  getSTS,
  resetAWSConfig
};

