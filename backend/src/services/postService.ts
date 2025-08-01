// src/services/postService.ts

import {
  PutCommand,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbClient } from "../config/dynamodb";

export interface PostMetadata {
  postId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  contentType: string; // e.g., "text", "image", "video"
  mediaUrls?: string[];
  createdAt: string;
  updatedAt: string;
  likesCount: number;
  engagementScore: number;
  visibility: "public" | "followers" | "private";
  hashtags?: string[];
  mentions?: string[];
}

/**
 * Create a post. Updates the post metadata and optionally could be extended to
 * update feed entries / user counters in a single transaction.
 */
export async function createPost(post: {
  postId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  contentType: string;
  mediaUrls?: string[];
  visibility?: "public" | "followers" | "private";
  hashtags?: string[];
  mentions?: string[];
}): Promise<void> {
  const now = new Date().toISOString();
  const postKey = `POST#${post.postId}`;
  const timelineDate = now.slice(0, 10); // e.g., "2025-07-29"
  const item: Record<string, any> = {
    PK: postKey,
    SK: "METADATA",
    GSI1PK: `USER#${post.authorId}`,
    GSI1SK: `POST#${now}#${post.postId}`,
    GSI2PK: `TIMELINE#${timelineDate}`,
    GSI2SK: `${now}#${post.postId}`,
    // initial popular-posts score placeholder
    GSI3PK: "POPULAR_POSTS",
    GSI3SK: `0#${now}#${post.postId}`,
    author_id: post.authorId,
    author_username: post.authorUsername,
    content: post.content,
    content_type: post.contentType,
    media_urls: post.mediaUrls ?? [],
    created_at: now,
    updated_at: now,
    likes_count: 0,
    engagement_score: 0,
    visibility: post.visibility || "public",
    is_deleted: false,
    hashtags: post.hashtags ?? [],
    mentions: post.mentions ?? [],
    activity_id: `https://your-domain.com/posts/${post.postId}`,
    activity_type: "Note",
    audience: ["https://www.w3.org/ns/activitystreams#Public"],
  };

  // Optionally include incrementing author's posts_count in PROFILE via transaction
  await ddbClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: "ImageonApp",
            Item: item,
          },
        },
        {
          Update: {
            TableName: "ImageonApp",
            Key: { PK: `USER#${post.authorId}`, SK: "PROFILE" },
            UpdateExpression: "ADD posts_count :inc",
            ExpressionAttributeValues: { ":inc": 1 },
          },
        },
      ],
    })
  );
}

/**
 * Get a post by its ID.
 */
export async function getPostById(postId: string): Promise<PostMetadata | null> {
  const { Item } = await ddbClient.send(
    new GetCommand({
      TableName: "ImageonApp",
      Key: {
        PK: `POST#${postId}`,
        SK: "METADATA",
      },
    })
  );
  return (Item as PostMetadata) ?? null;
}

/**
 * Query timeline posts (discovery) for a given date.
 */
export async function getTimelinePosts(
  dateISO: string,
  limit = 50,
  lastKey?: Record<string, any>
): Promise<{ items: PostMetadata[]; lastKey?: Record<string, any> }> {
  const resp = await ddbClient.send(
    new QueryCommand({
      TableName: "ImageonApp",
      IndexName: "GSI2",
      KeyConditionExpression: "GSI2PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `TIMELINE#${dateISO}`,
      },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: lastKey,
    })
  );
  return {
    items: (resp.Items ?? []) as PostMetadata[],
    lastKey: resp.LastEvaluatedKey,
  };
}

/**
 * Like a post (permanent, no unlike). Atomic: add LIKE item and increment likes_count.
 */
export async function likePost(
  postId: string,
  userId: string,
  authorId: string
): Promise<void> {
  const now = new Date().toISOString();
  const postKey = `POST#${postId}`;
  // Like entry under the post, plus index for user's liked posts
  await ddbClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: "ImageonApp",
            Item: {
              PK: postKey,
              SK: `LIKE#${userId}`,
              GSI1PK: `USER#${userId}`,
              GSI1SK: `LIKE#${now}#${postId}`,
              user_id: userId,
              post_id: postId,
              author_id: authorId,
              created_at: now,
              activity_id: `https://your-domain.com/likes/${postId}#${userId}`,
              activity_type: "Like",
            },
            ConditionExpression: "attribute_not_exists(PK)", // prevents double-like on exact same key if reused; adjust if needed. :contentReference[oaicite:4]{index=4}
          },
        },
        {
          Update: {
            TableName: "ImageonApp",
            Key: { PK: postKey, SK: "METADATA" },
            UpdateExpression: "ADD likes_count :inc",
            ExpressionAttributeValues: { ":inc": 1 },
          },
        },
      ],
    })
  );
}
