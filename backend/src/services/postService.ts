import { PaginatedResult, PaginationOptions } from "../models/paginationModels";
import { CreatePostInput, Post, PostsResult, UpdatePostInput } from "../models/postModels";

const { v4: uuidv4 } = require("uuid");
const { dynamoClient, TABLE_CONFIG } = require("../config/dynamodb");

type Allowed = keyof UpdatePostInput;

class PostService {
  private readonly tableName: string;

  constructor() {
    this.tableName = TABLE_CONFIG.tables.posts;
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

      const now = new Date().toISOString();
      const post: Post = {
        post_id: uuidv4(),
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

      await dynamoClient
        .put({
          TableName: this.tableName,
          Item: post,
          ConditionExpression: "attribute_not_exists(post_id)",
        })
        .promise();

      console.log(`Post created: ${post.post_id} by ${username}`);
      return post;
    } catch (error) {
      console.error("Error creating post:", error);
      throw error;
    }
  }

  async getPostById(postId: string): Promise<Post|null> {
    try {
      const result = await dynamoClient
        .query({
          TableName: this.tableName,
          KeyConditionExpression: "post_id = :postId",
          ExpressionAttributeValues: {
            ":postId": postId,
          },
        })
        .promise();

      return result.Items && result.Items.length > 0 ? result.Items[0] : null;
    } catch (error) {
      console.error("Error getting post by ID:", error);
      throw error;
    }
  }

  async getPostsByUserId(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Post>> {
    try {
      const { limit = 20, lastEvaluatedKey } = options;

      const params = {
        TableName: this.tableName,
        IndexName: "GSI2", 
        KeyConditionExpression: "author_id = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
        ScanIndexForward: false,
        Limit: limit,
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      };

      const result = await dynamoClient.query(params).promise();

      return {
        items: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Items ? result.Items.length : 0,
      };
    } catch (error) {
      console.error("Error getting posts by user ID:", error);
      throw error;
    }
  }

  async getAllPosts(options: PaginationOptions = {}): Promise<PaginatedResult<Post>> {
    try {
      const { limit = 20, lastEvaluatedKey } = options;

      const params = {
        TableName: this.tableName,
        ScanIndexForward: false,
        Limit: limit,
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      };

      const result = await dynamoClient.scan(params).promise();

      return {
        items: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Items ? result.Items.length : 0,
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

      const updateExpression: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      (Object.keys(updates) as Allowed[]).forEach((key) => {
        if (!['post_id', 'user_id', 'created_at'].includes(key)) {
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
          post_id: postId,
          author_id: existingPost.author_id,
        },
        UpdateExpression: `SET ${updateExpression.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      };

      const result = await dynamoClient.update(params).promise();
      console.log(`Post updated: ${postId}`);
      return result.Attributes;
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

      await dynamoClient
        .delete({
          TableName: this.tableName,
          Key: {
            post_id: postId,
            author_id: existingPost.author_id,
          },
        })
        .promise();

      console.log(`Post deleted: ${postId}`);
      return true;
    } catch (error) {
      console.error("Error deleting post:", error);
      throw error;
    }
  }

  async likePost(postId: string, userId: string): Promise<Post> {
    try {
      const existingPost = await this.getPostById(postId);
      if (!existingPost) {
        throw new Error("Post not found");
      }

      const params = {
        TableName: this.tableName,
        Key: {
          post_id: postId,
          author_id: existingPost.author_id,
        },
        UpdateExpression: "SET likes_count = likes_count + :inc",
        ExpressionAttributeValues: {
          ":inc": 1,
        },
        ReturnValues: "ALL_NEW",
      };

      const result = await dynamoClient.update(params).promise();
      console.log(`Post liked: ${postId} by user ${userId}`);
      return result.Attributes;
    } catch (error) {
      console.error("Error liking post:", error);
      throw error;
    }
  }

  async unlikePost(postId: string, userId: string): Promise<Post> {
    try {
      const existingPost = await this.getPostById(postId);
      if (!existingPost) {
        throw new Error("Post not found");
      }

      const params = {
        TableName: this.tableName,
        Key: {
          post_id: postId,
          author_id: existingPost.author_id,
        },
        UpdateExpression: "SET likes_count = likes_count - :dec",
        ExpressionAttributeValues: {
          ":dec": 1,
        },
        ReturnValues: "ALL_NEW",
      };

      const result = await dynamoClient.update(params).promise();
      console.log(`Post unliked: ${postId} by user ${userId}`);
      return result.Attributes;
    } catch (error) {
      console.error("Error unliking post:", error);
      throw error;
    }
  }
}

export const postService = new PostService();