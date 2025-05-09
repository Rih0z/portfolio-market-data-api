/**
 * プロジェクト: portfolio-market-data-api
 * ファイルパス: src/services/cache.js
 * 
 * 説明: 
 * DynamoDBを使用したキャッシュ機能を提供するサービス。
 * 市場データの取得結果をキャッシングし、APIリクエスト数を削減します。
 * TTL(Time-To-Live)機能による自動期限切れと、スキャンによる検索も提供します。
 */
const AWS = require('aws-sdk');
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.DYNAMODB_TABLE;

// キャッシュパーティション定義（効率的なクエリのため）
const CACHE_PARTITIONS = {
  US_STOCK: 'us-stock',
  JP_STOCK: 'jp-stock',
  MUTUAL_FUND: 'mutual-fund',
  EXCHANGE_RATE: 'exchange-rate'
};

/**
 * キャッシュからデータを取得する
 * @param {string} key - キャッシュキー
 * @returns {Promise<Object|null>} キャッシュデータ（存在しない場合はnull）
 */
const get = async (key) => {
  try {
    console.log(`Attempting to get cache for key: ${key}`);
    
    const params = {
      TableName: TABLE_NAME,
      Key: { id: key }
    };
    
    const result = await dynamoDb.get(params).promise();
    
    // データが存在するか確認
    if (!result.Item) {
      console.log(`Cache miss for key: ${key}`);
      return null;
    }
    
    // 有効期限を確認
    const now = Math.floor(Date.now() / 1000);
    if (result.Item.expires && result.Item.expires < now) {
      console.log(`Cache expired for key: ${key}`);
      return null;
    }
    
    console.log(`Cache hit for key: ${key}`);
    return result.Item.data;
  } catch (error) {
    console.error(`Error getting cache for key ${key}:`, error);
    return null;
  }
};

/**
 * データをキャッシュに保存する
 * @param {string} key - キャッシュキー
 * @param {Object} data - 保存するデータ
 * @param {number} ttl - キャッシュ有効期間（秒）
 * @returns {Promise<boolean>} 保存が成功したかどうか
 */
const set = async (key, data, ttl) => {
  try {
    console.log(`Setting cache for key: ${key}, TTL: ${ttl}s`);
    
    // 有効期限を計算
    const now = Math.floor(Date.now() / 1000);
    const expires = now + parseInt(ttl, 10);
    
    // キャッシュパーティションを判定
    let partition = 'general';
    Object.entries(CACHE_PARTITIONS).forEach(([type, prefix]) => {
      if (key.startsWith(prefix)) {
        partition = type.toLowerCase();
      }
    });
    
    const params = {
      TableName: TABLE_NAME,
      Item: {
        id: key,
        data,
        expires,
        created: now,
        ttl: parseInt(ttl, 10),
        partition
      }
    };
    
    await dynamoDb.put(params).promise();
    console.log(`Successfully set cache for key: ${key}`);
    return true;
  } catch (error) {
    console.error(`Error setting cache for key ${key}:`, error);
    return false;
  }
};

/**
 * キャッシュから項目を削除する
 * @param {string} key - キャッシュキー
 * @returns {Promise<boolean>} 削除が成功したかどうか
 */
const remove = async (key) => {
  try {
    console.log(`Removing cache for key: ${key}`);
    
    const params = {
      TableName: TABLE_NAME,
      Key: { id: key }
    };
    
    await dynamoDb.delete(params).promise();
    console.log(`Successfully removed cache for key: ${key}`);
    return true;
  } catch (error) {
    console.error(`Error removing cache for key ${key}:`, error);
    return false;
  }
};

/**
 * パターンに一致するキャッシュ項目を検索する
 * @param {string} pattern - キーのパターン（前方一致）
 * @param {number} limit - 取得する最大項目数
 * @returns {Promise<Array>} 一致する項目のリスト
 */
const scan = async (pattern, limit = 100) => {
  try {
    console.log(`Scanning cache for pattern: ${pattern}`);
    
    // パーティション分割によるスキャン効率化
    let partition = 'general';
    Object.entries(CACHE_PARTITIONS).forEach(([type, prefix]) => {
      if (pattern.startsWith(prefix)) {
        partition = type.toLowerCase();
      }
    });
    
    // クエリパラメータの構築
    let params;
    
    // GSIを使ったより効率的なクエリ（実際のテーブル設計に応じて調整）
    if (partition !== 'general' && process.env.USE_PARTITION_INDEX === 'true') {
      params = {
        TableName: TABLE_NAME,
        IndexName: 'partition-index',
        KeyConditionExpression: 'partition = :partition',
        FilterExpression: 'begins_with(id, :pattern)',
        ExpressionAttributeValues: {
          ':partition': partition,
          ':pattern': pattern
        },
        Limit: limit
      };
    } else {
      // フォールバックとして通常のスキャン
      params = {
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(id, :pattern)',
        ExpressionAttributeValues: {
          ':pattern': pattern
        },
        Limit: limit
      };
    }
    
    const result = await dynamoDb.scan(params).promise();
    console.log(`Found ${result.Items.length} items matching pattern: ${pattern}`);
    return result.Items;
  } catch (error) {
    console.error(`Error scanning cache for pattern ${pattern}:`, error);
    return [];
  }
};

/**
 * キャッシュの統計情報を取得する
 * @returns {Promise<Object>} キャッシュ統計情報
 */
const getStats = async () => {
  try {
    console.log(`Getting cache statistics`);
    
    const now = Math.floor(Date.now() / 1000);
    const stats = {
      total: 0,
      active: 0,
      expired: 0,
      byType: {}
    };
    
    // 各キャッシュタイプごとに処理
    for (const [type, prefix] of Object.entries(CACHE_PARTITIONS)) {
      // 各タイプのアイテムを取得（最大50件まで）
      const items = await scan(prefix, 50);
      
      // 統計を計算
      if (!stats.byType[prefix]) {
        stats.byType[prefix] = { count: 0, items: [] };
      }
      
      items.forEach(item => {
        stats.total++;
        stats.byType[prefix].count++;
        
        // 有効期限をチェック
        if (item.expires && item.expires < now) {
          stats.expired++;
        } else {
          stats.active++;
        }
        
        // 簡易情報を保存
        const { id, created, expires, ttl } = item;
        stats.byType[prefix].items.push({ 
          id, 
          created, 
          expires, 
          ttl,
          isExpired: expires < now 
        });
      });
    }
    
    return stats;
  } catch (error) {
    console.error('Error getting cache statistics:', error);
    return { error: error.message };
  }
};

/**
 * 期限切れのキャッシュ項目をより効率的にクリーンアップする
 * @param {number} batchSize - 1回のバッチ処理サイズ
 * @returns {Promise<Object>} クリーンアップ結果
 */
const cleanup = async (batchSize = 25) => {
  try {
    console.log('Starting cache cleanup');
    
    const now = Math.floor(Date.now() / 1000);
    let deletedCount = 0;
    let scannedCount = 0;
    
    // 各キャッシュタイプごとに処理
    for (const [type, prefix] of Object.entries(CACHE_PARTITIONS)) {
      console.log(`Cleaning up ${type} cache items`);
      
      // 期限切れのアイテムを検索
      const params = {
        TableName: TABLE_NAME,
        FilterExpression: 'begins_with(id, :prefix) AND expires < :now',
        ExpressionAttributeValues: {
          ':prefix': prefix,
          ':now': now
        },
        Limit: batchSize
      };
      
      const result = await dynamoDb.scan(params).promise();
      scannedCount += result.ScannedCount;
      
      // 期限切れアイテムを削除
      const expiredItems = result.Items || [];
      console.log(`Found ${expiredItems.length} expired ${type} cache items`);
      
      if (expiredItems.length > 0) {
        // バッチ削除の準備
        const batchParams = {
          RequestItems: {
            [TABLE_NAME]: expiredItems.map(item => ({
              DeleteRequest: {
                Key: { id: item.id }
              }
            }))
          }
        };
        
        // バッチ削除の実行
        await dynamoDb.batchWrite(batchParams).promise();
        deletedCount += expiredItems.length;
      }
    }
    
    console.log(`Cleanup completed. Deleted ${deletedCount} expired cache items`);
    
    return {
      cleaned: deletedCount,
      totalScanned: scannedCount
    };
  } catch (error) {
    console.error('Error cleaning up cache:', error);
    return { error: error.message };
  }
};

module.exports = {
  get,
  set,
  remove,
  scan,
  getStats,
  cleanup
};
