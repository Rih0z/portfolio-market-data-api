/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/services/usage.js
 * 
 * 説明: 
 * API使用量を追跡し、制限を適用するサービス。
 * 日次・月次の使用量カウンターを管理し、設定された制限値に
 * 基づいてAPIアクセスを制御します。使用量の統計情報やリセット機能も提供。
 */
const AWS = require('aws-sdk');
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const alertService = require('./alerts');
const TABLE_NAME = process.env.DYNAMODB_TABLE;

// 環境変数から制限値を取得
const DAILY_REQUEST_LIMIT = parseInt(process.env.DAILY_REQUEST_LIMIT || '5000', 10);
const MONTHLY_REQUEST_LIMIT = parseInt(process.env.MONTHLY_REQUEST_LIMIT || '100000', 10);
const DISABLE_ON_LIMIT = (process.env.DISABLE_ON_LIMIT || 'true') === 'true';

/**
 * 現在の日付キーを生成する
 * @returns {string} 日付キー（YYYY-MM-DD）
 */
const getCurrentDateKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/**
 * 現在の月キーを生成する
 * @returns {string} 月キー（YYYY-MM）
 */
const getCurrentMonthKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * カウンターを増加させる（アトミック更新でレース条件を解消）
 * @param {string} key - カウンターキー
 * @returns {Promise<number>} 更新後のカウント値
 */
const incrementCounter = async (key) => {
  try {
    // UpdateItem操作を使用して原子的にカウンターを増加
    const updateParams = {
      TableName: TABLE_NAME,
      Key: { id: key },
      UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :incr, #created = if_not_exists(#created, :timestamp)',
      ExpressionAttributeNames: {
        '#count': 'count',
        '#created': 'created'
      },
      ExpressionAttributeValues: {
        ':incr': 1,
        ':zero': 0,
        ':timestamp': Math.floor(Date.now() / 1000)
      },
      ReturnValues: 'UPDATED_NEW'
    };
    
    const updateResult = await dynamoDb.update(updateParams).promise();
    return updateResult.Attributes.count;
  } catch (error) {
    console.error(`Error incrementing counter ${key}:`, error);
    // エラー発生時も何かしら返せるように
    return -1;
  }
};

/**
 * カウンターの値を取得する
 * @param {string} key - カウンターキー
 * @returns {Promise<number>} カウント値（存在しない場合は0）
 */
const getCounter = async (key) => {
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: { id: key }
    };
    
    const result = await dynamoDb.get(params).promise();
    
    return result.Item ? result.Item.count : 0;
  } catch (error) {
    console.error(`Error getting counter ${key}:`, error);
    return 0;
  }
};

/**
 * カウンターをリセットする
 * @param {string} key - カウンターキー
 * @returns {Promise<boolean>} リセットが成功したかどうか
 */
const resetCounter = async (key) => {
  try {
    // 現在の値を取得
    const oldValue = await getCounter(key);
    
    // カウンターを削除
    const deleteParams = {
      TableName: TABLE_NAME,
      Key: { id: key }
    };
    
    await dynamoDb.delete(deleteParams).promise();
    
    console.log(`Reset counter ${key} from ${oldValue} to 0`);
    return true;
  } catch (error) {
    console.error(`Error resetting counter ${key}:`, error);
    return false;
  }
};

/**
 * 使用量をチェックして更新する
 * @returns {Promise<Object>} 使用量情報と制限状態
 */
const checkAndUpdateUsage = async () => {
  try {
    const dailyKey = `usage_counter:daily:${getCurrentDateKey()}`;
    const monthlyKey = `usage_counter:monthly:${getCurrentMonthKey()}`;
    
    // 現在の使用量を取得
    const dailyCount = await getCounter(dailyKey);
    const monthlyCount = await getCounter(monthlyKey);
    
    // 使用量が制限を超えているかチェック
    const isOverDailyLimit = dailyCount >= DAILY_REQUEST_LIMIT;
    const isOverMonthlyLimit = monthlyCount >= MONTHLY_REQUEST_LIMIT;
    
    // いずれかの制限を超えている場合
    if (isOverDailyLimit || isOverMonthlyLimit) {
      // 制限に達した時の通知（回数が正確に一致する場合のみ）
      if (dailyCount === DAILY_REQUEST_LIMIT || monthlyCount === MONTHLY_REQUEST_LIMIT) {
        await alertService.sendAlert({
          subject: 'API Usage Limit Reached',
          message: `API usage limit has been reached: ${isOverDailyLimit ? 'Daily' : 'Monthly'} limit.`,
          detail: JSON.stringify({
            daily: { count: dailyCount, limit: DAILY_REQUEST_LIMIT },
            monthly: { count: monthlyCount, limit: MONTHLY_REQUEST_LIMIT },
            timestamp: new Date().toISOString()
          })
        });
      }
      
      // DISABLE_ON_LIMITがtrueの場合はアクセスを拒否
      if (DISABLE_ON_LIMIT) {
        return {
          allowed: false,
          usage: {
            daily: {
              count: dailyCount,
              limit: DAILY_REQUEST_LIMIT,
              percentage: Math.round((dailyCount / DAILY_REQUEST_LIMIT) * 100)
            },
            monthly: {
              count: monthlyCount,
              limit: MONTHLY_REQUEST_LIMIT,
              percentage: Math.round((monthlyCount / MONTHLY_REQUEST_LIMIT) * 100)
            }
          }
        };
      }
    }
    
    // カウンターを増加（原子的な操作に変更）
    const newDailyCount = await incrementCounter(dailyKey);
    const newMonthlyCount = await incrementCounter(monthlyKey);
    
    // 使用量の割合が閾値を超えた場合にアラートを送信
    const dailyPercentage = Math.round((newDailyCount / DAILY_REQUEST_LIMIT) * 100);
    const monthlyPercentage = Math.round((newMonthlyCount / MONTHLY_REQUEST_LIMIT) * 100);
    
    // ちょうど80%に達した場合のみアラート通知（頻繁なアラートを防止）
    if (dailyPercentage === 80 || monthlyPercentage === 80) {
      await alertService.sendAlert({
        subject: 'API Usage Warning - 80% of Limit',
        message: `API usage has reached 80% of the ${dailyPercentage === 80 ? 'daily' : 'monthly'} limit.`,
        detail: JSON.stringify({
          daily: { count: newDailyCount, limit: DAILY_REQUEST_LIMIT, percentage: dailyPercentage },
          monthly: { count: newMonthlyCount, limit: MONTHLY_REQUEST_LIMIT, percentage: monthlyPercentage },
          timestamp: new Date().toISOString()
        })
      });
    }
    
    return {
      allowed: true,
      usage: {
        daily: {
          count: newDailyCount,
          limit: DAILY_REQUEST_LIMIT,
          percentage: dailyPercentage
        },
        monthly: {
          count: newMonthlyCount,
          limit: MONTHLY_REQUEST_LIMIT,
          percentage: monthlyPercentage
        }
      }
    };
  } catch (error) {
    console.error('Error checking usage:', error);
    
    // エラー時はアクセスを許可（カウンターが壊れてもサービス自体は継続する）
    return {
      allowed: true,
      usage: {
        daily: { count: -1, limit: DAILY_REQUEST_LIMIT, percentage: 0 },
        monthly: { count: -1, limit: MONTHLY_REQUEST_LIMIT, percentage: 0 },
        error: error.message
      }
    };
  }
};

/**
 * 使用量統計を取得する
 * @returns {Promise<Object>} 使用量統計情報
 */
const getUsageStats = async () => {
  try {
    const dailyKey = `usage_counter:daily:${getCurrentDateKey()}`;
    const monthlyKey = `usage_counter:monthly:${getCurrentMonthKey()}`;
    
    // 現在の使用量を取得
    const dailyCount = await getCounter(dailyKey);
    const monthlyCount = await getCounter(monthlyKey);
    
    // 過去7日間の日次使用量を取得
    const dailyHistory = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const key = `usage_counter:daily:${dateKey}`;
      const count = await getCounter(key);
      
      dailyHistory.push({
        date: dateKey,
        count: count,
        percentage: Math.round((count / DAILY_REQUEST_LIMIT) * 100)
      });
    }
    
    // 過去6ヶ月間の月次使用量を取得
    const monthlyHistory = [];
    const thisMonth = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(thisMonth);
      date.setMonth(thisMonth.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const key = `usage_counter:monthly:${monthKey}`;
      const count = await getCounter(key);
      
      monthlyHistory.push({
        month: monthKey,
        count: count,
        percentage: Math.round((count / MONTHLY_REQUEST_LIMIT) * 100)
      });
    }
    
    return {
      current: {
        daily: {
          count: dailyCount,
          limit: DAILY_REQUEST_LIMIT,
          percentage: Math.round((dailyCount / DAILY_REQUEST_LIMIT) * 100)
        },
        monthly: {
          count: monthlyCount,
          limit: MONTHLY_REQUEST_LIMIT,
          percentage: Math.round((monthlyCount / MONTHLY_REQUEST_LIMIT) * 100)
        },
        timestamp: new Date().toISOString()
      },
      history: {
        daily: dailyHistory,
        monthly: monthlyHistory
      },
      config: {
        disableOnLimit: DISABLE_ON_LIMIT
      }
    };
  } catch (error) {
    console.error('Error getting usage stats:', error);
    return { error: error.message };
  }
};

/**
 * 使用量カウンターをリセットする
 * @param {string} resetType - リセットするカウンターのタイプ ('daily', 'monthly', 'all')
 * @returns {Promise<Object>} リセット結果
 */
const resetUsage = async (resetType) => {
  try {
    const resetItems = [];
    
    if (resetType === 'daily' || resetType === 'all') {
      const dailyKey = `usage_counter:daily:${getCurrentDateKey()}`;
      await resetCounter(dailyKey);
      resetItems.push(dailyKey);
    }
    
    if (resetType === 'monthly' || resetType === 'all') {
      const monthlyKey = `usage_counter:monthly:${getCurrentMonthKey()}`;
      await resetCounter(monthlyKey);
      resetItems.push(monthlyKey);
    }
    
    return {
      success: true,
      message: `${resetType}カウンターをリセットしました`,
      resetTime: new Date().toISOString(),
      resetItems: resetItems
    };
  } catch (error) {
    console.error(`Error resetting usage counters (${resetType}):`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  checkAndUpdateUsage,
  getUsageStats,
  resetUsage
};
