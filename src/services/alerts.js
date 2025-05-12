/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/services/alerts.js
 * 
 * 説明: 
 * アラート通知サービス。SNSを使用して管理者に通知を送信します。
 * 使用量制限、エラー、重要なシステムイベントなどの通知に使用されます。
 * 通知はSNSトピックを通じてメール送信されます。
 */
const AWS = require('aws-sdk');
const sns = new AWS.SNS();

// 環境変数からトピックARNを構築
const region = process.env.AWS_REGION || 'ap-northeast-1';
const stage = process.env.STAGE || 'dev';
const serviceName = 'portfolio-market-data-api';

// SNSトピックARN取得関数（API Gatewayのステージ情報からも取得可能）
const getTopicArn = async () => {
  // 明示的に設定されたARNがあればそれを使用
  if (process.env.SNS_TOPIC_ARN) {
    return process.env.SNS_TOPIC_ARN;
  }

  // アカウントIDが環境変数にある場合はそれを使用
  let accountId = process.env.AWS_ACCOUNT_ID;
  
  // アカウントIDが環境変数にない場合はSTS経由で取得を試みる
  if (!accountId) {
    try {
      const sts = new AWS.STS();
      const identity = await sts.getCallerIdentity().promise();
      accountId = identity.Account;
    } catch (error) {
      console.warn('Failed to get AWS account ID from STS:', error);
      // 失敗した場合はログ出力のみ行い、通知は諦める
      return null;
    }
  }
  
  // アカウントIDが取得できた場合はARNを構築
  if (accountId) {
    return `arn:aws:sns:${region}:${accountId}:${serviceName}-${stage}-alerts`;
  }
  
  return null;
};

/**
 * アラート通知を送信する
 * @param {Object} options - 通知オプション
 * @param {string} options.subject - 通知件名
 * @param {string} options.message - 通知メッセージ
 * @param {string} options.detail - 詳細情報（オプション）
 * @returns {Promise<boolean>} 送信が成功したかどうか
 */
const sendAlert = async ({ subject, message, detail }) => {
  try {
    // トピックARNを取得
    const topicArn = await getTopicArn();
    
    // トピックARNが設定されていない場合
    if (!topicArn) {
      console.warn('SNS Topic ARN is not configured. Unable to send alert.');
      // ログに通知内容を記録（少なくともCloudWatchログには残る）
      console.log('Alert (not sent):', subject, message, detail || '');
      return false;
    }
    
    // 通知メッセージを構築
    const fullMessage = detail 
      ? `${message}\n\nDetails:\n${detail}`
      : message;
    
    // SNSパラメータ
    const params = {
      TopicArn: topicArn,
      Subject: `[${serviceName}-${stage}] ${subject}`,
      Message: fullMessage
    };
    
    // SNS通知を送信
    await sns.publish(params).promise();
    console.log(`Alert sent: ${subject}`);
    return true;
  } catch (error) {
    console.error('Error sending alert notification:', error);
    // エラー内容をログに記録
    console.log('Alert (failed to send):', subject, message, detail || '');
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

module.exports = {
  sendAlert,
  notify
};

