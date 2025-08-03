// src/config/dynamodb.ts
import "dotenv/config";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { config } from "./index.js";

// Base low-level client
const rawClient = new DynamoDBClient({
  region: config.dynamodb.region,
  endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
  },
});

// Convenience Document client (handles marshalling/unmarshalling)
const dynamoClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: {
    // drop undefined values so they don't bloat items
    removeUndefinedValues: true,
  },
});

const TABLE_CONFIG = {
  tables: {
    // These must match what your table creation JSON defines.
    users: process.env.USERS_TABLE_NAME || "ImageonApp-Users",
    posts: process.env.POSTS_TABLE_NAME || "ImageonApp-Posts",
    likes: process.env.LIKES_TABLE_NAME || "ImageonApp-Likes",
    follows: process.env.FOLLOWS_TABLE_NAME || "ImageonApp-Follows",
  },
};

export { dynamoClient, TABLE_CONFIG };
