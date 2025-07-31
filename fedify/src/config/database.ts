import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createClient } from "redis";

// DynamoDB Configuration

export const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  host: "http://localhost:8000",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Redis Configuration with fallback
export const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.log("Redis connection failed, continuing without cache");
        return false; // Stop trying to reconnect
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

// Initialize Redis connection with error handling
redisClient.on("error", (err) => {
  console.log("Redis not available, continuing without cache:", err.message);
});

redisClient.on("connect", () => console.log("Redis connected"));

// Table names
export const POSTS_TABLE = process.env.POSTS_TABLE || "fedify-posts";
export const USERS_TABLE = process.env.USERS_TABLE || "fedify-users";

// Cache keys
export const CACHE_KEYS = {
  POSTS: "posts",
  USER_POSTS: (username: string) => `user:${username}:posts`,
  POST: (id: string) => `post:${id}`,
} as const;
