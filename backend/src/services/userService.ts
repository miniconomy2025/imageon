import { PaginatedResult, PaginationOptions } from "../models/paginationModels";
import { CreateUserInput, UpdateUserInput, User } from "../models/userModels";

import { v4 as uuidv4 } from "uuid";
// Use the shared single‑table DynamoDB client and configuration. This
// ensures user records reside in the unified ImageonApp table. We also
// import the config to get the table name.
import { docClient } from "./database";
import { config } from "../config/index.js";
import {
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

type Allowed = keyof UpdateUserInput;

class UserService {
  /**
   * All user records live in the single table defined in the
   * configuration. We store the table name for reuse across methods.
   */
  private readonly tableName: string;

  constructor() {
    this.tableName = config.dynamodb.tableName;
  }

  async createUser(userData: CreateUserInput): Promise<User> {
    try {
      const { username, email, display_name, bio } = userData;
      // Validate required fields. We require a unique username,
      // email and display_name.
      if (!username || !email || !display_name) {
        throw new Error('Username, email, and display_name are required');
      }
      // Ensure the username and email are unique by scanning the table.
      const existingUser = await this.getUserByUsername(username);
      if (existingUser) {
        throw new Error('Username already exists');
      }
      const existingEmail = await this.getUserByEmail(email);
      if (existingEmail) {
        throw new Error('Email already exists');
      }
      const now = new Date().toISOString();
      const userId = uuidv4();
      // Compose the user record. Use a composite key with PK equal
      // to the user identifier and SK equal to 'USER'. Counters are
      // initialised to zero. Additional fields may be extended later.
      const item = {
        PK: userId,
        SK: 'USER',
        user_id: userId,
        username,
        email,
        display_name,
        bio: bio || '',
        profile_image_url: null,
        created_at: now,
        updated_at: now,
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        is_verified: false,
        is_private: false,
        status: 'active' as const,
      };
      // Persist the new user record. We conditionally write
      // ensuring that an item with the same PK/SK does not already
      // exist.
      await docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression:
            'attribute_not_exists(PK) AND attribute_not_exists(SK)',
        })
      );
      console.log(`User created: ${userId} (${username})`);
      // Return the user object without DynamoDB metadata.
      return {
        user_id: userId,
        username,
        email,
        display_name,
        bio: bio || '',
        profile_image_url: null,
        created_at: now,
        updated_at: now,
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        is_verified: false,
        is_private: false,
        status: 'active',
      };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User|null> {
    try {
      // Scan the table for a user record matching the provided
      // username. We restrict the scan to items with SK = 'USER'
      // to avoid unrelated entity types. Only the first match is
      // returned.
      const result = await docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'SK = :sk AND username = :username',
          ExpressionAttributeValues: {
            ':sk': 'USER',
            ':username': username,
          },
          Limit: 1,
        })
      );
      if (!result.Items || result.Items.length === 0) {
        return null;
      }
      const item: any = result.Items[0];
      return {
        user_id: item.user_id,
        username: item.username,
        email: item.email,
        display_name: item.display_name,
        bio: item.bio,
        profile_image_url: item.profile_image_url,
        created_at: item.created_at,
        updated_at: item.updated_at,
        followers_count: item.followers_count,
        following_count: item.following_count,
        posts_count: item.posts_count,
        is_verified: item.is_verified,
        is_private: item.is_private,
        status: item.status,
      } as User;
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User|null> {
    try {
      // Scan the table for a user record matching the provided email.
      const result = await docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'SK = :sk AND email = :email',
          ExpressionAttributeValues: {
            ':sk': 'USER',
            ':email': email,
          },
          Limit: 1,
        })
      );
      if (!result.Items || result.Items.length === 0) {
        return null;
      }
      const item: any = result.Items[0];
      return {
        user_id: item.user_id,
        username: item.username,
        email: item.email,
        display_name: item.display_name,
        bio: item.bio,
        profile_image_url: item.profile_image_url,
        created_at: item.created_at,
        updated_at: item.updated_at,
        followers_count: item.followers_count,
        following_count: item.following_count,
        posts_count: item.posts_count,
        is_verified: item.is_verified,
        is_private: item.is_private,
        status: item.status,
      } as User;
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    }
  }

  async getUserById(userId: string): Promise<User|null> {
    try {
      // Retrieve a user directly by its composite PK/SK. Using a Get
      // allows constant time lookup.
      const result = await docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: userId,
            SK: 'USER',
          },
        })
      );
      if (!result.Item) {
        return null;
      }
      const item: any = result.Item;
      return {
        user_id: item.user_id,
        username: item.username,
        email: item.email,
        display_name: item.display_name,
        bio: item.bio,
        profile_image_url: item.profile_image_url,
        created_at: item.created_at,
        updated_at: item.updated_at,
        followers_count: item.followers_count,
        following_count: item.following_count,
        posts_count: item.posts_count,
        is_verified: item.is_verified,
        is_private: item.is_private,
        status: item.status,
      } as User;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }

  async getAllUsers(options: PaginationOptions = {}): Promise<PaginatedResult<User>> {
    try {
      const { limit = 20, lastEvaluatedKey } = options;
      // Scan the single table and only return items with SK = 'USER'.
      const params: any = {
        TableName: this.tableName,
        FilterExpression: 'SK = :userSk',
        ExpressionAttributeValues: {
          ':userSk': 'USER',
        },
        Limit: limit,
      };
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }
      const result = await docClient.send(new ScanCommand(params));
      const items = (result.Items || []).map((item: any) => ({
        user_id: item.user_id,
        username: item.username,
        email: item.email,
        display_name: item.display_name,
        bio: item.bio,
        profile_image_url: item.profile_image_url,
        created_at: item.created_at,
        updated_at: item.updated_at,
        followers_count: item.followers_count,
        following_count: item.following_count,
        posts_count: item.posts_count,
        is_verified: item.is_verified,
        is_private: item.is_private,
        status: item.status,
      }));
      return {
        items: items as User[],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: items.length,
      };
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }

  async updateUser(userId: string, updates: UpdateUserInput): Promise<User> {
    try {
      const currentUser = await this.getUserById(userId);
      if (!currentUser) {
        throw new Error('User not found');
      }
      const updateExpressionParts: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};
      // Only allow updates to mutable fields. Disallow changes to
      // identity fields.
      (Object.keys(updates) as Allowed[]).forEach((key) => {
        if (!['user_id', 'username', 'email'].includes(key)) {
          updateExpressionParts.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = (updates as any)[key];
        }
      });
      // Always update the updated_at timestamp
      updateExpressionParts.push('#updated_at = :updated_at');
      expressionAttributeNames['#updated_at'] = 'updated_at';
      expressionAttributeValues[':updated_at'] = new Date().toISOString();
      if (updateExpressionParts.length === 0) {
        return currentUser;
      }
      const params = {
        TableName: this.tableName,
        Key: {
          PK: userId,
          SK: 'USER',
        },
        UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      };
      const result = await docClient.send(new UpdateCommand(params));
      console.log(`User updated: ${userId}`);
      const item: any = result.Attributes;
      return {
        user_id: item.user_id,
        username: item.username,
        email: item.email,
        display_name: item.display_name,
        bio: item.bio,
        profile_image_url: item.profile_image_url,
        created_at: item.created_at,
        updated_at: item.updated_at,
        followers_count: item.followers_count,
        following_count: item.following_count,
        posts_count: item.posts_count,
        is_verified: item.is_verified,
        is_private: item.is_private,
        status: item.status,
      } as User;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<boolean> {
    try {
      const currentUser = await this.getUserById(userId);
      if (!currentUser) {
        throw new Error('User not found');
      }
      const params = {
        TableName: this.tableName,
        Key: {
          PK: userId,
          SK: 'USER',
        },
        UpdateExpression: 'SET #status = :status, #updated_at = :updated_at',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#updated_at': 'updated_at',
        },
        ExpressionAttributeValues: {
          ':status': 'deleted',
          ':updated_at': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      };
      await docClient.send(new UpdateCommand(params));
      console.log(`User deleted: ${userId}`);
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
}

export const userService = new UserService();