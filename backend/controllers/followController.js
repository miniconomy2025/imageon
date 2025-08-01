const followService = require("../services/followService");

class FollowController {
  /**
   * Create a new follow relationship
   * POST /api/follows
   */
  async createFollow(req, res) {
    try {
      const followData = req.body;

      // Validate required fields
      if (!followData.follower_id || !followData.followed_id || 
          !followData.follower_username || !followData.followed_username) {
        return res.status(400).json({
          success: false,
          message: "Follower ID, followed ID, and usernames are required",
        });
      }

      const follow = await followService.createFollow(followData);

      res.status(201).json({
        success: true,
        message: "Follow relationship created successfully",
        data: follow,
      });
    } catch (error) {
      console.error("Error in createFollow controller:", error);
      res.status(500).json({
        success: false,
        message: "Error creating follow relationship",
        error: error.message,
      });
    }
  }

  /**
   * Get follow relationship by follower and followed
   * GET /api/follows/follower/:followerId/followed/:followedId
   */
  async getFollowByFollowerAndFollowed(req, res) {
    try {
      const { followerId, followedId } = req.params;

      if (!followerId || !followedId) {
        return res.status(400).json({
          success: false,
          message: "Follower ID and Followed ID are required",
        });
      }

      const follow = await followService.getFollowByFollowerAndFollowed(followerId, followedId);

      if (!follow) {
        return res.status(404).json({
          success: false,
          message: "Follow relationship not found",
        });
      }

      res.status(200).json({
        success: true,
        data: follow,
      });
    } catch (error) {
      console.error("Error in getFollowByFollowerAndFollowed controller:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving follow relationship",
        error: error.message,
      });
    }
  }

  /**
   * Get all users that a user is following
   * GET /api/follows/following/:userId
   */
  async getFollowingByUserId(req, res) {
    try {
      const { userId } = req.params;
      const { limit, lastEvaluatedKey } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      const options = {
        limit: limit ? parseInt(limit) : 20,
        lastEvaluatedKey: lastEvaluatedKey
          ? JSON.parse(lastEvaluatedKey)
          : undefined,
      };

      const result = await followService.getFollowingByUserId(userId, options);

      res.status(200).json({
        success: true,
        data: {
          follows: result.follows,
          count: result.count,
          lastEvaluatedKey: result.lastEvaluatedKey,
        },
      });
    } catch (error) {
      console.error("Error in getFollowingByUserId controller:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving following list",
        error: error.message,
      });
    }
  }

  /**
   * Get all users following a user
   * GET /api/follows/followers/:userId
   */
  async getFollowersByUserId(req, res) {
    try {
      const { userId } = req.params;
      const { limit, lastEvaluatedKey } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      const options = {
        limit: limit ? parseInt(limit) : 20,
        lastEvaluatedKey: lastEvaluatedKey
          ? JSON.parse(lastEvaluatedKey)
          : undefined,
      };

      const result = await followService.getFollowersByUserId(userId, options);

      res.status(200).json({
        success: true,
        data: {
          follows: result.follows,
          count: result.count,
          lastEvaluatedKey: result.lastEvaluatedKey,
        },
      });
    } catch (error) {
      console.error("Error in getFollowersByUserId controller:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving followers list",
        error: error.message,
      });
    }
  }

  /**
   * Delete a follow relationship
   * DELETE /api/follows/follower/:followerId/followed/:followedId
   */
  async deleteFollow(req, res) {
    try {
      const { followerId, followedId } = req.params;

      if (!followerId || !followedId) {
        return res.status(400).json({
          success: false,
          message: "Follower ID and Followed ID are required",
        });
      }

      await followService.deleteFollow(followerId, followedId);

      res.status(200).json({
        success: true,
        message: "Follow relationship deleted successfully",
      });
    } catch (error) {
      console.error("Error in deleteFollow controller:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting follow relationship",
        error: error.message,
      });
    }
  }

  /**
   * Check if user is following another user
   * GET /api/follows/check/:followerId/:followedId
   */
  async checkUserFollowing(req, res) {
    try {
      const { followerId, followedId } = req.params;

      if (!followerId || !followedId) {
        return res.status(400).json({
          success: false,
          message: "Follower ID and Followed ID are required",
        });
      }

      const isFollowing = await followService.isUserFollowing(followerId, followedId);

      res.status(200).json({
        success: true,
        data: {
          isFollowing,
          followerId,
          followedId,
        },
      });
    } catch (error) {
      console.error("Error in checkUserFollowing controller:", error);
      res.status(500).json({
        success: false,
        message: "Error checking follow status",
        error: error.message,
      });
    }
  }

  /**
   * Get following count for a user
   * GET /api/follows/following/count/:userId
   */
  async getFollowingCount(req, res) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      const count = await followService.getFollowingCount(userId);

      res.status(200).json({
        success: true,
        data: {
          userId,
          followingCount: count,
        },
      });
    } catch (error) {
      console.error("Error in getFollowingCount controller:", error);
      res.status(500).json({
        success: false,
        message: "Error getting following count",
        error: error.message,
      });
    }
  }

  /**
   * Get followers count for a user
   * GET /api/follows/followers/count/:userId
   */
  async getFollowersCount(req, res) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      const count = await followService.getFollowersCount(userId);

      res.status(200).json({
        success: true,
        data: {
          userId,
          followersCount: count,
        },
      });
    } catch (error) {
      console.error("Error in getFollowersCount controller:", error);
      res.status(500).json({
        success: false,
        message: "Error getting followers count",
        error: error.message,
      });
    }
  }

  /**
   * Get mutual follows for a user
   * GET /api/follows/mutual/:userId
   */
  async getMutualFollows(req, res) {
    try {
      const { userId } = req.params;
      const { limit } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      const options = {
        limit: limit ? parseInt(limit) : 20,
      };

      const result = await followService.getMutualFollows(userId, options);

      res.status(200).json({
        success: true,
        data: {
          follows: result.follows,
          count: result.count,
        },
      });
    } catch (error) {
      console.error("Error in getMutualFollows controller:", error);
      res.status(500).json({
        success: false,
        message: "Error getting mutual follows",
        error: error.message,
      });
    }
  }
}

module.exports = new FollowController(); 