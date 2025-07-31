import {
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  docClient,
  redisClient,
  POSTS_TABLE,
  CACHE_KEYS,
} from "../config/database.js";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("posts-service");

export interface Post {
  id: string;
  username: string;
  content: string;
  createdAt: string;
  attributedTo: string;
}

export class PostsService {
  // Create a new post
  async createPost(post: Post): Promise<Post> {
    try {
      // Store in DynamoDB
      await docClient.send(
        new PutCommand({
          TableName: POSTS_TABLE,
          Item: {
            id: post.id,
            username: post.username,
            content: post.content,
            createdAt: post.createdAt,
            attributedTo: post.attributedTo,
            // Add GSI for username-based queries
            username_createdAt: `${post.username}#${post.createdAt}`,
          },
        })
      );

      // Try to cache the post (ignore Redis errors)
      try {
        await redisClient.setEx(
          CACHE_KEYS.POST(post.id),
          3600, // 1 hour
          JSON.stringify(post)
        );
        await this.invalidateCache(post.username);
      } catch (redisError) {
        logger.warn("Redis cache unavailable, continuing without cache");
      }

      logger.info(`Post created: ${post.id} by ${post.username}`);
      return post;
    } catch (error) {
      logger.error(`Error creating post: ${error}`);
      throw error;
    }
  }

  // Get all posts (with caching)
  async getAllPosts(): Promise<Post[]> {
    try {
      // Try cache first
      try {
        const cached = await redisClient.get(CACHE_KEYS.POSTS);
        if (cached) {
          logger.info("Posts retrieved from cache");
          return JSON.parse(cached);
        }
      } catch (redisError) {
        logger.warn("Redis cache unavailable, fetching from DynamoDB");
      }

      // Get from DynamoDB
      const result = await docClient.send(
        new ScanCommand({
          TableName: POSTS_TABLE,
          ProjectionExpression:
            "id, username, content, createdAt, attributedTo",
        })
      );

      const posts = (result.Items || []) as Post[];

      // Sort by creation date (newest first)
      posts.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Try to cache the result (ignore Redis errors)
      try {
        await redisClient.setEx(CACHE_KEYS.POSTS, 300, JSON.stringify(posts)); // 5 minutes
      } catch (redisError) {
        logger.warn("Redis cache unavailable, continuing without cache");
      }

      logger.info(`Retrieved ${posts.length} posts from DynamoDB`);
      return posts;
    } catch (error) {
      logger.error(`Error getting all posts: ${error}`);
      throw error;
    }
  }

  // Get posts by username (with caching)
  async getPostsByUsername(username: string): Promise<Post[]> {
    try {
      // Try cache first
      try {
        const cached = await redisClient.get(CACHE_KEYS.USER_POSTS(username));
        if (cached) {
          logger.info(`User posts retrieved from cache for ${username}`);
          return JSON.parse(cached);
        }
      } catch (redisError) {
        logger.warn("Redis cache unavailable, fetching from DynamoDB");
      }

      // Get from DynamoDB using GSI
      const result = await docClient.send(
        new QueryCommand({
          TableName: POSTS_TABLE,
          IndexName: "UsernameCreatedAtIndex",
          KeyConditionExpression: "username = :username",
          ExpressionAttributeValues: {
            ":username": username,
          },
          ProjectionExpression:
            "id, username, content, createdAt, attributedTo",
        })
      );

      const posts = (result.Items || []) as Post[];

      // Sort by creation date (newest first)
      posts.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Try to cache the result (ignore Redis errors)
      try {
        await redisClient.setEx(
          CACHE_KEYS.USER_POSTS(username),
          300,
          JSON.stringify(posts)
        ); // 5 minutes
      } catch (redisError) {
        logger.warn("Redis cache unavailable, continuing without cache");
      }

      logger.info(`Retrieved ${posts.length} posts for user ${username}`);
      return posts;
    } catch (error) {
      logger.error(`Error getting posts for user ${username}: ${error}`);
      throw error;
    }
  }

  // Get a single post by ID (with caching)
  async getPostById(id: string): Promise<Post | null> {
    try {
      // Try cache first
      try {
        const cached = await redisClient.get(CACHE_KEYS.POST(id));
        if (cached) {
          logger.info(`Post retrieved from cache: ${id}`);
          return JSON.parse(cached);
        }
      } catch (redisError) {
        logger.warn("Redis cache unavailable, fetching from DynamoDB");
      }

      // Get from DynamoDB
      const result = await docClient.send(
        new GetCommand({
          TableName: POSTS_TABLE,
          Key: { id },
        })
      );

      if (!result.Item) {
        return null;
      }

      const post = result.Item as Post;

      // Try to cache the post (ignore Redis errors)
      try {
        await redisClient.setEx(
          CACHE_KEYS.POST(id),
          3600,
          JSON.stringify(post)
        ); // 1 hour
      } catch (redisError) {
        logger.warn("Redis cache unavailable, continuing without cache");
      }

      logger.info(`Retrieved post from DynamoDB: ${id}`);
      return post;
    } catch (error) {
      logger.error(`Error getting post ${id}: ${error}`);
      throw error;
    }
  }

  // Invalidate cache for a user
  private async invalidateCache(username: string): Promise<void> {
    try {
      await redisClient.del(CACHE_KEYS.POSTS);
      await redisClient.del(CACHE_KEYS.USER_POSTS(username));
      logger.info(`Cache invalidated for user: ${username}`);
    } catch (error) {
      logger.warn("Redis cache unavailable, skipping cache invalidation");
    }
  }
}

export const postsService = new PostsService();
