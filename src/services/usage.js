/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/services/usage.js
 * 
 * 説明: 
 * API使用量を追跡し、制限を適用するサービス。
 * 日次・月次の使用量カウンターを管理し、設定された制限値に
 * 基づいてAPIアクセスを制御します。使用量の統計情報やリセット機能も提供。
 * 
 * @author Portfolio Manager Team
 * @updated 2025-05-13
 */
'use strict';

const { getDynamoDb } = require('../utils/awsConfig');
const alertService = require('./alerts');
const { withRetry, isRetryableApiError } = require('../utils/retry');

const TABLE_NAME = process.env.DYNAMODB_TABLE;

// 環境変数から制限値を取得
const DAILY_REQUEST_LIMIT = parseInt(process.env.DAILY_REQUEST_LIMIT || '5000', 10);
const MONTHLY_REQUEST_LIMIT = parseInt(process.env.MONTHLY_REQUEST_LIMIT || '100000', 10);
const DISABLE_ON_LIMIT = (process.env.DISABLE_ON_LIMIT || 'true') === 'true';

// アラート閾値（パーセンテージ）
const USAGE_ALERT_THRESHOLDS = [50, 80, 90, 95, 99];

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
    const dynamoDb = getDynamoDb();
    
    // UpdateItem操作を使用して原子的にカウンターを増加
    const updateParams = {
      TableName: TABLE_NAME,
      Key: { id: key },
      UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :incr, #created = if_not_exists(#created, :timestamp), #updated = :timestamp',
      ExpressionAttributeNames: {
        '#count': 'count',
        '#created': 'created',
        '#updated': 'updatedAt'
      },
      ExpressionAttributeValues: {
        ':incr': 1,
        ':zero': 0,
        ':timestamp': Math.floor(Date.now() / 1000)
      },
      ReturnValues: 'UPDATED_NEW'
    };
    
    // 再試行ロジックを使用
    const updateResult = await withRetry(
      () => dynamoDb.update(updateParams).promise(),
      {
        maxRetries: 3,
        baseDelay: 100,
        shouldRetry: isRetryableApiError
      }
    );
    
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
    const dynamoDb = getDynamoDb();
    
    const params = {
      TableName: TABLE_NAME,
      Key: { id: key }
    };
    
    // 再試行ロジックを使用
    const result = await withRetry(
      () => dynamoDb.get(params).promise(),
      {
        maxRetries: 2,
        baseDelay: 100,
        shouldRetry: isRetryableApiError
      }
    );
    
    return result.Item ? result.Item.count : 0;
  } catch (error) {
    console.error(`Error getting counter ${key}:`, error);
    return 0;
  }
};

/**
 * カウンターをリセットする
 * @param {string} key - カウンターキー
 * @returns {Promise<Object>} リセット結果
 */
const resetCounter = async (key) => {
  try {
    const dynamoDb = getDynamoDb();
    
    // 現在の値を取得
    const oldValue = await getCounter(key);
    
    // カウンターを削除
    const deleteParams = {
      TableName: TABLE_NAME,
      Key: { id: key }
    };
    
    // 再試行ロジックを使用
    await withRetry(
      () => dynamoDb.delete(deleteParams).promise(),
      {
        maxRetries: 2,
        baseDelay: 100,
        shouldRetry: isRetryableApiError
      }
    );
    
    console.log(`Reset counter ${key} from ${oldValue} to 0`);
    return {
      success: true,
      key,
      oldValue,
      newValue: 0,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error resetting counter ${key}:`, error);
    return {
      success: false,
      key,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * 使用量の閾値をチェックしてアラートを送信
 * @param {number} count - カウント値
 * @param {number} limit - 制限値
 * @param {string} type - カウンターの種類（'daily'または'monthly'）
 * @returns {Promise<void>}
 */
const checkUsageThresholds = async (count, limit, type) => {
  try {
    const percentage = Math.round((count / limit) * 100);
    
    // 各閾値をチェック
    for (const threshold of USAGE_ALERT_THRESHOLDS) {
      // ちょうど閾値に達した場合のみアラート通知（頻繁なアラートを防止）
      if (percentage === threshold) {
        await alertService.sendAlert({
          subject: `API Usage ${threshold}% of ${type.toUpperCase()} Limit`,
          message: `API usage has reached ${threshold}% of the ${type} limit (${count}/${limit}).`,
          detail: {
            type,
            count,
            limit,
            percentage,
            timestamp: new Date().toISOString()
          },
          // 90%以上は重大アラート
          critical: threshold >= 90
        });
        
        break; // 最も高い閾値のみ通知
      }
    }
  } catch (error) {
    console.error(`Error checking usage thresholds for ${type}:`, error);
  }
};

/**
 * 使用量をチェックして更新する
 * @param {Object} options - オプション
 * @param {string} options.dataType - データタイプ（'us-stock', 'jp-stock'など）
 * @param {string} options.ip - IPアドレス（オプション）
 * @param {string} options.userAgent - ユーザーエージェント（オプション）
 * @param {string} options.sessionId - セッションID（オプション）
 * @returns {Promise<Object>} 使用量情報と制限状態
 */
const checkAndUpdateUsage = async (options = {}) => {
  try {
    const { dataType = 'unknown', ip, userAgent, sessionId } = options;
    
    const dailyKey = `usage_counter:daily:${getCurrentDateKey()}`;
    const monthlyKey = `usage_counter:monthly:${getCurrentMonthKey()}`;
    const typeKey = `usage_counter:type:${dataType}:${getCurrentDateKey()}`;
    
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
          detail: {
            daily: { count: dailyCount, limit: DAILY_REQUEST_LIMIT },
            monthly: { count: monthlyCount, limit: MONTHLY_REQUEST_LIMIT },
            timestamp: new Date().toISOString()
          },
          critical: true
        });
      }
      
      // DISABLE_ON_LIMITがtrueの場合はアクセスを拒否
      if (DISABLE_ON_LIMIT) {
        return {
          allowed: false,
          limitExceeded: true,
          limitType: isOverDailyLimit ? 'daily' : 'monthly',
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
    
    // カウンターを増加（原子的な操作）
    const newDailyCount = await incrementCounter(dailyKey);
    const newMonthlyCount = await incrementCounter(monthlyKey);
    
    // データタイプ別のカウンターも増加
    await incrementCounter(typeKey);
    
    // セッション別や IP アドレス別のカウンターも記録（オプション）
    if (sessionId) {
      await incrementCounter(`usage_counter:session:${sessionId}:${getCurrentDateKey()}`);
    }
    if (ip) {
      await incrementCounter(`usage_counter:ip:${ip}:${getCurrentDateKey()}`);
    }
    
    // 使用量の割合が閾値を超えた場合にアラートを送信
    await checkUsageThresholds(newDailyCount, DAILY_REQUEST_LIMIT, 'daily');
    await checkUsageThresholds(newMonthlyCount, MONTHLY_REQUEST_LIMIT, 'monthly');
    
    return {
      allowed: true,
      usage: {
        daily: {
          count: newDailyCount,
          limit: DAILY_REQUEST_LIMIT,
          percentage: Math.round((newDailyCount / DAILY_REQUEST_LIMIT) * 100)
        },
        monthly: {
          count: newMonthlyCount,
          limit: MONTHLY_REQUEST_LIMIT,
          percentage: Math.round((newMonthlyCount / MONTHLY_REQUEST_LIMIT) * 100)
        },
        dataType
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
    
    // データタイプ別の今日の使用量を取得
    const dataTypeUsage = {};
    const dataTypes = ['us-stock', 'jp-stock', 'mutual-fund', 'exchange-rate'];
    
    for (const type of dataTypes) {
      const key = `usage_counter:type:${type}:${getCurrentDateKey()}`;
      const count = await getCounter(key);
      dataTypeUsage[type] = count;
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
        byType: dataTypeUsage,
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
      const result = await resetCounter(dailyKey);
      resetItems.push(result);
      
      // データタイプ別のカウンターもリセット
      const dataTypes = ['us-stock', 'jp-stock', 'mutual-fund', 'exchange-rate'];
      for (const type of dataTypes) {
        const typeKey = `usage_counter:type:${type}:${getCurrentDateKey()}`;
        const typeResult = await resetCounter(typeKey);
        resetItems.push(typeResult);
      }
    }
    
    if (resetType === 'monthly' || resetType === 'all') {
      const monthlyKey = `usage_counter:monthly:${getCurrentMonthKey()}`;
      const result = await resetCounter(monthlyKey);
      resetItems.push(result);
    }
    
    // アラート通知
    await alertService.sendAlert({
      subject: 'API Usage Counters Reset',
      message: `${resetType} usage counters have been reset manually.`,
      detail: resetItems
    });
    
    return {
      success: true,
      message: `${resetType} カウンターをリセットしました`,
      resetTime: new Date().toISOString(),
      resetItems: resetItems
    };
  } catch (error) {
    console.error(`Error resetting usage counters (${resetType}):`, error);
    return {
      success: false,
      error: error.message,
      resetTime: new Date().toISOString()
    };
  }
};

module.exports = {
  checkAndUpdateUsage,
  getUsageStats,
  resetUsage
};
