import { postService } from "../services/postService";
import { Request, Response } from "express";

class PostController {
  async createPost(req: Request, res: Response) {
    try {
      const postData = req.body;

      if (!postData.user_id || !postData.username || !postData.content) {
        res.status(400).json({
          success: false,
          message: "User ID, username, and content are required",
        });
        return;
      }

      const post = await postService.createPost(postData);

      res.status(201).json({
        success: true,
        message: "Post created successfully",
        data: post,
      });
    } catch (error) {
      console.error("Error in createPost controller:", error);
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error creating post",
        error: msg,
      });
    }
  }

  async getPostById(req: Request, res: Response) {
    try {
      const { postId } = req.params;

      if (!postId) {
        res.status(400).json({
          success: false,
          message: "Post ID is required",
        });
        return;
      }

      const post = await postService.getPostById(postId);

      if (!post) {
        res.status(404).json({
          success: false,
          message: "Post not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: post,
      });
    } catch (error) {
      console.error("Error in getPostById controller:", error);
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error retrieving post",
        error: msg,
      });
    }
  }

  async getPostsByUserId(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { limit, lastEvaluatedKey } = req.query;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: "User ID is required",
        });
        return;
      }

      const options = {
        limit: limit ? parseInt(limit as string) : 20,
        lastEvaluatedKey: lastEvaluatedKey
          ? JSON.parse(lastEvaluatedKey as string)
          : undefined,
      };

      const result = await postService.getPostsByUserId(userId, options);

      res.status(200).json({
        success: true,
        data: {
          posts: result.items,
          count: result.count,
          lastEvaluatedKey: result.lastEvaluatedKey,
        },
      });
    } catch (error) {
      console.error("Error in getPostsByUserId controller:", error);
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error retrieving posts",
        error: msg,
      });
    }
  }

  async getAllPosts(req: Request, res: Response) {
    try {
      const { limit, lastEvaluatedKey } = req.query;

      const options = {
        limit: limit ? parseInt(limit as string) : 20,
        lastEvaluatedKey: lastEvaluatedKey
          ? JSON.parse(lastEvaluatedKey as string)
          : undefined,
      };

      const result = await postService.getAllPosts(options);

      res.status(200).json({
        success: true,
        data: {
          posts: result.items,
          count: result.count,
          lastEvaluatedKey: result.lastEvaluatedKey,
        },
      });
    } catch (error) {
      console.error("Error in getAllPosts controller:", error);
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error retrieving posts",
        error: msg,
      });
    }
  }

  async updatePost(req: Request, res: Response) {
    try {
      const { postId } = req.params;
      const updates = req.body;

      if (!postId) {
        res.status(400).json({
          success: false,
          message: "Post ID is required",
        });
        return;
      }

      if (!updates || Object.keys(updates).length === 0) {
        res.status(400).json({
          success: false,
          message: "No updates provided",
        });
        return;
      }

      const allowedUpdates = {
        content: updates.content,
        media_url: updates.media_url,
        media_type: updates.media_type,
        tags: updates.tags,
        location: updates.location,
        is_public: updates.is_public,
        status: updates.status,
      };

      const cleanUpdates = Object.fromEntries(
        Object.entries(allowedUpdates).filter(([, v]) => v !== undefined)
      );

      const updatedPost = await postService.updatePost(postId, cleanUpdates);

      res.status(200).json({
        success: true,
        message: "Post updated successfully",
        data: updatedPost,
      });
    } catch (error) {
      console.error("Error in updatePost controller:", error);
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error updating post",
        error: msg,
      });
    }
  }

  async deletePost(req: Request, res: Response) {
    try {
      const { postId } = req.params;

      if (!postId) {
        res.status(400).json({
          success: false,
          message: "Post ID is required",
        });
        return;
      }

      await postService.deletePost(postId);

      res.status(200).json({
        success: true,
        message: "Post deleted successfully",
      });
    } catch (error) {
      console.error("Error in deletePost controller:", error);
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error deleting post",
        error: msg,
      });
    }
  }

  async likePost(req: Request, res: Response) {
    try {
      const { postId } = req.params;
      const { user_id } = req.body;

      if (!postId) {
        res.status(400).json({
          success: false,
          message: "Post ID is required",
        });
        return;
      }

      if (!user_id) {
        res.status(400).json({
          success: false,
          message: "User ID is required",
        });
        return;
      }

      const updatedPost = await postService.likePost(postId, user_id);

      res.status(200).json({
        success: true,
        message: "Post liked successfully",
        data: updatedPost,
      });
    } catch (error) {
      console.error("Error in likePost controller:", error);
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error liking post",
        error: msg,
      });
    }
  }

  async unlikePost(req: Request, res: Response) {
    try {
      res.status(405).json({
        success: false,
        message: "Unlike operation is not supported. Likes are permanent.",
      });
      return;
    } catch (error) {
      console.error("Error in unlikePost controller:", error);
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error unliking post",
        error: msg,
      });
    }
  }
}

export const postController = new PostController();