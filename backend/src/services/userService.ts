import { PaginatedResult, PaginationOptions } from "../models/paginationModels";
import { CreateUserInput, UpdateUserInput, User } from "../models/userModels";

import { v4 as uuidv4 } from "uuid";
import { dynamoClient, TABLE_CONFIG } from "../config/dynamodb";

type Allowed = keyof UpdateUserInput;

class UserService {
  private readonly tableName: string;

  constructor() {
    this.tableName = TABLE_CONFIG.tables.users;
  }

  async createUser(userData: CreateUserInput): Promise<User> {
    try {
      const { username, email, display_name, bio } = userData;

      if (!username || !email || !display_name) {
        throw new Error("Username, email, and display_name are required");
      }

      const existingUser = await this.getUserByUsername(username);
      if (existingUser) {
        throw new Error("Username already exists");
      }

      const existingEmail = await this.getUserByEmail(email);
      if (existingEmail) {
        throw new Error("Email already exists");
      }

      const now = new Date().toISOString();
      const user: User = {
        user_id: uuidv4(),
        username,
        email,
        display_name,
        bio: bio || "",
        profile_image_url: null,
        created_at: now,
        updated_at: now,
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        is_verified: false,
        is_private: false,
        status: "active",
      };

      await dynamoClient
        .put({
          TableName: this.tableName,
          Item: user,
          ConditionExpression: "attribute_not_exists(user_id)",
        })
        .promise();

      console.log(`User created: ${user.user_id} (${username})`);
      return user;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User|null> {
    try {
      const result = await dynamoClient
        .query({
          TableName: this.tableName,
          IndexName: "GSI1",
          KeyConditionExpression: "username = :username",
          ExpressionAttributeValues: {
            ":username": username,
          },
          Limit: 1,
        })
        .promise();
      
      if (!result.Items || result.Items.length <= 0) {
        return null;
      }

      return result.Items[0] as User;
    } catch (error) {
      console.error("Error getting user by username:", error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User|null> {
    try {
      const result = await dynamoClient
        .query({
          TableName: this.tableName,
          IndexName: "GSI2",
          KeyConditionExpression: "email = :email",
          ExpressionAttributeValues: {
            ":email": email,
          },
          Limit: 1,
        })
        .promise();
      
      if (!result.Items || result.Items.length <= 0) {
        return null;
      }

      return result.Items[0] as User;
    } catch (error) {
      console.error("Error getting user by email:", error);
      throw error;
    }
  }

  async getUserById(userId: string): Promise<User|null> {
    try {
      const result = await dynamoClient
        .query({
          TableName: this.tableName,
          KeyConditionExpression: "user_id = :userId",
          ExpressionAttributeValues: {
            ":userId": userId,
          },
          Limit: 1,
        })
        .promise();
      
      if (!result.Items || result.Items.length <= 0) {
        return null;
      }

      return result.Items[0] as User;
    } catch (error) {
      console.error("Error getting user by ID:", error);
      throw error;
    }
  }

  async getAllUsers(options: PaginationOptions = {}): Promise<PaginatedResult<User>> {
    try {
      const { limit = 20, lastEvaluatedKey } = options;

      const params = {
        TableName: this.tableName,
        Limit: limit,
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      };

      const result = await dynamoClient.scan(params).promise();
      const validatedItems = result.Items ?? [];

      return {
        items: validatedItems as User[],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count as number,
      };
    } catch (error) {
      console.error("Error getting all users:", error);
      throw error;
    }
  }

  async updateUser(userId: string, updates: UpdateUserInput): Promise<User> {
    try {
      const currentUser = await this.getUserById(userId);
      if (!currentUser) {
        throw new Error("User not found");
      }

      const updateExpression: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      (Object.keys(updates) as Allowed[]).forEach((key) => {
        if (!['user_id', 'username', 'email'].includes(key)) {
          updateExpression.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = updates[key];
        }
      });

      updateExpression.push("#updated_at = :updated_at");
      expressionAttributeNames["#updated_at"] = "updated_at";
      expressionAttributeValues[":updated_at"] = new Date().toISOString();

      const params = {
        TableName: this.tableName,
        Key: {
          user_id: userId,
          username: currentUser.username,
        },
        UpdateExpression: `SET ${updateExpression.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      };

      const result = await dynamoClient.update(params).promise();
      console.log(`User updated: ${userId}`);
      return result.Attributes as User;
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<boolean> {
    try {
      const currentUser = await this.getUserById(userId);
      if (!currentUser) {
        throw new Error("User not found");
      }

      const params = {
        TableName: this.tableName,
        Key: {
          user_id: userId,
          username: currentUser.username,
        },
        UpdateExpression: "SET #status = :status, #updated_at = :updated_at",
        ExpressionAttributeNames: {
          "#status": "status",
          "#updated_at": "updated_at",
        },
        ExpressionAttributeValues: {
          ":status": "deleted",
          ":updated_at": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      };

      await dynamoClient.update(params).promise();
      console.log(`User deleted: ${userId}`);
      return true;
    } catch (error) {
      console.error("Error deleting user:", error);
      throw error;
    }
  }
}

export const userService = new UserService();