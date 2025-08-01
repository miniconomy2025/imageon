const { v4: uuidv4 } = require("uuid");
const { dynamoClient, TABLE_CONFIG } = require("../config/dynamodb");

// Like interface (for reference)
/**
 * @typedef {Object} Like
 * @property {string} post_id - ID of the post being liked (Primary Key - HASH)
 * @property {string} user_id - ID of the user who liked the post (Primary Key - RANGE)
 * @property {string} username - Username of the user who liked
 * @property {string} created_at - ISO timestamp
 * @property {string} [updated_at] - ISO timestamp
 * @property {string} status - Like status (active, removed)
 */

class LikeService {
  constructor() {
    this.tableName = TABLE_CONFIG.tables.likes;
  }

  /**
   * Create a new like
   * @param {Object} likeData - Like data
   * @param {string} likeData.post_id - Post ID being liked
   * @param {string} likeData.user_id - User ID who is liking
   * @param {string} likeData.username - Username of the user
   * @returns {Promise<Like>} Created like
   */
  async createLike(likeData) {
    try {
      const { post_id, user_id, username } = likeData;

      // Validate required fields
      if (!post_id || !user_id || !username) {
        throw new Error("Post ID, user ID, and username are required");
      }

      // Check if like already exists
      const existingLike = await this.getLikeByUserAndPost(user_id, post_id);
      if (existingLike) {
        throw new Error("User has already liked this post");
      }

      // Create like object
      const now = new Date().toISOString();
      const like = {
        post_id,
        user_id,
        username,
        created_at: now,
        updated_at: now,
        status: "active",
      };

      // Store in DynamoDB
      await dynamoClient
        .put({
          TableName: this.tableName,
          Item: like,
          ConditionExpression:
            "attribute_not_exists(post_id) AND attribute_not_exists(user_id)",
        })
        .promise();

      console.log(`Like created: ${username} liked post ${post_id}`);
      return like;
    } catch (error) {
      console.error("Error creating like:", error);
      throw error;
    }
  }

  /**
   * Get like by post and user
   * @param {string} postId - Post ID
   * @param {string} userId - User ID
   * @returns {Promise<Like|null>} Like object or null
   */
  async getLikeByPostAndUser(postId, userId) {
    try {
      const result = await dynamoClient
        .get({
          TableName: this.tableName,
          Key: {
            post_id: postId,
            user_id: userId,
          },
        })
        .promise();

      return result.Item || null;
    } catch (error) {
      console.error("Error getting like by post and user:", error);
      throw error;
    }
  }

  /**
   * Get like by user and post (alias for getLikeByPostAndUser)
   * @param {string} userId - User ID
   * @param {string} postId - Post ID
   * @returns {Promise<Like|null>} Like object or null
   */
  async getLikeByUserAndPost(userId, postId) {
    return this.getLikeByPostAndUser(postId, userId);
  }

  /**
   * Get likes by post ID
   * @param {string} postId - Post ID to get likes for
   * @param {Object} options - Query options
   * @param {number} [options.limit] - Number of likes to return
   * @param {string} [options.lastEvaluatedKey] - Pagination key
   * @returns {Promise<Object>} Likes and pagination info
   */
  async getLikesByPostId(postId, options = {}) {
    try {
      const { limit = 20, lastEvaluatedKey } = options;

      const params = {
        TableName: this.tableName,
        KeyConditionExpression: "post_id = :postId",
        ExpressionAttributeValues: {
          ":postId": postId,
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit,
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await dynamoClient.query(params).promise();

      return {
        likes: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Items ? result.Items.length : 0,
      };
    } catch (error) {
      console.error("Error getting likes by post ID:", error);
      throw error;
    }
  }

  /**
   * Get likes by user ID
   * @param {string} userId - User ID to get likes for
   * @param {Object} options - Query options
   * @param {number} [options.limit] - Number of likes to return
   * @param {string} [options.lastEvaluatedKey] - Pagination key
   * @returns {Promise<Object>} Likes and pagination info
   */
  async getLikesByUserId(userId, options = {}) {
    try {
      const { limit = 20, lastEvaluatedKey } = options;

      const params = {
        TableName: this.tableName,
        IndexName: "GSI1", // Use GSI1 which has user_id as hash key
        KeyConditionExpression: "user_id = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit,
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await dynamoClient.query(params).promise();

      return {
        likes: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Items ? result.Items.length : 0,
      };
    } catch (error) {
      console.error("Error getting likes by user ID:", error);
      throw error;
    }
  }

  /**
   * Delete a like
   * @param {string} postId - Post ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteLike(postId, userId) {
    try {
      await dynamoClient
        .delete({
          TableName: this.tableName,
          Key: {
            post_id: postId,
            user_id: userId,
          },
        })
        .promise();

      console.log(`Like deleted: user ${userId} unliked post ${postId}`);
      return true;
    } catch (error) {
      console.error("Error deleting like:", error);
      throw error;
    }
  }

  /**
   * Delete like by user and post
   * @param {string} userId - User ID
   * @param {string} postId - Post ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteLikeByUserAndPost(userId, postId) {
    return this.deleteLike(postId, userId);
  }

  /**
   * Check if user has liked a post
   * @param {string} userId - User ID
   * @param {string} postId - Post ID
   * @returns {Promise<boolean>} True if user has liked the post
   */
  async hasUserLikedPost(userId, postId) {
    try {
      const like = await this.getLikeByUserAndPost(userId, postId);
      return like !== null && like.status === "active";
    } catch (error) {
      console.error("Error checking if user liked post:", error);
      return false;
    }
  }

  /**
   * Get like count for a post
   * @param {string} postId - Post ID
   * @returns {Promise<number>} Number of likes
   */
  async getLikeCountForPost(postId) {
    try {
      const result = await this.getLikesByPostId(postId, { limit: 1000 });
      return result.count;
    } catch (error) {
      console.error("Error getting like count for post:", error);
      return 0;
    }
  }
}

module.exports = new LikeService();
