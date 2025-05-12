/**
 * DynamoDB Localを管理するユーティリティ
 */
const { spawn } = require('child_process');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

let dynamoProcess = null;

/**
 * DynamoDB Localを起動する
 */
const startDynamoDBLocal = async (port = 8000) => {
  if (dynamoProcess) {
    console.log('DynamoDB Local is already running');
    return;
  }
  
  return new Promise((resolve, reject) => {
    console.log('Starting DynamoDB Local...');
    
    // プロジェクトルートからの相対パスで実行
    dynamoProcess = spawn('java', [
      '-Djava.library.path=./dynamodb-local/DynamoDBLocal_lib',
      '-jar',
      './dynamodb-local/DynamoDBLocal.jar',
      '-inMemory',
      '-port',
      port.toString()
    ]);
    
    dynamoProcess.stdout.on('data', (data) => {
      if (data.toString().includes('CorsParams')) {
        console.log('DynamoDB Local started successfully');
        resolve();
      }
    });
    
    dynamoProcess.stderr.on('data', (data) => {
      console.error('DynamoDB Local error:', data.toString());
    });
    
    dynamoProcess.on('error', (error) => {
      console.error('Failed to start DynamoDB Local:', error);
      reject(error);
    });
    
    // 5秒後にタイムアウト
    setTimeout(() => {
      if (dynamoProcess) {
        resolve();
      }
    }, 5000);
  });
};

/**
 * DynamoDB Localを停止する
 */
const stopDynamoDBLocal = () => {
  if (dynamoProcess) {
    console.log('Stopping DynamoDB Local...');
    dynamoProcess.kill();
    dynamoProcess = null;
  }
};

/**
 * テスト用のDynamoDBクライアントを取得する
 */
const getDynamoDBClient = () => {
  const client = new DynamoDBClient({
    region: 'us-east-1',
    endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test'
    }
  });
  
  return DynamoDBDocumentClient.from(client);
};

/**
 * テスト用のテーブルを作成する
 */
const createTestTable = async (tableName, keySchema = { key: 'S' }) => {
  const { CreateTableCommand } = require('@aws-sdk/client-dynamodb');
  const client = new DynamoDBClient({
    region: 'us-east-1',
    endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test'
    }
  });
  
  const keyName = Object.keys(keySchema)[0];
  const keyType = keySchema[keyName];
  
  const params = {
    TableName: tableName,
    KeySchema: [
      { AttributeName: keyName, KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: keyName, AttributeType: keyType }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  };
  
  try {
    await client.send(new CreateTableCommand(params));
    console.log(`Created table: ${tableName}`);
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log(`Table ${tableName} already exists`);
    } else {
      throw error;
    }
  }
};

module.exports = {
  startDynamoDBLocal,
  stopDynamoDBLocal,
  getDynamoDBClient,
  createTestTable
};
