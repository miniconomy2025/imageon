import { CreateFollowInput, Follow } from "../models/followModels";
import { PaginatedResult, PaginationOptions } from "../models/paginationModels";
import { docClient } from "./database";
import { config } from "../config/index.js";
import {
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

class FollowService {
  private readonly tableName: string;

  constructor() {
    // Use the single table defined in our configuration instead of the old
    // per‑entity tables. The DatabaseService encapsulates the DynamoDB client
    // and table configuration. Here we pull the table name directly from
    // config so that all follow records reside in the unified ImageonApp table.
    this.tableName = config.dynamodb.tableName;
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

      // Check if a follow relationship already exists between these users. We
      // construct the composite key based on our single-table design: the
      // primary key (PK) is the follower’s ID and the sort key (SK) is a
      // prefixed string containing the followed user’s ID. This allows us to
      // efficiently query all followings for a user by prefix.
      const existingFollow = await this.getFollowByFollowerAndFollowed(
        follower_id,
        followed_id
      );
      if (existingFollow) {
        throw new Error("User is already following this person");
      }

      const now = new Date().toISOString();
      // Compose the item to insert into the single table. We store the
      // relationship twice in the key schema: PK/SK for direct lookup,
      // and GSI1PK/GSI1SK for follower lookup by followed user. The
      // `SK` is prefixed with "FOLLOWING#" so we can filter follow
      // relationships when querying by PK. The GSI1 fields are prefixed
      // with "FOLLOWER#" to enable filtering followers by followed ID.
      const item = {
        PK: follower_id,
        SK: `FOLLOWING#${followed_id}`,
        GSI1PK: followed_id,
        GSI1SK: `FOLLOWER#${follower_id}`,
        follower_id,
        followed_id,
        follower_username,
        followed_username,
        created_at: now,
        updated_at: now,
        status: "active",
      };

      // Perform a conditional put to avoid duplicate follow entries. If the
      // primary key & sort key combination already exists, the condition
      // fails and no new record is inserted.
      await docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
        })
      );

      // Increment counts on the user profiles. We update the follower’s
      // following_count and the followed user’s followers_count. If these
      // attributes don’t exist yet, initialise them to zero. User records
      // reside in the same table with PK equal to the user_id and SK
      // equal to 'USER'.
      await Promise.all([
        docClient.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { PK: follower_id, SK: "USER" },
            UpdateExpression:
              "SET following_count = if_not_exists(following_count, :zero) + :inc, updated_at = :updated",
            ExpressionAttributeValues: {
              ":inc": 1,
              ":zero": 0,
              ":updated": now,
            },
          })
        ),
        docClient.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { PK: followed_id, SK: "USER" },
            UpdateExpression:
              "SET followers_count = if_not_exists(followers_count, :zero) + :inc, updated_at = :updated",
            ExpressionAttributeValues: {
              ":inc": 1,
              ":zero": 0,
              ":updated": now,
            },
          })
        ),
      ]);

      console.log(
        `Follow created: ${follower_username} followed ${followed_username}`
      );
      // Return only the follow fields without the PK/SK metadata to keep
      // consistency with the Follow interface.
      return {
        follower_id,
        followed_id,
        follower_username,
        followed_username,
        created_at: now,
        updated_at: now,
        status: "active",
      };
    } catch (error) {
      console.error("Error creating follow:", error);
      throw error;
    }
  }

  async getFollowByFollowerAndFollowed(followerId: string, followedId: string): Promise<Follow|null> {
    try {
      const result = await docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: followerId,
            SK: `FOLLOWING#${followedId}`,
          },
        })
      );
      if (!result.Item) {
        return null;
      }
      const item: any = result.Item;
      return {
        follower_id: item.follower_id,
        followed_id: item.followed_id,
        follower_username: item.follower_username,
        followed_username: item.followed_username,
        created_at: item.created_at,
        updated_at: item.updated_at,
        status: item.status,
      };
    } catch (error) {
      console.error("Error getting follow by follower and followed:", error);
      throw error;
    }
  }

  async getFollowingByUserId(followerId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Follow>> {
    try {
      const { limit = 20, lastEvaluatedKey } = options;
      const queryParams: any = {
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": followerId,
          ":skPrefix": "FOLLOWING#",
        },
        ScanIndexForward: false,
        Limit: limit,
      };
      if (lastEvaluatedKey) {
        queryParams.ExclusiveStartKey = lastEvaluatedKey;
      }
      const result = await docClient.send(new QueryCommand(queryParams));
      const items = (result.Items || []).map((item: any) => ({
        follower_id: item.follower_id,
        followed_id: item.followed_id,
        follower_username: item.follower_username,
        followed_username: item.followed_username,
        created_at: item.created_at,
        updated_at: item.updated_at,
        status: item.status,
      }));
      return {
        items: items as Follow[],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: items.length,
      };
    } catch (error) {
      console.error("Error getting following by user ID:", error);
      throw error;
    }
  }

  async getFollowersByUserId(followedId: string, options: PaginationOptions = {}): Promise<PaginatedResult<Follow>> {
    try {
      const { limit = 20, lastEvaluatedKey } = options;
      const queryParams: any = {
        TableName: this.tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": followedId,
          ":skPrefix": "FOLLOWER#",
        },
        ScanIndexForward: false,
        Limit: limit,
      };
      if (lastEvaluatedKey) {
        queryParams.ExclusiveStartKey = lastEvaluatedKey;
      }
      const result = await docClient.send(new QueryCommand(queryParams));
      const items = (result.Items || []).map((item: any) => ({
        follower_id: item.follower_id,
        followed_id: item.followed_id,
        follower_username: item.follower_username,
        followed_username: item.followed_username,
        created_at: item.created_at,
        updated_at: item.updated_at,
        status: item.status,
      }));
      return {
        items: items as Follow[],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: items.length,
      };
    } catch (error) {
      console.error("Error getting followers by user ID:", error);
      throw error;
    }
  }

  async deleteFollow(followerId: string, followedId: string): Promise<boolean> {
    try {
      // Delete the follow relationship using the composite PK/SK design.
      await docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            PK: followerId,
            SK: `FOLLOWING#${followedId}`,
          },
        })
      );
      const now = new Date().toISOString();
      // Decrement counts on both user profiles. Ensure we don't reduce
      // counts below zero by using if_not_exists.
      await Promise.all([
        docClient.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { PK: followerId, SK: "USER" },
            UpdateExpression:
              "SET following_count = if_not_exists(following_count, :zero) - :dec, updated_at = :updated",
            ExpressionAttributeValues: {
              ":dec": 1,
              ":zero": 0,
              ":updated": now,
            },
          })
        ),
        docClient.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { PK: followedId, SK: "USER" },
            UpdateExpression:
              "SET followers_count = if_not_exists(followers_count, :zero) - :dec, updated_at = :updated",
            ExpressionAttributeValues: {
              ":dec": 1,
              ":zero": 0,
              ":updated": now,
            },
          })
        ),
      ]);
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