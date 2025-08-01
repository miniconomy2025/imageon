const { v4: uuidv4 } = require("uuid");
const { dynamoClient, TABLE_CONFIG } = require("../config/dynamodb");

// Post interface (for reference)
/**
 * @typedef {Object} Post
 * @property {string} post_id - Unique post identifier (Primary Key)
 * @property {string} author_id - ID of the user who created the post (Sort Key)
 * @property {string} user_id - ID of the user who created the post (for compatibility)
 * @property {string} username - Username of the post creator
 * @property {string} content - Post content/text
 * @property {string} [media_url] - URL to attached media
 * @property {string} [media_type] - Type of media (image, video, etc.)
 * @property {string} created_at - ISO timestamp
 * @property {string} updated_at - ISO timestamp
 * @property {number} likes_count - Number of likes
 * @property {number} comments_count - Number of comments
 * @property {number} shares_count - Number of shares
 * @property {boolean} is_public - Whether post is public
 * @property {string} status - Post status (active, deleted, hidden)
 * @property {string[]} [tags] - Array of tags
 * @property {string} [location] - Location where post was created
 */

class PostService {
  constructor() {
    this.tableName = TABLE_CONFIG.tables.posts;
  }

  /**
   * Create a new post
   * @param {Object} postData - Post data
   * @param {string} postData.user_id - User ID of the post creator
   * @param {string} postData.username - Username of the post creator
   * @param {string} postData.content - Post content
   * @param {string} [postData.media_url] - URL to attached media
   * @param {string} [postData.media_type] - Type of media
   * @param {string[]} [postData.tags] - Array of tags
   * @param {string} [postData.location] - Location
   * @returns {Promise<Post>} Created post
   */
  async createPost(postData) {
    try {
      const {
        user_id,
        username,
        content,
        media_url,
        media_type,
        tags,
        location,
      } = postData;

      // Validate required fields
      if (!user_id || !username || !content) {
        throw new Error("User ID, username, and content are required");
      }

      // Create post object
      const now = new Date().toISOString();
      const post = {
        post_id: uuidv4(),
        author_id: user_id, // Use author_id as sort key
        user_id,
        username,
        content,
        media_url: media_url || null,
        media_type: media_type || null,
        created_at: now,
        updated_at: now,
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        is_public: true,
        status: "active",
        tags: tags || [],
        location: location || null,
      };

      // Store in DynamoDB
      await dynamoClient
        .put({
          TableName: this.tableName,
          Item: post,
          ConditionExpression: "attribute_not_exists(post_id)",
        })
        .promise();

      console.log(`Post created: ${post.post_id} by ${username}`);
      return post;
    } catch (error) {
      console.error("Error creating post:", error);
      throw error;
    }
  }

  /**
   * Get post by ID
   * @param {string} postId - Post ID to retrieve
   * @returns {Promise<Post|null>} Post object or null
   */
  async getPostById(postId) {
    try {
      const result = await dynamoClient
        .query({
          TableName: this.tableName,
          KeyConditionExpression: "post_id = :postId",
          ExpressionAttributeValues: {
            ":postId": postId,
          },
        })
        .promise();

      return result.Items.length > 0 ? result.Items[0] : null;
    } catch (error) {
      console.error("Error getting post by ID:", error);
      throw error;
    }
  }

  /**
   * Get posts by user ID
   * @param {string} userId - User ID to get posts for
   * @param {Object} options - Query options
   * @param {number} [options.limit] - Number of posts to return
   * @param {string} [options.lastEvaluatedKey] - Pagination key
   * @returns {Promise<Object>} Posts and pagination info
   */
  async getPostsByUserId(userId, options = {}) {
    try {
      const { limit = 20, lastEvaluatedKey } = options;

      const params = {
        TableName: this.tableName,
        IndexName: "GSI2", // Use GSI2 which has author_id as hash key
        KeyConditionExpression: "author_id = :userId",
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
        posts: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Items ? result.Items.length : 0,
      };
    } catch (error) {
      console.error("Error getting posts by user ID:", error);
      throw error;
    }
  }

  /**
   * Get all posts (feed)
   * @param {Object} options - Query options
   * @param {number} [options.limit] - Number of posts to return
   * @param {string} [options.lastEvaluatedKey] - Pagination key
   * @returns {Promise<Object>} Posts and pagination info
   */
  async getAllPosts(options = {}) {
    try {
      const { limit = 20, lastEvaluatedKey } = options;

      const params = {
        TableName: this.tableName,
        ScanIndexForward: false, // Most recent first
        Limit: limit,
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await dynamoClient.scan(params).promise();

      return {
        posts: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Items ? result.Items.length : 0,
      };
    } catch (error) {
      console.error("Error getting all posts:", error);
      throw error;
    }
  }

  /**
   * Update a post
   * @param {string} postId - Post ID to update
   * @param {Object} updates - Fields to update
   * @returns {Promise<Post>} Updated post
   */
  async updatePost(postId, updates) {
    try {
      // Get existing post
      const existingPost = await this.getPostById(postId);
      if (!existingPost) {
        throw new Error("Post not found");
      }

      // Prepare update expression
      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      // Add fields to update
      Object.keys(updates).forEach((key) => {
        if (key !== "post_id" && key !== "user_id" && key !== "created_at") {
          updateExpression.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = updates[key];
        }
      });

      // Always update the updated_at timestamp
      updateExpression.push("#updated_at = :updated_at");
      expressionAttributeNames["#updated_at"] = "updated_at";
      expressionAttributeValues[":updated_at"] = new Date().toISOString();

      const params = {
        TableName: this.tableName,
        Key: {
          post_id: postId,
          author_id: existingPost.author_id,
        },
        UpdateExpression: `SET ${updateExpression.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      };

      const result = await dynamoClient.update(params).promise();
      console.log(`Post updated: ${postId}`);
      return result.Attributes;
    } catch (error) {
      console.error("Error updating post:", error);
      throw error;
    }
  }

  /**
   * Delete a post
   * @param {string} postId - Post ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deletePost(postId) {
    try {
      // Get existing post to get user_id
      const existingPost = await this.getPostById(postId);
      if (!existingPost) {
        throw new Error("Post not found");
      }

      await dynamoClient
        .delete({
          TableName: this.tableName,
          Key: {
            post_id: postId,
            author_id: existingPost.author_id,
          },
        })
        .promise();

      console.log(`Post deleted: ${postId}`);
      return true;
    } catch (error) {
      console.error("Error deleting post:", error);
      throw error;
    }
  }

  /**
   * Like a post
   * @param {string} postId - Post ID to like
   * @param {string} userId - User ID who is liking
   * @returns {Promise<Post>} Updated post
   */
  async likePost(postId, userId) {
    try {
      const existingPost = await this.getPostById(postId);
      if (!existingPost) {
        throw new Error("Post not found");
      }

      const params = {
        TableName: this.tableName,
        Key: {
          post_id: postId,
          author_id: existingPost.author_id,
        },
        UpdateExpression: "SET likes_count = likes_count + :inc",
        ExpressionAttributeValues: {
          ":inc": 1,
        },
        ReturnValues: "ALL_NEW",
      };

      const result = await dynamoClient.update(params).promise();
      console.log(`Post liked: ${postId} by user ${userId}`);
      return result.Attributes;
    } catch (error) {
      console.error("Error liking post:", error);
      throw error;
    }
  }

  /**
   * Unlike a post
   * @param {string} postId - Post ID to unlike
   * @param {string} userId - User ID who is unliking
   * @returns {Promise<Post>} Updated post
   */
  async unlikePost(postId, userId) {
    try {
      const existingPost = await this.getPostById(postId);
      if (!existingPost) {
        throw new Error("Post not found");
      }

      const params = {
        TableName: this.tableName,
        Key: {
          post_id: postId,
          author_id: existingPost.author_id,
        },
        UpdateExpression: "SET likes_count = likes_count - :dec",
        ExpressionAttributeValues: {
          ":dec": 1,
        },
        ReturnValues: "ALL_NEW",
      };

      const result = await dynamoClient.update(params).promise();
      console.log(`Post unliked: ${postId} by user ${userId}`);
      return result.Attributes;
    } catch (error) {
      console.error("Error unliking post:", error);
      throw error;
    }
  }
}

module.exports = new PostService();
