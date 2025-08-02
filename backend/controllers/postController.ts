const postService = require("../services/postService");

class PostController {
  /**
   * Create a new post
   * POST /api/posts
   */
  async createPost(req, res) {
    try {
      const postData = req.body;

      // Validate required fields
      if (!postData.user_id || !postData.username || !postData.content) {
        return res.status(400).json({
          success: false,
          message: "User ID, username, and content are required",
        });
      }

      const post = await postService.createPost(postData);

      res.status(201).json({
        success: true,
        message: "Post created successfully",
        data: post,
      });
    } catch (error) {
      console.error("Error in createPost controller:", error);
      res.status(500).json({
        success: false,
        message: "Error creating post",
        error: error.message,
      });
    }
  }

  /**
   * Get post by ID
   * GET /api/posts/:postId
   */
  async getPostById(req, res) {
    try {
      const { postId } = req.params;

      if (!postId) {
        return res.status(400).json({
          success: false,
          message: "Post ID is required",
        });
      }

      const post = await postService.getPostById(postId);

      if (!post) {
        return res.status(404).json({
          success: false,
          message: "Post not found",
        });
      }

      res.status(200).json({
        success: true,
        data: post,
      });
    } catch (error) {
      console.error("Error in getPostById controller:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving post",
        error: error.message,
      });
    }
  }

  /**
   * Get posts by user ID
   * GET /api/posts/user/:userId
   */
  async getPostsByUserId(req, res) {
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

      const result = await postService.getPostsByUserId(userId, options);

      res.status(200).json({
        success: true,
        data: {
          posts: result.posts,
          count: result.count,
          lastEvaluatedKey: result.lastEvaluatedKey,
        },
      });
    } catch (error) {
      console.error("Error in getPostsByUserId controller:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving posts",
        error: error.message,
      });
    }
  }

  /**
   * Get all posts (feed)
   * GET /api/posts
   */
  async getAllPosts(req, res) {
    try {
      const { limit, lastEvaluatedKey } = req.query;

      const options = {
        limit: limit ? parseInt(limit) : 20,
        lastEvaluatedKey: lastEvaluatedKey
          ? JSON.parse(lastEvaluatedKey)
          : undefined,
      };

      const result = await postService.getAllPosts(options);

      res.status(200).json({
        success: true,
        data: {
          posts: result.posts,
          count: result.count,
          lastEvaluatedKey: result.lastEvaluatedKey,
        },
      });
    } catch (error) {
      console.error("Error in getAllPosts controller:", error);
      res.status(500).json({
        success: false,
        message: "Error retrieving posts",
        error: error.message,
      });
    }
  }

  /**
   * Update a post
   * PUT /api/posts/:postId
   */
  async updatePost(req, res) {
    try {
      const { postId } = req.params;
      const updates = req.body;

      if (!postId) {
        return res.status(400).json({
          success: false,
          message: "Post ID is required",
        });
      }

      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No updates provided",
        });
      }

      // Remove fields that shouldn't be updated
      const allowedUpdates = {
        content: updates.content,
        media_url: updates.media_url,
        media_type: updates.media_type,
        tags: updates.tags,
        location: updates.location,
        is_public: updates.is_public,
        status: updates.status,
      };

      // Remove undefined values
      Object.keys(allowedUpdates).forEach((key) => {
        if (allowedUpdates[key] === undefined) {
          delete allowedUpdates[key];
        }
      });

      const updatedPost = await postService.updatePost(postId, allowedUpdates);

      res.status(200).json({
        success: true,
        message: "Post updated successfully",
        data: updatedPost,
      });
    } catch (error) {
      console.error("Error in updatePost controller:", error);
      res.status(500).json({
        success: false,
        message: "Error updating post",
        error: error.message,
      });
    }
  }

  /**
   * Delete a post
   * DELETE /api/posts/:postId
   */
  async deletePost(req, res) {
    try {
      const { postId } = req.params;

      if (!postId) {
        return res.status(400).json({
          success: false,
          message: "Post ID is required",
        });
      }

      await postService.deletePost(postId);

      res.status(200).json({
        success: true,
        message: "Post deleted successfully",
      });
    } catch (error) {
      console.error("Error in deletePost controller:", error);
      res.status(500).json({
        success: false,
        message: "Error deleting post",
        error: error.message,
      });
    }
  }

  /**
   * Like a post
   * POST /api/posts/:postId/like
   */
  async likePost(req, res) {
    try {
      const { postId } = req.params;
      const { user_id } = req.body;

      if (!postId) {
        return res.status(400).json({
          success: false,
          message: "Post ID is required",
        });
      }

      if (!user_id) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      const updatedPost = await postService.likePost(postId, user_id);

      res.status(200).json({
        success: true,
        message: "Post liked successfully",
        data: updatedPost,
      });
    } catch (error) {
      console.error("Error in likePost controller:", error);
      res.status(500).json({
        success: false,
        message: "Error liking post",
        error: error.message,
      });
    }
  }

  /**
   * Unlike a post
   * DELETE /api/posts/:postId/like
   */
  async unlikePost(req, res) {
    try {
      const { postId } = req.params;
      const { user_id } = req.body;

      if (!postId) {
        return res.status(400).json({
          success: false,
          message: "Post ID is required",
        });
      }

      if (!user_id) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      const updatedPost = await postService.unlikePost(postId, user_id);

      res.status(200).json({
        success: true,
        message: "Post unliked successfully",
        data: updatedPost,
      });
    } catch (error) {
      console.error("Error in unlikePost controller:", error);
      res.status(500).json({
        success: false,
        message: "Error unliking post",
        error: error.message,
      });
    }
  }
}

module.exports = new PostController();
