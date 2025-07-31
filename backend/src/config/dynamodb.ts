// src/dynamodb.ts

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";               // Low‑level client :contentReference[oaicite:0]{index=0}
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";        // Document client wrapper :contentReference[oaicite:1]{index=1}
import dotenv from "dotenv";

dotenv.config();

// 1. Configuration
const REGION   = process.env.AWS_REGION             || "us-east-1";
const ENDPOINT = process.env.DYNAMODB_ENDPOINT      || "http://localhost:8000";

// 2. Instantiate the low‑level DynamoDB client
export const rawClient = new DynamoDBClient({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID     || "LOCAL",   // Ignored by DynamoDB Local
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "LOCAL",   // Ignored by DynamoDB Local
  },
});

// 3. Create the Document client for automatic marshalling/unmarshalling
export const ddbClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: {
    // Remove undefined values to avoid sending invalid attributes :contentReference[oaicite:2]{index=2}
    removeUndefinedValues: true,
    // Do not convert empty strings or buffers
    convertEmptyValues:    false,
  },
  unmarshallOptions: {
    // Return numbers as JavaScript numbers rather than strings
    wrapNumbers: false,
  },
});
