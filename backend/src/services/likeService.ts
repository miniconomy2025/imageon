import { CreateLikeInput, Like, LikeCountResult, LikesResult } from "../models/likeModels";
import { PaginatedResult, PaginationOptions } from "../models/paginationModels";
import { v4 as uuidv4 } from "uuid";
import { dynamoClient, TABLE_CONFIG } from "../config/dynamodb";

class LikeService {
  private readonly tableName: string;

  constructor() {
    this.tableName = TABLE_CONFIG.tables.likes;
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
      const like: Like = {
        post_id,
        user_id,
        username,
        created_at: now,
        updated_at: now,
        status: "active",
      };

      await dynamoClient
        .put({
          TableName: this.tableName,
          Item: like,
          ConditionExpression:
            "attribute_not_exists(post_id) AND attribute_not_exists(user_id)",
        })
        .promise();

      console.log(`Like created: ${username} liked post ${post_id}`);
      return like;
    } catch (error) {
      console.error("Error creating like:", error);
      throw error;
    }
  }

  async getLikeByPostAndUser(postId: string, userId: string): Promise<Like|null> {
    try {
      const result = await dynamoClient
        .get({
          TableName: this.tableName,
          Key: {
            post_id: postId,
            user_id: userId,
          },
        })
        .promise();

      if (!result.Item) {
        return null;
      }

      return result.Item as Like;
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

      const params = {
        TableName: this.tableName,
        KeyConditionExpression: "post_id = :postId",
        ExpressionAttributeValues: {
          ":postId": postId,
        },
        ScanIndexForward: false,
        Limit: limit,
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      };

      const result = await dynamoClient.query(params).promise();
      const validatedItems = result.Items ?? [];

      return {
        items: validatedItems as Like[],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Items ? result.Items.length : 0,
      };
    } catch (error) {
      console.error("Error getting likes by post ID:", error);
      throw error;
    }
  }

  async getLikesByUserId(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Like>> {
    try {
      const { limit = 20, lastEvaluatedKey } = options;

      const params = {
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "user_id = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
        ScanIndexForward: false,
        Limit: limit,
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      };

      const result = await dynamoClient.query(params).promise();
      const validatedItems = result.Items ?? [];

      return {
        items: validatedItems as Like[],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Items ? result.Items.length : 0,
      };
    } catch (error) {
      console.error("Error getting likes by user ID:", error);
      throw error;
    }
  }

  async deleteLike(postId: string, userId: string): Promise<boolean> {
    try {
      await dynamoClient
        .delete({
          TableName: this.tableName,
          Key: {
            post_id: postId,
            user_id: userId,
          },
        })
        .promise();

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