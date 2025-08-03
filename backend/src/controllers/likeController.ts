import { likeService } from "../services/likeService";
import { Request, Response } from "express";

class LikeController {
  async createLike(req: Request, res: Response) {
    try {
      const likeData = req.body;

      if (!likeData.post_id || !likeData.user_id || !likeData.username) {
        res.status(400).json({
          success: false,
          message: "post_id, user_id, and username are required",
        });
        return;
      }

      const like = await likeService.createLike(likeData);

      res.status(201).json({
        success: true,
        message: "Like created successfully",
        data: like,
      });
    } catch (error) {
      console.error("Error in createLike controller:", error);
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error creating like",
        error: msg,
      });
    }
  }

  async getLikeByPostAndUser(req: Request, res: Response) {
    try {
      const { postId, userId } = req.params;

      if (!postId || !userId) {
        res.status(400).json({
          success: false,
          message: "postId and userId are required",
        });
        return;
      }

      const like = await likeService.getLikeByPostAndUser(postId, userId);

      if (!like) {
        res.status(404).json({
          success: false,
          message: "Like not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: like,
      });
    } catch (error) {
      console.error("Error in getLikeByPostAndUser controller:", error);
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error retrieving like",
        error: msg,
      });
    }
  }

  async getLikesByPostId(req: Request, res: Response) {
    try {
      const { postId } = req.params;
      const { limit, lastEvaluatedKey } = req.query;

      if (!postId) {
        res.status(400).json({
          success: false,
          message: "postId is required",
        });
        return;
      }

      const options = {
        limit: limit ? parseInt(limit as string) : 20,
        lastEvaluatedKey: lastEvaluatedKey
          ? JSON.parse(lastEvaluatedKey as string)
          : undefined,
      };

      const result = await likeService.getLikesByPostId(postId, options);

      res.status(200).json({
        success: true,
        data: {
          likes: result.items,
          count: result.count,
          lastEvaluatedKey: result.lastEvaluatedKey,
        },
      });
    } catch (error) {
      console.error("Error in getLikesByPostId controller:", error);
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error retrieving likes",
        error: msg,
      });
    }
  }

  async getLikesByUserId(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { limit, lastEvaluatedKey } = req.query;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: "userId is required",
        });
        return;
      }

      const options = {
        limit: limit ? parseInt(limit as string) : 20,
        lastEvaluatedKey: lastEvaluatedKey
          ? JSON.parse(lastEvaluatedKey as string)
          : undefined,
      };

      const result = await likeService.getLikesByUserId(userId, options);

      res.status(200).json({
        success: true,
        data: {
          likes: result.items,
          count: result.count,
          lastEvaluatedKey: result.lastEvaluatedKey,
        },
      });
    } catch (error) {
      console.error("Error in getLikesByUserId controller:", error);
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error retrieving likes",
        error: msg,
      });
    }
  }

  async checkUserLike(req: Request, res: Response) {
    try {
      const { userId, postId } = req.params;

      if (!userId || !postId) {
        res.status(400).json({
          success: false,
          message: "userId and postId are required",
        });
        return;
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
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error checking like status",
        error: msg,
      });
    }
  }

  async getLikeCount(req: Request, res: Response) {
    try {
      const { postId } = req.params;

      if (!postId) {
        res.status(400).json({
          success: false,
          message: "postId is required",
        });
        return;
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
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error getting like count",
        error: msg,
      });
    }
  }
}

export const likeController = new LikeController();