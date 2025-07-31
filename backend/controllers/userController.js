const userService = require("../services/userService");

/**
 * User Controller
 * Handles HTTP requests for user operations
 */
class UserController {
  /**
   * Create a new user
   * POST /api/users
   */
  async createUser(req, res) {
    try {
      const { username, email, display_name, bio } = req.body;

      // Basic validation
      if (!username || !email || !display_name) {
        return res.status(400).json({
          success: false,
          message: "Username, email, and display_name are required",
          errors: {
            username: !username ? "Username is required" : null,
            email: !email ? "Email is required" : null,
            display_name: !display_name ? "Display name is required" : null,
          },
        });
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }

      // Username format validation (alphanumeric, underscore, hyphen, 3-30 chars)
      const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
      if (!usernameRegex.test(username)) {
        return res.status(400).json({
          success: false,
          message:
            "Username must be 3-30 characters long and contain only letters, numbers, underscores, and hyphens",
        });
      }

      // Create user
      const user = await userService.createUser({
        username,
        email,
        display_name,
        bio,
      });

      // Return success response (exclude sensitive fields)
      const {
        user_id,
        username: createdUsername,
        display_name: createdDisplayName,
        email: createdEmail,
        bio: createdBio,
        created_at,
        is_verified,
        status,
      } = user;

      res.status(201).json({
        success: true,
        message: "User created successfully",
        data: {
          user_id,
          username: createdUsername,
          display_name: createdDisplayName,
          email: createdEmail,
          bio: createdBio,
          created_at,
          is_verified,
          status,
        },
      });
    } catch (error) {
      console.error("Error in createUser controller:", error);

      // Handle specific errors
      if (error.message.includes("already exists")) {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }

      // Generic error response
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  /**
   * Get user by ID
   * GET /api/users/:userId
   */
  async getUserById(req, res) {
    try {
      const { userId } = req.params;

      const user = await userService.getUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Return user data (exclude sensitive fields)
      const {
        user_id,
        username,
        display_name,
        email,
        bio,
        profile_image_url,
        created_at,
        followers_count,
        following_count,
        posts_count,
        is_verified,
        is_private,
        status,
      } = user;

      res.status(200).json({
        success: true,
        data: {
          user_id,
          username,
          display_name,
          email,
          bio,
          profile_image_url,
          created_at,
          followers_count,
          following_count,
          posts_count,
          is_verified,
          is_private,
          status,
        },
      });
    } catch (error) {
      console.error("Error in getUserById controller:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  /**
   * Get user by username
   * GET /api/users/username/:username
   */
  async getUserByUsername(req, res) {
    try {
      const { username } = req.params;

      const user = await userService.getUserByUsername(username);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Return user data (exclude sensitive fields)
      const {
        user_id,
        username: foundUsername,
        display_name,
        email,
        bio,
        profile_image_url,
        created_at,
        followers_count,
        following_count,
        posts_count,
        is_verified,
        is_private,
        status,
      } = user;

      res.status(200).json({
        success: true,
        data: {
          user_id,
          username: foundUsername,
          display_name,
          email,
          bio,
          profile_image_url,
          created_at,
          followers_count,
          following_count,
          posts_count,
          is_verified,
          is_private,
          status,
        },
      });
    } catch (error) {
      console.error("Error in getUserByUsername controller:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  /**
   * Get all users (with pagination)
   * GET /api/users
   */
  async getAllUsers(req, res) {
    try {
      const { limit = 20, lastEvaluatedKey } = req.query;

      const result = await userService.getAllUsers({
        limit: parseInt(limit),
        lastEvaluatedKey: lastEvaluatedKey
          ? JSON.parse(lastEvaluatedKey)
          : undefined,
      });

      // Filter out sensitive data
      const users = result.users.map((user) => {
        const {
          user_id,
          username,
          display_name,
          email,
          bio,
          profile_image_url,
          created_at,
          followers_count,
          following_count,
          posts_count,
          is_verified,
          is_private,
          status,
        } = user;
        return {
          user_id,
          username,
          display_name,
          email,
          bio,
          profile_image_url,
          created_at,
          followers_count,
          following_count,
          posts_count,
          is_verified,
          is_private,
          status,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          users,
          count: result.count,
          lastEvaluatedKey: result.lastEvaluatedKey,
        },
      });
    } catch (error) {
      console.error("Error in getAllUsers controller:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  /**
   * Update user profile
   * PUT /api/users/:userId
   */
  async updateUser(req, res) {
    try {
      const { userId } = req.params;
      const updates = req.body;

      // Remove fields that shouldn't be updated
      const { user_id, username, email, created_at, ...allowedUpdates } =
        updates;

      if (Object.keys(allowedUpdates).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid fields to update",
        });
      }

      const updatedUser = await userService.updateUser(userId, allowedUpdates);

      // Return updated user data (exclude sensitive fields)
      const {
        user_id: updatedUserId,
        username: updatedUsername,
        display_name,
        email: updatedEmail,
        bio,
        profile_image_url,
        created_at: userCreatedAt,
        updated_at,
        followers_count,
        following_count,
        posts_count,
        is_verified,
        is_private,
        status,
      } = updatedUser;

      res.status(200).json({
        success: true,
        message: "User updated successfully",
        data: {
          user_id: updatedUserId,
          username: updatedUsername,
          display_name,
          email: updatedEmail,
          bio,
          profile_image_url,
          created_at,
          updated_at,
          followers_count,
          following_count,
          posts_count,
          is_verified,
          is_private,
          status,
        },
      });
    } catch (error) {
      console.error("Error in updateUser controller:", error);

      if (error.message === "User not found") {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }

  /**
   * Delete user (soft delete)
   * DELETE /api/users/:userId
   */
  async deleteUser(req, res) {
    try {
      const { userId } = req.params;

      await userService.deleteUser(userId);

      res.status(200).json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      console.error("Error in deleteUser controller:", error);

      if (error.message === "User not found") {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
}

module.exports = new UserController();
