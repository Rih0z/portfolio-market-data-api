/**
 * DynamoDB操作サービス - DynamoDBとのデータやり取りを担当
 * 
 * @file src/utils/dynamoDbService.js
 * @author Koki Riho
 * @created 2025-05-12
 */
'use strict';

const AWS = require('aws-sdk');

// AWS SDKの設定
const region = process.env.REGION || 'ap-northeast-1';
AWS.config.update({ region });

// DynamoDBドキュメントクライアントの初期化
let dynamoDb;
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
  // ローカル開発用の設定
  const endpoint = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
  dynamoDb = new AWS.DynamoDB.DocumentClient({
    region,
    endpoint
  });
} else {
  // 本番環境用の設定
  dynamoDb = new AWS.DynamoDB.DocumentClient();
}

/**
 * DynamoDBからアイテムを取得する
 * @param {string} tableName - テーブル名
 * @param {Object} key - プライマリキー
 * @returns {Promise<Object|null>} - 取得したアイテム
 */
const getItem = async (tableName, key) => {
  const params = {
    TableName: tableName,
    Key: key
  };

  try {
    const result = await dynamoDb.get(params).promise();
    return result.Item || null;
  } catch (error) {
    console.error(`DynamoDB getItem error (${tableName}):`, error);
    throw error;
  }
};

/**
 * DynamoDBにアイテムを追加する
 * @param {string} tableName - テーブル名
 * @param {Object} item - 追加するアイテム
 * @returns {Promise<Object>} - 追加結果
 */
const addItem = async (tableName, item) => {
  const params = {
    TableName: tableName,
    Item: item
  };

  try {
    await dynamoDb.put(params).promise();
    return item;
  } catch (error) {
    console.error(`DynamoDB addItem error (${tableName}):`, error);
    throw error;
  }
};

/**
 * DynamoDBのアイテムを更新する
 * @param {string} tableName - テーブル名
 * @param {Object} key - プライマリキー
 * @param {Object} updates - 更新内容
 * @returns {Promise<Object>} - 更新結果
 */
const updateItem = async (tableName, key, updates) => {
  // 更新式と属性名、属性値を構築
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  Object.entries(updates).forEach(([field, value]) => {
    const fieldName = `#${field}`;
    const valueName = `:${field}`;
    
    updateExpressions.push(`${fieldName} = ${valueName}`);
    expressionAttributeNames[fieldName] = field;
    expressionAttributeValues[valueName] = value;
  });

  // 現在の時刻で updatedAt も更新
  const now = new Date().toISOString();
  updateExpressions.push('#updatedAt = :updatedAt');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = now;

  const params = {
    TableName: tableName,
    Key: key,
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  };

  try {
    const result = await dynamoDb.update(params).promise();
    return result.Attributes;
  } catch (error) {
    console.error(`DynamoDB updateItem error (${tableName}):`, error);
    throw error;
  }
};

/**
 * DynamoDBからアイテムを削除する
 * @param {string} tableName - テーブル名
 * @param {Object} key - プライマリキー
 * @returns {Promise<boolean>} - 削除成功したかどうか
 */
const deleteItem = async (tableName, key) => {
  const params = {
    TableName: tableName,
    Key: key
  };

  try {
    await dynamoDb.delete(params).promise();
    return true;
  } catch (error) {
    console.error(`DynamoDB deleteItem error (${tableName}):`, error);
    throw error;
  }
};

/**
 * DynamoDBのテーブルをクエリする
 * @param {string} tableName - テーブル名
 * @param {Object} keyCondition - キー条件
 * @param {Object} [options={}] - クエリオプション
 * @returns {Promise<Array>} - クエリ結果
 */
const queryItems = async (tableName, keyCondition, options = {}) => {
  // キー条件を構築
  const { keyName, keyValue, operator = '=' } = keyCondition;
  
  // キー条件式を生成
  let keyConditionExpression = '#keyName ' + operator + ' :keyValue';
  
  // フィルター式があれば設定
  const filterExpressions = [];
  const filterExpressionAttributeNames = {};
  const filterExpressionAttributeValues = {};
  
  if (options.filters) {
    Object.entries(options.filters).forEach(([field, { value, operator = '=' }]) => {
      const fieldName = `#${field}`;
      const valueName = `:${field}`;
      
      filterExpressions.push(`${fieldName} ${operator} ${valueName}`);
      filterExpressionAttributeNames[fieldName] = field;
      filterExpressionAttributeValues[valueName] = value;
    });
  }
  
  // パラメータを構築
  const params = {
    TableName: tableName,
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeNames: {
      '#keyName': keyName,
      ...filterExpressionAttributeNames
    },
    ExpressionAttributeValues: {
      ':keyValue': keyValue,
      ...filterExpressionAttributeValues
    }
  };
  
  // フィルター式があれば追加
  if (filterExpressions.length > 0) {
    params.FilterExpression = filterExpressions.join(' AND ');
  }
  
  // ソート順があれば設定
  if (options.sortDescending) {
    params.ScanIndexForward = false;
  }
  
  // 取得件数制限があれば設定
  if (options.limit) {
    params.Limit = options.limit;
  }
  
  // インデックスを使う場合
  if (options.indexName) {
    params.IndexName = options.indexName;
  }
  
  try {
    const result = await dynamoDb.query(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error(`DynamoDB queryItems error (${tableName}):`, error);
    throw error;
  }
};

/**
 * DynamoDBのテーブルをスキャンする
 * @param {string} tableName - テーブル名
 * @param {Object} [options={}] - スキャンオプション
 * @returns {Promise<Array>} - スキャン結果
 */
const scanItems = async (tableName, options = {}) => {
  // フィルター式があれば設定
  const filterExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  
  if (options.filters) {
    Object.entries(options.filters).forEach(([field, { value, operator = '=' }]) => {
      const fieldName = `#${field}`;
      const valueName = `:${field}`;
      
      filterExpressions.push(`${fieldName} ${operator} ${valueName}`);
      expressionAttributeNames[fieldName] = field;
      expressionAttributeValues[valueName] = value;
    });
  }
  
  // パラメータを構築
  const params = {
    TableName: tableName
  };
  
  // フィルター式があれば追加
  if (filterExpressions.length > 0) {
    params.FilterExpression = filterExpressions.join(' AND ');
    params.ExpressionAttributeNames = expressionAttributeNames;
    params.ExpressionAttributeValues = expressionAttributeValues;
  }
  
  // 取得件数制限があれば設定
  if (options.limit) {
    params.Limit = options.limit;
  }
  
  try {
    const result = await dynamoDb.scan(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error(`DynamoDB scanItems error (${tableName}):`, error);
    throw error;
  }
};

// エクスポート
module.exports = {
  getItem,
  addItem,
  updateItem,
  deleteItem,
  queryItems,
  scanItems
};
