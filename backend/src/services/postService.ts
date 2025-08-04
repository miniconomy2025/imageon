import { PaginatedResult, PaginationOptions } from "../models/paginationModels";
import { CreatePostInput, Post, PostsResult, UpdatePostInput } from "../models/postModels";

import { v4 as uuidv4 } from "uuid";
import { docClient } from "./database";
import { config } from "../config/index.js";
import {
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ReturnValue } from "@aws-sdk/client-dynamodb";


type Allowed = keyof UpdatePostInput;

class PostService {
  private readonly tableName: string;

  constructor() {
    this.tableName = config.dynamodb.tableName;
  }

  async createPost(postData: CreatePostInput): Promise<Post> {
    try {
      const {
        user_id,
        username,
        content,
        media_url,
        media_type,
        tags,
        location,
      } = postData;

      if (!user_id || !username || !content) {
        throw new Error("User ID, username, and content are required");
      }

      const postId = uuidv4();
      const now = new Date().toISOString();

      const item = {
        PK: postId,
        SK: "POST",
        GSI1PK: user_id,
        GSI1SK: `POST#${now}#${postId}`,
        post_id: postId,
        author_id: user_id,
        user_id,
        username,
        content,
        media_url: media_url || null,
        media_type: media_type || null,
        created_at: now,
        updated_at: now,
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        is_public: true,
        status: "active" as const,
        tags: tags || [],
        location: location || null,
      };

      await docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression:
            "attribute_not_exists(PK) AND attribute_not_exists(SK)",
        })
      );

      await docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: user_id, SK: "USER" },
          UpdateExpression:
            "SET posts_count = if_not_exists(posts_count, :zero) + :inc, updated_at = :updated",
          ExpressionAttributeValues: {
            ":inc": 1,
            ":zero": 0,
            ":updated": now,
          },
        })
      );

      console.log(`Post created: ${postId} by ${username}`);

      return {
        post_id: postId,
        author_id: user_id,
        user_id,
        username,
        content,
        media_url: media_url || null,
        media_type: media_type || null,
        created_at: now,
        updated_at: now,
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        is_public: true,
        status: "active",
        tags: tags || [],
        location: location || null,
      };
    } catch (error) {
      console.error("Error creating post:", error);
      throw error;
    }
  }

  async getPostById(postId: string): Promise<Post|null> {
    try {
      const result = await docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: postId,
            SK: "POST",
          },
        })
      );
      if (!result.Item) {
        return null;
      }
      const item: any = result.Item;
      return {
        post_id: item.post_id,
        author_id: item.author_id,
        user_id: item.user_id,
        username: item.username,
        content: item.content,
        media_url: item.media_url,
        media_type: item.media_type,
        created_at: item.created_at,
        updated_at: item.updated_at,
        likes_count: item.likes_count,
        comments_count: item.comments_count,
        shares_count: item.shares_count,
        is_public: item.is_public,
        status: item.status,
        tags: item.tags,
        location: item.location,
      } as Post;
    } catch (error) {
      console.error("Error getting post by ID:", error);
      throw error;
    }
  }

  async getPostsByUserId(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Post>> {
    try {
      const { limit = 20, lastEvaluatedKey } = options;
      const queryParams: any = {
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression:
          "GSI1PK = :pk AND begins_with(GSI1SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": userId,
          ":prefix": "POST#",
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
        author_id: item.author_id,
        user_id: item.user_id,
        username: item.username,
        content: item.content,
        media_url: item.media_url,
        media_type: item.media_type,
        created_at: item.created_at,
        updated_at: item.updated_at,
        likes_count: item.likes_count,
        comments_count: item.comments_count,
        shares_count: item.shares_count,
        is_public: item.is_public,
        status: item.status,
        tags: item.tags,
        location: item.location,
      }));
      return {
        items: items as Post[],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: items.length,
      };
    } catch (error) {
      console.error("Error getting posts by user ID:", error);
      throw error;
    }
  }

  async getAllPosts(options: PaginationOptions = {}): Promise<PaginatedResult<Post>> {
    try {
      const { limit = 20, lastEvaluatedKey } = options;
      const params: any = {
        TableName: this.tableName,
        FilterExpression: "SK = :postSk",
        ExpressionAttributeValues: {
          ":postSk": "POST",
        },
        Limit: limit,
      };
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }
      const result = await docClient.send(new ScanCommand(params));
      const items = (result.Items || []).map((item: any) => ({
        post_id: item.post_id,
        author_id: item.author_id,
        user_id: item.user_id,
        username: item.username,
        content: item.content,
        media_url: item.media_url,
        media_type: item.media_type,
        created_at: item.created_at,
        updated_at: item.updated_at,
        likes_count: item.likes_count,
        comments_count: item.comments_count,
        shares_count: item.shares_count,
        is_public: item.is_public,
        status: item.status,
        tags: item.tags,
        location: item.location,
      }));
      return {
        items: items as Post[],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: items.length,
      };
    } catch (error) {
      console.error("Error getting all posts:", error);
      throw error;
    }
  }

  async updatePost(postId: string, updates: UpdatePostInput): Promise<Post> {
    try {
      const existingPost = await this.getPostById(postId);
      if (!existingPost) {
        throw new Error("Post not found");
      }

      const updateExpressionParts: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      (Object.keys(updates) as Allowed[]).forEach((key) => {
        if (!['post_id', 'user_id', 'author_id', 'created_at'].includes(key)) {
          updateExpressionParts.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = (updates as any)[key];
        }
      });

      updateExpressionParts.push("#updated_at = :updated_at");
      expressionAttributeNames['#updated_at'] = 'updated_at';
      expressionAttributeValues[':updated_at'] = new Date().toISOString();

      if (updateExpressionParts.length === 0) {
        return existingPost;
      }

      const params = {
        TableName: this.tableName,
        Key: {
          PK: postId,
          SK: 'POST',
        },
        UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW' as ReturnValue,
      };
      const result = await docClient.send(new UpdateCommand(params));
      console.log(`Post updated: ${postId}`);
      const item: any = result.Attributes;
      return {
        post_id: item.post_id,
        author_id: item.author_id,
        user_id: item.user_id,
        username: item.username,
        content: item.content,
        media_url: item.media_url,
        media_type: item.media_type,
        created_at: item.created_at,
        updated_at: item.updated_at,
        likes_count: item.likes_count,
        comments_count: item.comments_count,
        shares_count: item.shares_count,
        is_public: item.is_public,
        status: item.status,
        tags: item.tags,
        location: item.location,
      } as Post;
    } catch (error) {
      console.error("Error updating post:", error);
      throw error;
    }
  }

  async deletePost(postId: string): Promise<boolean> {
    try {
      const existingPost = await this.getPostById(postId);
      if (!existingPost) {
        throw new Error("Post not found");
      }
      const likesQuery = await docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk and begins_with(SK, :prefix)',
          ExpressionAttributeValues: {
            ':pk': postId,
            ':prefix': 'LIKE#',
          },
        })
      );
      const likeItems = likesQuery.Items || [];
      for (const like of likeItems) {
        try {
          await docClient.send(
            new DeleteCommand({
              TableName: this.tableName,
              Key: { PK: like.PK, SK: like.SK },
            })
          );
        } catch (err) {
          console.error('Error deleting like item during post deletion:', err);
        }
      }
      const now = new Date().toISOString();
      const transactItems = [
        {
          Delete: {
            TableName: this.tableName,
            Key: { PK: postId, SK: 'POST' },
          },
        },
        {
          Update: {
            TableName: this.tableName,
            Key: { PK: existingPost.user_id, SK: 'USER' },
            UpdateExpression:
              'SET posts_count = if_not_exists(posts_count, :zero) - :dec, updated_at = :updated',
            ExpressionAttributeValues: {
              ':dec': 1,
              ':zero': 0,
              ':updated': now,
            },
          },
        },
      ];
      await docClient.send(
        new TransactWriteCommand({ TransactItems: transactItems })
      );
      console.log(`Post deleted: ${postId}`);
      return true;
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  }

  async likePost(postId: string, userId: string): Promise<Post> {
    try {
      const existingPost = await this.getPostById(postId);
      if (!existingPost) {
        throw new Error("Post not found");
      }
      const now = new Date().toISOString();
      const params = {
        TableName: this.tableName,
        Key: {
          PK: postId,
          SK: 'POST',
        },
        UpdateExpression:
          'SET likes_count = if_not_exists(likes_count, :zero) + :inc, updated_at = :updated',
        ExpressionAttributeValues: {
          ':inc': 1,
          ':zero': 0,
          ':updated': now,
        },
        ReturnValues: 'ALL_NEW' as ReturnValue,
      };
      const result = await docClient.send(new UpdateCommand(params));
      console.log(`Post liked: ${postId} by user ${userId}`);
      const item: any = result.Attributes;
      return {
        post_id: item.post_id,
        author_id: item.author_id,
        user_id: item.user_id,
        username: item.username,
        content: item.content,
        media_url: item.media_url,
        media_type: item.media_type,
        created_at: item.created_at,
        updated_at: item.updated_at,
        likes_count: item.likes_count,
        comments_count: item.comments_count,
        shares_count: item.shares_count,
        is_public: item.is_public,
        status: item.status,
        tags: item.tags,
        location: item.location,
      } as Post;
    } catch (error) {
      console.error('Error liking post:', error);
      throw error;
    }
  }

  async unlikePost(postId: string, userId: string): Promise<Post> {
    try {
      const existingPost = await this.getPostById(postId);
      if (!existingPost) {
        throw new Error('Post not found');
      }
      const now = new Date().toISOString();
      const params = {
        TableName: this.tableName,
        Key: {
          PK: postId,
          SK: 'POST',
        },
        UpdateExpression:
          'SET likes_count = if_not_exists(likes_count, :zero) - :dec, updated_at = :updated',
        ExpressionAttributeValues: {
          ':dec': 1,
          ':zero': 0,
          ':updated': now,
        },
        ReturnValues: 'ALL_NEW' as ReturnValue,
      };
      const result = await docClient.send(new UpdateCommand(params));
      console.log(`Post unliked: ${postId} by user ${userId}`);
      const item: any = result.Attributes;
      return {
        post_id: item.post_id,
        author_id: item.author_id,
        user_id: item.user_id,
        username: item.username,
        content: item.content,
        media_url: item.media_url,
        media_type: item.media_type,
        created_at: item.created_at,
        updated_at: item.updated_at,
        likes_count: item.likes_count,
        comments_count: item.comments_count,
        shares_count: item.shares_count,
        is_public: item.is_public,
        status: item.status,
        tags: item.tags,
        location: item.location,
      } as Post;
    } catch (error) {
      console.error('Error unliking post:', error);
      throw error;
    }
  }
}

export const postService = new PostService();