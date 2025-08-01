const { v4: uuidv4 } = require("uuid");
const { dynamoClient, TABLE_CONFIG } = require("../config/dynamodb");

// User interface (for reference)
/**
 * @typedef {Object} User
 * @property {string} user_id - Unique user identifier
 * @property {string} username - Unique username
 * @property {string} email - User email address
 * @property {string} display_name - User's display name
 * @property {string} [bio] - User bio/description
 * @property {string} [profile_image_url] - Profile image URL
 * @property {string} created_at - ISO timestamp
 * @property {string} updated_at - ISO timestamp
 * @property {number} followers_count - Number of followers
 * @property {number} following_count - Number of users following
 * @property {number} posts_count - Number of posts
 * @property {boolean} is_verified - Whether user is verified
 * @property {boolean} is_private - Whether profile is private
 * @property {string} status - User status (active, suspended, deleted)
 */

class UserService {
  constructor() {
    this.tableName = TABLE_CONFIG.tables.users;
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @param {string} userData.username - Unique username
   * @param {string} userData.email - User email
   * @param {string} userData.display_name - Display name
   * @param {string} [userData.bio] - User bio
   * @returns {Promise<User>} Created user
   */
  async createUser(userData) {
    try {
      const { username, email, display_name, bio } = userData;

      // Validate required fields
      if (!username || !email || !display_name) {
        throw new Error("Username, email, and display_name are required");
      }

      // Check if username already exists
      const existingUser = await this.getUserByUsername(username);
      if (existingUser) {
        throw new Error("Username already exists");
      }

      // Check if email already exists
      const existingEmail = await this.getUserByEmail(email);
      if (existingEmail) {
        throw new Error("Email already exists");
      }

      // Create user object
      const now = new Date().toISOString();
      const user = {
        user_id: uuidv4(),
        username,
        email,
        display_name,
        bio: bio || "",
        profile_image_url: null,
        created_at: now,
        updated_at: now,
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        is_verified: false,
        is_private: false,
        status: "active",
      };

      // Store in DynamoDB
      await dynamoClient
        .put({
          TableName: this.tableName,
          Item: user,
          ConditionExpression: "attribute_not_exists(user_id)",
        })
        .promise();

      console.log(`User created: ${user.user_id} (${username})`);
      return user;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  /**
   * Get user by username using GSI1
   * @param {string} username - Username to search for
   * @returns {Promise<User|null>} User object or null
   */
  async getUserByUsername(username) {
    try {
      const result = await dynamoClient
        .query({
          TableName: this.tableName,
          IndexName: "GSI1",
          KeyConditionExpression: "username = :username",
          ExpressionAttributeValues: {
            ":username": username,
          },
          Limit: 1,
        })
        .promise();

      return result.Items && result.Items.length > 0 ? result.Items[0] : null;
    } catch (error) {
      console.error("Error getting user by username:", error);
      throw error;
    }
  }

  /**
   * Get user by email using GSI2
   * @param {string} email - Email to search for
   * @returns {Promise<User|null>} User object or null
   */
  async getUserByEmail(email) {
    try {
      const result = await dynamoClient
        .query({
          TableName: this.tableName,
          IndexName: "GSI2",
          KeyConditionExpression: "email = :email",
          ExpressionAttributeValues: {
            ":email": email,
          },
          Limit: 1,
        })
        .promise();

      return result.Items && result.Items.length > 0 ? result.Items[0] : null;
    } catch (error) {
      console.error("Error getting user by email:", error);
      throw error;
    }
  }

  /**
   * Get user by user_id
   * @param {string} userId - User ID
   * @returns {Promise<User|null>} User object or null
   */
  async getUserById(userId) {
    try {
      const result = await dynamoClient
        .query({
          TableName: this.tableName,
          KeyConditionExpression: "user_id = :userId",
          ExpressionAttributeValues: {
            ":userId": userId,
          },
          Limit: 1,
        })
        .promise();

      return result.Items && result.Items.length > 0 ? result.Items[0] : null;
    } catch (error) {
      console.error("Error getting user by ID:", error);
      throw error;
    }
  }

  /**
   * Get all users (with pagination)
   * @param {Object} options - Query options
   * @param {number} [options.limit=20] - Number of users to return
   * @param {string} [options.lastEvaluatedKey] - Pagination token
   * @returns {Promise<Object>} Users and pagination info
   */
  async getAllUsers(options = {}) {
    try {
      const { limit = 20, lastEvaluatedKey } = options;

      const params = {
        TableName: this.tableName,
        Limit: limit,
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await dynamoClient.scan(params).promise();

      return {
        users: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count,
      };
    } catch (error) {
      console.error("Error getting all users:", error);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<User>} Updated user
   */
  async updateUser(userId, updates) {
    try {
      // Get current user
      const currentUser = await this.getUserById(userId);
      if (!currentUser) {
        throw new Error("User not found");
      }

      // Prepare update expression
      const updateExpression = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = {};

      // Add fields to update
      Object.keys(updates).forEach((key) => {
        if (key !== "user_id" && key !== "username" && key !== "email") {
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
          user_id: userId,
          username: currentUser.username,
        },
        UpdateExpression: `SET ${updateExpression.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW",
      };

      const result = await dynamoClient.update(params).promise();
      console.log(`User updated: ${userId}`);
      return result.Attributes;
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  }

  /**
   * Delete user (soft delete by setting status to 'deleted')
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteUser(userId) {
    try {
      // Get current user to get username
      const currentUser = await this.getUserById(userId);
      if (!currentUser) {
        throw new Error("User not found");
      }

      const params = {
        TableName: this.tableName,
        Key: {
          user_id: userId,
          username: currentUser.username,
        },
        UpdateExpression: "SET #status = :status, #updated_at = :updated_at",
        ExpressionAttributeNames: {
          "#status": "status",
          "#updated_at": "updated_at",
        },
        ExpressionAttributeValues: {
          ":status": "deleted",
          ":updated_at": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      };

      await dynamoClient.update(params).promise();
      console.log(`User deleted: ${userId}`);
      return true;
    } catch (error) {
      console.error("Error deleting user:", error);
      throw error;
    }
  }
}

module.exports = new UserService();
