import { CreateLikeInput, Like, LikeCountResult, LikesResult } from "../models/likeModels";
import { PaginatedResult, PaginationOptions } from "../models/paginationModels";
// Use the shared DynamoDB document client and configuration. These come
// from the single‑table database service rather than the deprecated
// per‑entity configuration. We also import the necessary DynamoDB
// command classes to perform CRUD operations.
import { docClient } from "./database";
import { config } from "../config/index.js";
import {
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

class LikeService {
  private readonly tableName: string;

  constructor() {
    // All like records are stored in the unified ImageonApp table
    this.tableName = config.dynamodb.tableName;
  }

  async createLike(likeData: CreateLikeInput): Promise<Like> {
    try {
      const { post_id, user_id, username } = likeData;

      if (!post_id || !user_id || !username) {
        throw new Error("Post ID, user ID, and username are required");
      }

      const existingLike = await this.getLikeByUserAndPost(user_id, post_id);
      if (existingLike) {
        throw new Error("User has already liked this post");
      }
      const now = new Date().toISOString();
      // Compose the like record. The primary key (PK) is the post ID and
      // the sort key (SK) stores the user ID prefixed with "LIKE#" so
      // we can filter likes by post. We also set GSI1PK/GSI1SK to enable
      // listing likes by user. Additional fields capture the original
      // relationship data and timestamps.
      const item = {
        PK: post_id,
        SK: `LIKE#${user_id}`,
        GSI1PK: user_id,
        GSI1SK: `LIKE#${post_id}`,
        post_id,
        user_id,
        username,
        created_at: now,
        updated_at: now,
        status: "active",
      };
      await docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
        })
      );
      // Increment the likes_count on the post itself. Posts are stored
      // with SK equal to 'POST'. If the attribute doesn’t exist yet it is
      // initialised to zero.
      await docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: post_id, SK: "POST" },
          UpdateExpression:
            "SET likes_count = if_not_exists(likes_count, :zero) + :inc, updated_at = :updated",
          ExpressionAttributeValues: {
            ":inc": 1,
            ":zero": 0,
            ":updated": now,
          },
        })
      );
      console.log(`Like created: ${username} liked post ${post_id}`);
      return {
        post_id,
        user_id,
        username,
        created_at: now,
        updated_at: now,
        status: "active",
      };
    } catch (error) {
      console.error("Error creating like:", error);
      throw error;
    }
  }

  async getLikeByPostAndUser(postId: string, userId: string): Promise<Like|null> {
    try {
      const result = await docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: postId,
            SK: `LIKE#${userId}`,
          },
        })
      );
      if (!result.Item) {
        return null;
      }
      const item: any = result.Item;
      return {
        post_id: item.post_id,
        user_id: item.user_id,
        username: item.username,
        created_at: item.created_at,
        updated_at: item.updated_at,
        status: item.status,
      };
    } catch (error) {
      console.error("Error getting like by post and user:", error);
      throw error;
    }
  }

  async getLikeByUserAndPost(userId: string, postId: string): Promise<Like|null> {
    return this.getLikeByPostAndUser(postId, userId);
  }

  async getLikesByPostId(postId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Like>> {
    try {
      const { limit = 20, lastEvaluatedKey } = options;
      const queryParams: any = {
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": postId,
          ":prefix": "LIKE#",
        },
        ScanIndexForward: false,
        Limit: limit,
      };
      if (lastEvaluatedKey) {
        queryParams.ExclusiveStartKey = lastEvaluatedKey;
      }
      const result = await docClient.send(new QueryCommand(queryParams));
      const items = (result.Items || []).map((item: any) => ({
        post_id: item.post_id,
        user_id: item.user_id,
        username: item.username,
        created_at: item.created_at,
        updated_at: item.updated_at,
        status: item.status,
      }));
      return {
        items: items as Like[],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: items.length,
      };
    } catch (error) {
      console.error("Error getting likes by post ID:", error);
      throw error;
    }
  }

  async getLikesByUserId(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Like>> {
    try {
      const { limit = 20, lastEvaluatedKey } = options;
      const queryParams: any = {
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": userId,
          ":prefix": "LIKE#",
        },
        ScanIndexForward: false,
        Limit: limit,
      };
      if (lastEvaluatedKey) {
        queryParams.ExclusiveStartKey = lastEvaluatedKey;
      }
      const result = await docClient.send(new QueryCommand(queryParams));
      const items = (result.Items || []).map((item: any) => ({
        post_id: item.post_id,
        user_id: item.user_id,
        username: item.username,
        created_at: item.created_at,
        updated_at: item.updated_at,
        status: item.status,
      }));
      return {
        items: items as Like[],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: items.length,
      };
    } catch (error) {
      console.error("Error getting likes by user ID:", error);
      throw error;
    }
  }

  async deleteLike(postId: string, userId: string): Promise<boolean> {
    try {
      // Delete the like record using the composite key. After removing
      // the relationship we decrement the likes_count on the post.
      await docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            PK: postId,
            SK: `LIKE#${userId}`,
          },
        })
      );
      const now = new Date().toISOString();
      await docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: postId, SK: "POST" },
          UpdateExpression:
            "SET likes_count = if_not_exists(likes_count, :zero) - :dec, updated_at = :updated",
          ExpressionAttributeValues: {
            ":dec": 1,
            ":zero": 0,
            ":updated": now,
          },
        })
      );
      console.log(`Like deleted: user ${userId} unliked post ${postId}`);
      return true;
    } catch (error) {
      console.error("Error deleting like:", error);
      throw error;
    }
  }

  async deleteLikeByUserAndPost(userId: string, postId: string): Promise<boolean> {
    return this.deleteLike(postId, userId);
  }

  async hasUserLikedPost(userId: string, postId: string): Promise<boolean> {
    try {
      const like = await this.getLikeByUserAndPost(userId, postId);
      return like !== null && like.status === "active";
    } catch (error) {
      console.error("Error checking if user liked post:", error);
      return false;
    }
  }

  async getLikeCountForPost(postId: string): Promise<number> {
    try {
      const result = await this.getLikesByPostId(postId, { limit: 1000 });
      return result.count;
    } catch (error) {
      console.error("Error getting like count for post:", error);
      return 0;
    }
  }
}

export const likeService = new LikeService();