const { v4: uuidv4 } = require("uuid");
const { dynamoClient, TABLE_CONFIG } = require("../config/dynamodb");

// Follow interface (for reference)
/**
 * @typedef {Object} Follow
 * @property {string} follower_id - ID of the user who is following (Primary Key - HASH)
 * @property {string} followed_id - ID of the user being followed (Primary Key - RANGE)
 * @property {string} follower_username - Username of the follower
 * @property {string} followed_username - Username of the user being followed
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 * @property {string} status - Follow status (active, removed)
 */

class FollowService {
  constructor() {
    this.tableName = TABLE_CONFIG.tables.follows;
  }

  /**
   * Create a new follow relationship
   * @param {Object} followData - Follow data
   * @param {string} followData.follower_id - User ID who is following
   * @param {string} followData.followed_id - User ID being followed
   * @param {string} followData.follower_username - Username of the follower
   * @param {string} followData.followed_username - Username of the user being followed
   * @returns {Promise<Follow>} Created follow relationship
   */
  async createFollow(followData) {
    try {
      const { follower_id, followed_id, follower_username, followed_username } =
        followData;

      // Validate required fields
      if (
        !follower_id ||
        !followed_id ||
        !follower_username ||
        !followed_username
      ) {
        throw new Error("Follower ID, followed ID, and usernames are required");
      }

      // Prevent self-following
      if (follower_id === followed_id) {
        throw new Error("Users cannot follow themselves");
      }

      // Check if follow relationship already exists
      const existingFollow = await this.getFollowByFollowerAndFollowed(
        follower_id,
        followed_id
      );
      if (existingFollow) {
        throw new Error("User is already following this person");
      }

      // Create follow object
      const now = new Date().toISOString();
      const follow = {
        follower_id,
        followed_id,
        follower_username,
        followed_username,
        created_at: now,
        updated_at: now,
        status: "active",
      };

      // Store in DynamoDB
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

  /**
   * Get follow relationship by follower and followed
   * @param {string} followerId - Follower ID
   * @param {string} followedId - Followed ID
   * @returns {Promise<Follow|null>} Follow object or null
   */
  async getFollowByFollowerAndFollowed(followerId, followedId) {
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

      return result.Item || null;
    } catch (error) {
      console.error("Error getting follow by follower and followed:", error);
      throw error;
    }
  }

  /**
   * Get all users that a user is following
   * @param {string} followerId - Follower ID
   * @param {Object} options - Query options
   * @param {number} [options.limit] - Number of follows to return
   * @param {string} [options.lastEvaluatedKey] - Pagination key
   * @returns {Promise<Object>} Follows and pagination info
   */
  async getFollowingByUserId(followerId, options = {}) {
    try {
      const { limit = 20, lastEvaluatedKey } = options;

      const params = {
        TableName: this.tableName,
        KeyConditionExpression: "follower_id = :followerId",
        ExpressionAttributeValues: {
          ":followerId": followerId,
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit,
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await dynamoClient.query(params).promise();

      return {
        follows: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Items ? result.Items.length : 0,
      };
    } catch (error) {
      console.error("Error getting following by user ID:", error);
      throw error;
    }
  }

  /**
   * Get all users following a user
   * @param {string} followedId - Followed ID
   * @param {Object} options - Query options
   * @param {number} [options.limit] - Number of follows to return
   * @param {string} [options.lastEvaluatedKey] - Pagination key
   * @returns {Promise<Object>} Follows and pagination info
   */
  async getFollowersByUserId(followedId, options = {}) {
    try {
      const { limit = 20, lastEvaluatedKey } = options;

      const params = {
        TableName: this.tableName,
        IndexName: "GSI1", // Use GSI1 which has followed_id as hash key
        KeyConditionExpression: "followed_id = :followedId",
        ExpressionAttributeValues: {
          ":followedId": followedId,
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit,
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await dynamoClient.query(params).promise();

      return {
        follows: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Items ? result.Items.length : 0,
      };
    } catch (error) {
      console.error("Error getting followers by user ID:", error);
      throw error;
    }
  }

  /**
   * Delete a follow relationship
   * @param {string} followerId - Follower ID
   * @param {string} followedId - Followed ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteFollow(followerId, followedId) {
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

  /**
   * Check if user is following another user
   * @param {string} followerId - Follower ID
   * @param {string} followedId - Followed ID
   * @returns {Promise<boolean>} True if user is following
   */
  async isUserFollowing(followerId, followedId) {
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

  /**
   * Get follow count for a user (how many they are following)
   * @param {string} followerId - Follower ID
   * @returns {Promise<number>} Number of users being followed
   */
  async getFollowingCount(followerId) {
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

  /**
   * Get follower count for a user (how many are following them)
   * @param {string} followedId - Followed ID
   * @returns {Promise<number>} Number of followers
   */
  async getFollowersCount(followedId) {
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

  /**
   * Get mutual follows (users who follow each other)
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @param {number} [options.limit] - Number of mutual follows to return
   * @returns {Promise<Object>} Mutual follows and count
   */
  async getMutualFollows(userId, options = {}) {
    try {
      const { limit = 20 } = options;

      // Get users that this user is following
      const followingResult = await this.getFollowingByUserId(userId, {
        limit: 1000,
      });
      const followingIds = followingResult.follows.map(
        (follow) => follow.followed_id
      );

      // Get users following this user
      const followersResult = await this.getFollowersByUserId(userId, {
        limit: 1000,
      });
      const followerIds = followersResult.follows.map(
        (follow) => follow.follower_id
      );

      // Find mutual follows
      const mutualIds = followingIds.filter((id) => followerIds.includes(id));
      const mutualFollows = followingResult.follows
        .filter((follow) => mutualIds.includes(follow.followed_id))
        .slice(0, limit);

      return {
        follows: mutualFollows,
        count: mutualFollows.length,
      };
    } catch (error) {
      console.error("Error getting mutual follows:", error);
      throw error;
    }
  }
}

module.exports = new FollowService();
