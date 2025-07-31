// src/services/userService.ts

import { ddbClient } from "../config/dynamodb";
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

export interface UserProfile {
  userId: string;
  username: string;
  email: string;
  displayName?: string;
  bio?: string;
  profileImageUrl?: string;
  createdAt: string;
  updatedAt: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isVerified: boolean;
  isPrivate: boolean;
  status: string;
  actorType: "Person" | "Group";
  publicKey?: string;
  inboxUrl?: string;
  outboxUrl?: string;
  followersUrl?: string;
  followingUrl?: string;
  preferredUsername?: string;
  domain?: string | null;
}

export interface PostItem {
  postId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  likesCount: number;
  engagementScore: number;
}

/**
 * Fetch a user profile by ID.
 */
export async function getUserProfile(
  userId: string
): Promise<UserProfile | null> {
  const { Item } = await ddbClient.send(
    new GetCommand({
      TableName: "ImageonApp",
      Key: { PK: `USER#${userId}`, SK: "PROFILE" },
    })
  );

  return Item as UserProfile | null;
}

/**
 * Create a new user profile.
 */
export async function createUserProfile(profile: {
  userId: string;
  username: string;
  email: string;
  displayName?: string;
  bio?: string;
  profileImageUrl?: string;
  actorType?: "Person" | "Group";
  domain?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  await ddbClient.send(
    new PutCommand({
      TableName: "ImageonApp",
      Item: {
        PK: `USER#${profile.userId}`,
        SK: "PROFILE",
        GSI1PK: `USER#${profile.userId}`,
        GSI1SK: "PROFILE",
        username: profile.username,
        email: profile.email,
        display_name: profile.displayName,
        bio: profile.bio,
        profile_image_url: profile.profileImageUrl,
        created_at: now,
        updated_at: now,
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        is_verified: false,
        is_private: false,
        status: "active",
        actor_type: profile.actorType ?? "Person",
        domain: profile.domain ?? null,
      },
    })
  );
}

/**
 * Update existing profile fields.
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<{
    displayName: string;
    bio: string;
    profileImageUrl: string;
    isPrivate: boolean;
    status: string;
  }>
): Promise<void> {
  const expr: string[] = [];
  const values: Record<string, any> = {};
  for (const [key, val] of Object.entries(updates)) {
    const attrName = key === "displayName" ? "display_name" : key;
    expr.push(`#${attrName} = :${attrName}`);
    values[`:${attrName}`] = val;
  }
  // Always update updated_at
  expr.push(`#updated_at = :updated_at`);
  values[":updated_at"] = new Date().toISOString();

  const exprNames = Object.keys(values).reduce((acc, v) => {
    const name = v.slice(1);
    acc[`#${name}`] = name;
    return acc;
  }, {} as Record<string, string>);

  await ddbClient.send(
    new UpdateCommand({
      TableName: "ImageonApp",
      Key: { PK: `USER#${userId}`, SK: "PROFILE" },
      UpdateExpression: `SET ${expr.join(", ")}`,
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: values,
    })
  );
}

/**
 * List a user’s posts (most recent first).
 */
export async function getUserPosts(
  userId: string,
  limit = 20,
  lastEvaluatedKey?: Record<string, any>
): Promise<{ items: PostItem[]; lastKey?: Record<string, any> }> {
  const resp = await ddbClient.send(
    new QueryCommand({
      TableName: "ImageonApp",
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":sk": "POST#",
      },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
    })
  );

  const items = (resp.Items ?? []) as PostItem[];
  return { items, lastKey: resp.LastEvaluatedKey };
}

/**
 * Get followers or following list.
 */
export async function getUserFollowers(
  userId: string,
  limit = 100,
  lastKey?: Record<string, any>
) {
  const resp = await ddbClient.send(
    new QueryCommand({
      TableName: "ImageonApp",
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":sk": "FOLLOWER#",
      },
      Limit: limit,
      ExclusiveStartKey: lastKey,
    })
  );
  return { items: resp.Items, lastKey: resp.LastEvaluatedKey };
}

export async function getUserFollowing(
  userId: string,
  limit = 100,
  lastKey?: Record<string, any>
) {
  const resp = await ddbClient.send(
    new QueryCommand({
      TableName: "ImageonApp",
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":sk": "FOLLOWING#",
      },
      Limit: limit,
      ExclusiveStartKey: lastKey,
    })
  );
  return { items: resp.Items, lastKey: resp.LastEvaluatedKey };
}

/**
 * Follow another user (atomic).
 */
export async function followUser(
  followerId: string,
  followedId: string
): Promise<void> {
  const now = new Date().toISOString();
  await ddbClient.send(
    new TransactWriteCommand({
      TransactItems: [
        // Create following record
        {
          Put: {
            TableName: "ImageonApp",
            Item: {
              PK: `USER#${followerId}`,
              SK: `FOLLOWING#${followedId}`,
              GSI1PK: `USER#${followedId}`,
              GSI1SK: `FOLLOWER#${followerId}`,
              follower_id: followerId,
              followed_id: followedId,
              created_at: now,
              status: "active",
            },
          },
        },
        // Increment following_count
        {
          Update: {
            TableName: "ImageonApp",
            Key: { PK: `USER#${followerId}`, SK: "PROFILE" },
            UpdateExpression: "ADD following_count :inc",
            ExpressionAttributeValues: { ":inc": 1 },
          },
        },
        // Increment followers_count
        {
          Update: {
            TableName: "ImageonApp",
            Key: { PK: `USER#${followedId}`, SK: "PROFILE" },
            UpdateExpression: "ADD followers_count :inc",
            ExpressionAttributeValues: { ":inc": 1 },
          },
        },
      ],
    })
  );
}

/**
 * Unfollow a user (atomic).
 */
export async function unfollowUser(
  followerId: string,
  followedId: string
): Promise<void> {
  await ddbClient.send(
    new TransactWriteCommand({
      TransactItems: [
        // Delete following record
        {
          Delete: {
            TableName: "ImageonApp",
            Key: {
              PK: `USER#${followerId}`,
              SK: `FOLLOWING#${followedId}`,
            },
          },
        },
        // Decrement following_count
        {
          Update: {
            TableName: "ImageonApp",
            Key: { PK: `USER#${followerId}`, SK: "PROFILE" },
            UpdateExpression: "ADD following_count :dec",
            ExpressionAttributeValues: { ":dec": -1 },
          },
        },
        // Decrement followers_count
        {
          Update: {
            TableName: "ImageonApp",
            Key: { PK: `USER#${followedId}`, SK: "PROFILE" },
            UpdateExpression: "ADD followers_count :dec",
            ExpressionAttributeValues: { ":dec": -1 },
          },
        },
      ],
    })
  );
}
