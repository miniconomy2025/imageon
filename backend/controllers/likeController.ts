const likeService = require("../services/likeService");

class LikeController {
  /**
   * Create a new like
   * POST /api/likes
   */
  async createLike(req, res) {
    try {
      const likeData = req.body;

      // Validate required fields
      if (!likeData.post_id || !likeData.user_id || !likeData.username) {
        return res.status(400).json({
          success: false,
          message: "Post ID, user ID, and username are required",
        });
      }

      const like = await likeService.createLike(likeData);

      res.status(201).json({
        success: true,
        message: "Like created successfully",
        data: like,
      });
    } catch (error) {
      console.error("Error in createLike controller:", error);
      res.status(500).json({
        success: false,
        message: "Error creating like",
        error: error.message,
      });
    }
  }

  /**
   * Get like by post and user
   * GET /api/likes/post/:postId/user/:userId
   */
  async getLikeByPostAndUser(req, res) {
    try {
      const { postId, userId } = req.params;

      if (!postId || !userId) {
        return res.status(400).json({
          success: false,
          message: "Post ID and User ID are required",
        });
      }

      const like = await likeService.getLikeByPostAndUser(postId, userId);

      if (!like) {
        return res.status(404).json({
          success: false,
          message: "Like not found",
        });
      }

      res.status(200).json({
        success: true,
        data: like,
      });
    } catch (error) {
      console.error("Error in getLikeByPostAndUser controller:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving like",
        error: error.message,
      });
    }
  }

  /**
   * Get likes by post ID
   * GET /api/likes/post/:postId
   */
  async getLikesByPostId(req, res) {
    try {
      const { postId } = req.params;
      const { limit, lastEvaluatedKey } = req.query;

      if (!postId) {
        return res.status(400).json({
          success: false,
          message: "Post ID is required",
        });
      }

      const options = {
        limit: limit ? parseInt(limit) : 20,
        lastEvaluatedKey: lastEvaluatedKey
          ? JSON.parse(lastEvaluatedKey)
          : undefined,
      };

      const result = await likeService.getLikesByPostId(postId, options);

      res.status(200).json({
        success: true,
        data: {
          likes: result.likes,
          count: result.count,
          lastEvaluatedKey: result.lastEvaluatedKey,
        },
      });
    } catch (error) {
      console.error("Error in getLikesByPostId controller:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving likes",
        error: error.message,
      });
    }
  }

  /**
   * Get likes by user ID
   * GET /api/likes/user/:userId
   */
  async getLikesByUserId(req, res) {
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

      const result = await likeService.getLikesByUserId(userId, options);

      res.status(200).json({
        success: true,
        data: {
          likes: result.likes,
          count: result.count,
          lastEvaluatedKey: result.lastEvaluatedKey,
        },
      });
    } catch (error) {
      console.error("Error in getLikesByUserId controller:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving likes",
        error: error.message,
      });
    }
  }

  /**
   * Delete a like
   * DELETE /api/likes/post/:postId/user/:userId
   */
  async deleteLike(req, res) {
    try {
      const { postId, userId } = req.params;

      if (!postId || !userId) {
        return res.status(400).json({
          success: false,
          message: "Post ID and User ID are required",
        });
      }

      await likeService.deleteLike(postId, userId);

      res.status(200).json({
        success: true,
        message: "Like deleted successfully",
      });
    } catch (error) {
      console.error("Error in deleteLike controller:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting like",
        error: error.message,
      });
    }
  }

  /**
   * Delete like by user and post
   * DELETE /api/likes/user/:userId/post/:postId
   */
  async deleteLikeByUserAndPost(req, res) {
    try {
      const { userId, postId } = req.params;

      if (!userId || !postId) {
        return res.status(400).json({
          success: false,
          message: "User ID and Post ID are required",
        });
      }

      await likeService.deleteLikeByUserAndPost(userId, postId);

      res.status(200).json({
        success: true,
        message: "Like deleted successfully",
      });
    } catch (error) {
      console.error("Error in deleteLikeByUserAndPost controller:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting like",
        error: error.message,
      });
    }
  }

  /**
   * Check if user has liked a post
   * GET /api/likes/check/:userId/:postId
   */
  async checkUserLike(req, res) {
    try {
      const { userId, postId } = req.params;

      if (!userId || !postId) {
        return res.status(400).json({
          success: false,
          message: "User ID and Post ID are required",
        });
      }

      const hasLiked = await likeService.hasUserLikedPost(userId, postId);

      res.status(200).json({
        success: true,
        data: {
          hasLiked,
          userId,
          postId,
        },
      });
    } catch (error) {
      console.error("Error in checkUserLike controller:", error);
      res.status(500).json({
        success: false,
        message: "Error checking like status",
        error: error.message,
      });
    }
  }

  /**
   * Get like count for a post
   * GET /api/likes/count/:postId
   */
  async getLikeCount(req, res) {
    try {
      const { postId } = req.params;

      if (!postId) {
        return res.status(400).json({
          success: false,
          message: "Post ID is required",
        });
      }

      const count = await likeService.getLikeCountForPost(postId);

      res.status(200).json({
        success: true,
        data: {
          postId,
          count,
        },
      });
    } catch (error) {
      console.error("Error in getLikeCount controller:", error);
      res.status(500).json({
        success: false,
        message: "Error getting like count",
        error: error.message,
      });
    }
  }
}

module.exports = new LikeController();
