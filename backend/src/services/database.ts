import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { config } from "../config/index.js";

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: config.dynamodb.region,
  endpoint: config.dynamodb.endpoint,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

export const docClient = DynamoDBDocumentClient.from(dynamoClient);

export class DatabaseService {
  private tableName: string;

  constructor() {
    this.tableName = config.dynamodb.tableName;
  }

  /**
   * Get an item by primary key
   */
  async getItem(pk: string, sk: string) {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: { PK: pk, SK: sk }
      });
      const result = await docClient.send(command);
      return result.Item;
    } catch (error) {
      console.error(`Error getting item ${pk}#${sk}:`, error);
      return null;
    }
  }

  /**
   * Put an item into the database
   */
  async putItem(item: Record<string, any>) {
    try {
      const command = new PutCommand({
        TableName: this.tableName,
        Item: {
          ...item,
          created_at: item.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      });
      await docClient.send(command);
      return true;
    } catch (error) {
      console.error('Error putting item:', error);
      return false;
    }
  }

  /**
   * Query items by partition key
   */
  async queryItems(pk: string, options?: {
    sortKeyExpression?: string;
    attributeValues?: Record<string, any>;
    limit?: number;
  }) {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: options?.sortKeyExpression 
          ? `PK = :pk AND ${options.sortKeyExpression}`
          : 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': pk,
          ...options?.attributeValues,
        },
        Limit: options?.limit,
      });
      const result = await docClient.send(command);
      return result.Items || [];
    } catch (error) {
      console.error(`Error querying items for ${pk}:`, error);
      return [];
    }
  }

  /**
   * Query items by GSI1 index
   */
  async queryItemsByGSI1(gsi1pk: string, options?: {
    sortKeyExpression?: string;
    attributeValues?: Record<string, any>;
    limit?: number;
  }) {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: options?.sortKeyExpression 
          ? `GSI1PK = :gsi1pk AND ${options.sortKeyExpression}`
          : 'GSI1PK = :gsi1pk',
        ExpressionAttributeValues: {
          ':gsi1pk': gsi1pk,
          ...options?.attributeValues,
        },
        Limit: options?.limit,
      });
      const result = await docClient.send(command);
      return result.Items || [];
    } catch (error) {
      console.error(`Error querying GSI1 items for ${gsi1pk}:`, error);
      return [];
    }
  }

  /**
   * Get actor profile from database
   */
  async getActor(identifier: string) {
    return this.getItem(`ACTOR#${identifier}`, 'PROFILE');
  }

  /**
   * Get all local actors
   */
  async getLocalActors() {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'LOCAL_ACTORS',
        },
      });
      const result = await docClient.send(command);
      return result.Items || [];
    } catch (error) {
      console.error('Error getting local actors:', error);
      return [];
    }
  }
}

// Export a singleton instance
export const db = new DatabaseService();
