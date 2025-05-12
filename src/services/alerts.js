/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/services/alerts.js
 * 
 * 説明: 
 * アラート通知サービス。SNSを使用して管理者に通知を送信します。
 * 使用量制限、エラー、重要なシステムイベントなどの通知に使用されます。
 * 通知はSNSトピックを通じてメール送信されます。
 * 
 * @author Portfolio Manager Team
 * @updated 2025-05-17
 */
'use strict';

const AWS = require('aws-sdk');
const { getSNS, getSTS } = require('../utils/awsConfig');
const { ENV } = require('../config/envConfig');
const logger = require('../utils/logger');
const { withRetry, isRetryableApiError } = require('../utils/retry');

/**
 * SNSトピックARN取得関数
 * @returns {Promise<string|null>} SNSトピックARN
 */
const getTopicArn = async () => {
  // 明示的に設定されたARNがあればそれを使用
  if (ENV.SNS_TOPIC_ARN) {
    return ENV.SNS_TOPIC_ARN;
  }

  // アカウントIDが環境変数にある場合はそれを使用
  let accountId = ENV.AWS_ACCOUNT_ID;
  
  // アカウントIDが環境変数にない場合はSTS経由で取得を試みる
  if (!accountId) {
    try {
      const sts = getSTS();
      const identity = await withRetry(
        () => sts.getCallerIdentity().promise(),
        {
          maxRetries: 2,
          baseDelay: 100,
          shouldRetry: isRetryableApiError
        }
      );
      accountId = identity.Account;
    } catch (error) {
      logger.warn('Failed to get AWS account ID from STS:', error);
      // 失敗した場合はログ出力のみ行い、通知は諦める
      return null;
    }
  }
  
  // アカウントIDが取得できた場合はARNを構築
  if (accountId) {
    return `arn:aws:sns:${ENV.REGION}:${accountId}:${ENV.SERVICE_NAME}-${ENV.NODE_ENV}-alerts`;
  }
  
  return null;
};

/**
 * アラート通知を送信する
 * @param {Object} options - 通知オプション
 * @param {string} options.subject - 通知件名
 * @param {string} options.message - 通知メッセージ
 * @param {string|Object} options.detail - 詳細情報（オプション）
 * @param {boolean} options.critical - 重大アラートかどうか（オプション）
 * @returns {Promise<boolean>} 送信が成功したかどうか
 */
const sendAlert = async ({ subject, message, detail, critical = false }) => {
  try {
    // トピックARNを取得
    const topicArn = await getTopicArn();
    
    // トピックARNが設定されていない場合
    if (!topicArn) {
      logger.warn('SNS Topic ARN is not configured. Unable to send alert.');
      // ログに通知内容を記録（少なくともCloudWatchログには残る）
      logger.info('Alert (not sent):', { subject, message, detail });
      return false;
    }
    
    // 詳細情報が異なる型の場合の変換
    let detailText = '';
    
    if (detail) {
      if (typeof detail === 'string') {
        detailText = detail;
      } else if (typeof detail === 'object') {
        try {
          detailText = JSON.stringify(detail, null, 2);
        } catch (e) {
          detailText = `${detail}`;
        }
      } else {
        detailText = `${detail}`;
      }
    }
    
    // 通知メッセージを構築
    const fullMessage = detailText 
      ? `${message}\n\nDetails:\n${detailText}`
      : message;
    
    // 環境や重要度に応じた件名のプレフィックス
    const subjectPrefix = critical
      ? `[CRITICAL][${ENV.SERVICE_NAME}-${ENV.NODE_ENV}]`
      : `[${ENV.SERVICE_NAME}-${ENV.NODE_ENV}]`;
    
    // SNSパラメータ
    const params = {
      TopicArn: topicArn,
      Subject: `${subjectPrefix} ${subject}`.substring(0, 100), // SNSの件名は100文字までの制限がある
      Message: fullMessage
    };
    
    // SNS通知を送信（再試行ロジック付き）
    const sns = getSNS();
    await withRetry(
      () => sns.publish(params).promise(),
      {
        maxRetries: 2,
        baseDelay: 100,
        shouldRetry: isRetryableApiError
      }
    );
    
    logger.info(`Alert sent: ${subject}`);
    return true;
  } catch (error) {
    logger.error('Error sending alert notification:', error);
    // エラー内容をログに記録
    logger.info('Alert (failed to send):', { subject, message, detail });
    return false;
  }
};

/**
 * 管理者通知を送信する簡易関数
 * @param {string} message - 通知メッセージ
 * @returns {Promise<boolean>} 送信が成功したかどうか
 */
const notify = async (message) => {
  return sendAlert({
    subject: 'Market Data API Notification',
    message
  });
};

/**
 * エラー通知を送信する
 * @param {string} subject - 通知件名
 * @param {Error} error - エラーオブジェクト
 * @param {Object} context - 追加コンテキスト情報
 * @param {boolean} critical - 重大エラーかどうか
 * @returns {Promise<boolean>} 送信が成功したかどうか
 */
const notifyError = async (subject, error, context = {}, critical = false) => {
  try {
    // エラーオブジェクトから情報を抽出
    const errorInfo = {
      message: error?.message || 'Unknown error',
      stack: error?.stack,
      ...context
    };
    
    // 通知を送信
    return await sendAlert({
      subject: `Error: ${subject}`,
      message: errorInfo.message,
      detail: errorInfo,
      critical
    });
  } catch (alertError) {
    logger.error('Failed to send error notification:', alertError);
    logger.error('Original error:', error);
    return false;
  }
};

/**
 * スロットリングされたアラート通知（同一メッセージの頻度制限）
 * @param {Object} options - 通知オプション
 * @param {string} options.key - スロットリング用のキー（同一キーで頻度制限）
 * @param {string} options.subject - 通知件名
 * @param {string} options.message - 通知メッセージ
 * @param {string|Object} options.detail - 詳細情報（オプション）
 * @param {number} options.intervalMinutes - スロットリング間隔（分）
 * @returns {Promise<boolean>} 送信が成功したかどうか
 */
const throttledAlert = async ({ key, subject, message, detail, intervalMinutes = 30 }) => {
  // スロットリング状態の保持（メモリ内、Lambda実行中のみ）
  if (!global._alertThrottleState) {
    global._alertThrottleState = {};
  }
  
  const now = Date.now();
  const throttleKey = `${key}`;
  const lastSent = global._alertThrottleState[throttleKey];
  
  // 前回の送信から指定された間隔が経過していない場合はスキップ
  if (lastSent && (now - lastSent < intervalMinutes * 60 * 1000)) {
    logger.info(`Alert throttled for key: ${key}`);
    return false;
  }
  
  // アラートを送信
  const result = await sendAlert({ subject, message, detail });
  
  // 送信成功した場合はタイムスタンプを更新
  if (result) {
    global._alertThrottleState[throttleKey] = now;
  }
  
  return result;
};

module.exports = {
  sendAlert,
  notify,
  notifyError,
  throttledAlert
};
