/**
 * AWS サービスのローカルエミュレーションを管理するユーティリティ
 */
const { DynamoDBClient, CreateTableCommand, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const { startDynamoDBLocal, stopDynamoDBLocal } = require('./dynamodbLocal');

/**
 * LocalStack エミュレーターのセットアップ
 * Docker不要でAWSサービスをエミュレート
 */
const setupLocalStackEmulator = async (options = {}) => {
  const {
    services = ['dynamodb'],
    region = 'us-east-1'
  } = options;
  
  console.log(`Setting up AWS emulator for services: ${services.join(', ')}`);
  
  // DynamoDBのエミュレーション
  if (services.includes('dynamodb')) {
    await startDynamoDBLocal();
  }
  
  return {
    // エミュレーターの停止
    stop: async () => {
      if (services.includes('dynamodb')) {
        stopDynamoDBLocal();
      }
    },
    
    // DynamoDBのアイテムを取得
    getDynamoDBItem: async (params) => {
      const client = new DynamoDBClient({
        region,
        endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
        credentials: {
          accessKeyId: 'test',
          secretAccessKey: 'test'
        }
      });
      
      try {
        const command = new GetItemCommand(params);
        const response = await client.send(command);
        return response;
      } catch (error) {
        console.error('Error getting DynamoDB item:', error);
        throw error;
      }
    },
    
    // DynamoDBにアイテムを保存
    putDynamoDBItem: async (tableName, item) => {
      const { PutItemCommand } = require('@aws-sdk/client-dynamodb');
      const client = new DynamoDBClient({
        region,
        endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
        credentials: {
          accessKeyId: 'test',
          secretAccessKey: 'test'
        }
      });
      
      try {
        const command = new PutItemCommand({
          TableName: tableName,
          Item: marshall(item)
        });
        const response = await client.send(command);
        return response;
      } catch (error) {
        console.error('Error putting DynamoDB item:', error);
        throw error;
      }
    },
    
    // SNSの通知をモック
    mockSNSPublish: () => {
      const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
      
      // SNSクライアントをモック
      jest.mock('@aws-sdk/client-sns', () => {
        const originalModule = jest.requireActual('@aws-sdk/client-sns');
        
        // PublishCommandのmockを作成
        const mockPublishCommand = jest.fn().mockImplementation(() => {
          return {
            MessageId: 'test-message-id'
          };
        });
        
        // SNSClientのmockを作成
        const mockSNSClient = jest.fn().mockImplementation(() => {
          return {
            send: jest.fn().mockImplementation(() => {
              return {
                MessageId: 'test-message-id'
              };
            })
          };
        });
        
        return {
          ...originalModule,
          SNSClient: mockSNSClient,
          PublishCommand: mockPublishCommand
        };
      });
      
      return {
        // モックをリセット
        reset: () => {
          jest.resetAllMocks();
        },
        // モックを復元
        restore: () => {
          jest.restoreAllMocks();
        }
      };
    }
  };
};

module.exports = {
  setupLocalStackEmulator
};
