import { CreateFollowInput, Follow } from "../models/followModels";
import { PaginatedResult, PaginationOptions } from "../models/paginationModels";
import { v4 as uuidv4 } from "uuid";
import { TABLE_CONFIG, dynamoClient } from "../config/dynamodb";

class FollowService {
  private readonly tableName: string;

  constructor() {
    this.tableName = TABLE_CONFIG.tables.follows;
  }

  async createFollow(followData: CreateFollowInput): Promise<Follow> {
    try {
      const { follower_id, followed_id, follower_username, followed_username } =
        followData;

      if (
        !follower_id || !follower_username
      ) {
        throw new Error("Follower ID, followed ID, and usernames are required");
      }

      if (follower_id === followed_id) {
        throw new Error("Users cannot follow themselves");
      }

      const existingFollow = await this.getFollowByFollowerAndFollowed(
        follower_id,
        followed_id
      );
      if (existingFollow) {
        throw new Error("User is already following this person");
      }

      const now = new Date().toISOString();
      const follow: Follow = {
        follower_id,
        followed_id,
        follower_username,
        followed_username,
        created_at: now,
        updated_at: now,
        status: "active",
      };

      await dynamoClient
        .put({
          TableName: this.tableName,
          Item: follow,
          ConditionExpression:
            "attribute_not_exists(follower_id) AND attribute_not_exists(followed_id)",
        })
        .promise();

      console.log(
        `Follow created: ${follower_username} followed ${followed_username}`
      );
      return follow;
    } catch (error) {
      console.error("Error creating follow:", error);
      throw error;
    }
  }

  async getFollowByFollowerAndFollowed(followerId: string, followedId: string): Promise<Follow|null> {
    try {
      const result = await dynamoClient
        .get({
          TableName: this.tableName,
          Key: {
            follower_id: followerId,
            followed_id: followedId,
          },
        })
        .promise();

      if (!result.Item) {
        return null;
      }

      return result.Item as Follow;
    } catch (error) {
      console.error("Error getting follow by follower and followed:", error);
      throw error;
    }
  }

  async getFollowingByUserId(followerId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Follow>> {
    try {
      const { limit = 20, lastEvaluatedKey } = options;

      let params = {
        TableName: this.tableName,
        KeyConditionExpression: "follower_id = :followerId",
        ExpressionAttributeValues: {
          ":followerId": followerId,
        },
        ScanIndexForward: false, 
        Limit: limit,
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      };

      const result = await dynamoClient.query(params).promise();
      const validatedItems = result.Items ?? [];

      return {
        items: validatedItems as Follow[],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Items ? result.Items.length : 0,
      };
    } catch (error) {
      console.error("Error getting following by user ID:", error);
      throw error;
    }
  }

  async getFollowersByUserId(followedId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Follow>> {
    try {
      const { limit = 20, lastEvaluatedKey } = options;

      const params = {
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "followed_id = :followedId",
        ExpressionAttributeValues: {
          ":followedId": followedId,
        },
        ScanIndexForward: false,
        Limit: limit,
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await dynamoClient.query(params).promise();
      const validatedItems = result.Items ?? [];

      return {
        items: result.Items as Follow[],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Items ? result.Items.length : 0,
      };
    } catch (error) {
      console.error("Error getting followers by user ID:", error);
      throw error;
    }
  }

  async deleteFollow(followerId: string, followedId: string): Promise<boolean> {
    try {
      await dynamoClient
        .delete({
          TableName: this.tableName,
          Key: {
            follower_id: followerId,
            followed_id: followedId,
          },
        })
        .promise();

      console.log(
        `Follow deleted: user ${followerId} unfollowed user ${followedId}`
      );
      return true;
    } catch (error) {
      console.error("Error deleting follow:", error);
      throw error;
    }
  }

  async isUserFollowing(followerId: string, followedId: string): Promise<boolean> {
    try {
      const follow = await this.getFollowByFollowerAndFollowed(
        followerId,
        followedId
      );
      return follow !== null && follow.status === "active";
    } catch (error) {
      console.error("Error checking if user is following:", error);
      return false;
    }
  }

  async getFollowingCount(followerId: string): Promise<number> {
    try {
      const result = await this.getFollowingByUserId(followerId, {
        limit: 1000,
      });
      return result.count;
    } catch (error) {
      console.error("Error getting following count:", error);
      return 0;
    }
  }

  async getFollowersCount(followedId: string): Promise<number> {
    try {
      const result = await this.getFollowersByUserId(followedId, {
        limit: 1000,
      });
      return result.count;
    } catch (error) {
      console.error("Error getting followers count:", error);
      return 0;
    }
  }

  async getMutualFollows(userId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Follow>> {
    try {
      const { limit = 20 } = options;

      const followingResult = await this.getFollowingByUserId(userId, {
        limit: 1000,
      });
      const followingIds = followingResult.items.map(
        (follow) => follow.followed_id
      );

      const followersResult = await this.getFollowersByUserId(userId, {
        limit: 1000,
      });
      const followerIds = followersResult.items.map(
        (follow) => follow.follower_id
      );

      const mutualIds = followingIds.filter((id) => followerIds.includes(id));
      const mutualFollows = followingResult.items
        .filter((follow) => mutualIds.includes(follow.followed_id))
        .slice(0, limit);

      return {
        items: mutualFollows,
        count: mutualFollows.length,
      };
    } catch (error) {
      console.error("Error getting mutual follows:", error);
      throw error;
    }
  }
}

export const followService = new FollowService();