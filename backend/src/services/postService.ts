import { PaginatedResult, PaginationOptions } from "../models/paginationModels";
import { CreatePostInput, Post, PostsResult, UpdatePostInput } from "../models/postModels";

import { v4 as uuidv4 } from "uuid";
// Import the shared DynamoDB document client and configuration for
// single‑table access. The DatabaseService exposes a singleton
// `docClient` configured for the ImageonApp table. We also pull in
// the application config to resolve the table name at runtime.
import { docClient } from "./database";
import { config } from "../config/index.js";
// DynamoDB command classes for CRUD operations on the single table.
import {
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

type Allowed = keyof UpdatePostInput;

class PostService {
  /**
   * In the new single‑table design all posts live in the
   * `ImageonApp` table (or whatever name is supplied via
   * environment). We store the table name from configuration
   * once on instantiation. Each post record uses a composite key
   * pattern:
   *   PK  = post_id
   *   SK  = 'POST'
   * with additional GSI attributes to support queries by user. See
   * database-design/dynamodb-schema.md for more details.
   */
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

      // Basic validation similar to the original implementation. We
      // require a user ID, username and non‑empty content for a
      // valid post. Without these values the post will not be
      // persisted.
      if (!user_id || !username || !content) {
        throw new Error("User ID, username, and content are required");
      }

      // Use a ULID/UUID as the unique post identifier. This will
      // become the partition key in our single‑table design. We also
      // capture the current timestamp once to ensure consistency
      // across multiple writes.
      const postId = uuidv4();
      const now = new Date().toISOString();

      // Construct the item for DynamoDB. We include both the
      // composite key attributes (PK, SK) and the original post
      // fields. GSI1PK/GSI1SK allow us to fetch posts by user in
      // chronological order. Additional counters are initialised
      // explicitly to zero. The `is_public` field defaults to true
      // and status to "active".
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

      // Perform a conditional put to avoid accidentally
      // overwriting an existing post with the same PK/SK. The
      // condition ensures both the partition and sort keys are
      // absent.
      await docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression:
            "attribute_not_exists(PK) AND attribute_not_exists(SK)",
        })
      );

      // Increment the author's posts_count on their user profile. User
      // profiles reside in the same table with PK equal to the user
      // identifier and SK equal to 'USER'. We use an UpdateCommand
      // with if_not_exists to handle first‑time counters.
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

      // Return only the Post fields, excluding the PK/SK/GSI metadata.
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
      // Fetch a post using its composite PK/SK. We use GetCommand
      // instead of Query because the partition and sort keys are
      // exactly known. If no item is found the Item property will be
      // undefined.
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
      // Strip DynamoDB metadata before returning. The service API
      // expects the Post interface without PK/SK/GSI fields.
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
      // Query the GSI1 index to get posts for a specific user. The
      // sort key begins with "POST#" followed by a timestamp which
      // enables ordering by creation time in descending order.
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
      // Scan the single table for all post records. We use a
      // FilterExpression on the sort key to only return items whose
      // SK is 'POST'. Because Scan does not guarantee order we do not
      // enforce chronological ordering here.
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

      // Only update permitted fields. We ignore attempts to modify
      // identifiers or immutable timestamps. Allowed fields come
      // directly from the UpdatePostInput type.
      (Object.keys(updates) as Allowed[]).forEach((key) => {
        if (!['post_id', 'user_id', 'author_id', 'created_at'].includes(key)) {
          updateExpressionParts.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = (updates as any)[key];
        }
      });

      // Always update the updated_at timestamp
      updateExpressionParts.push("#updated_at = :updated_at");
      expressionAttributeNames['#updated_at'] = 'updated_at';
      expressionAttributeValues[':updated_at'] = new Date().toISOString();

      if (updateExpressionParts.length === 0) {
        // If no updates provided after filtering, return the existing post
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
        ReturnValues: 'ALL_NEW',
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
      // Remove the post record from the single table using the composite
      // key. After deletion we decrement the author's posts_count.
      await docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            PK: postId,
            SK: 'POST',
          },
        })
      );
      const now = new Date().toISOString();
      await docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: existingPost.user_id, SK: 'USER' },
          UpdateExpression:
            'SET posts_count = if_not_exists(posts_count, :zero) - :dec, updated_at = :updated',
          ExpressionAttributeValues: {
            ':dec': 1,
            ':zero': 0,
            ':updated': now,
          },
        })
      );
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
        ReturnValues: 'ALL_NEW',
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
        ReturnValues: 'ALL_NEW',
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