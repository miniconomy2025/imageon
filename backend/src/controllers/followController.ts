import { followService } from "../services/followService";
import { Request, Response } from "express";

class FollowController {
  async createFollow(req: Request, res: Response): Promise<void> {
    try {
      const followData = req.body;

      if (!followData.follower_id || !followData.followed_username) {
        res.status(400).json({
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
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error creating follow relationship",
        error: msg,
      });
    }
  }

  async getFollowByFollowerAndFollowed(req: Request, res: Response): Promise<void> {
    try {
      const { followerId, followedId } = req.params;

      if (!followerId || !followedId) {
        res.status(400).json({
          success: false,
          message: "Follower ID and Followed ID are required",
        });
      }

      const follow = await followService.getFollowByFollowerAndFollowed(followerId, followedId);

      if (!follow) {
        res.status(404).json({
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
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error retrieving follow relationship",
        error: msg,
      });
    }
  }

  async getFollowingByUserId(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { limit, lastEvaluatedKey } = req.query;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      const options = {
        limit: limit ? parseInt(limit as string) : 20,
        lastEvaluatedKey: lastEvaluatedKey
          ? JSON.parse(lastEvaluatedKey as string)
          : undefined,
      };

      const result = await followService.getFollowingByUserId(userId, options);

      res.status(200).json({
        success: true,
        data: {
          follows: result.items,
          count: result.count,
          lastEvaluatedKey: result.lastEvaluatedKey,
        },
      });
    } catch (error) {
      console.error("Error in getFollowingByUserId controller:", error);
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error retrieving following list",
        error: msg,
      });
    }
  }

  async getFollowersByUserId(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { limit, lastEvaluatedKey } = req.query;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      const options = {
        limit: limit ? parseInt(limit as string) : 20,
        lastEvaluatedKey: lastEvaluatedKey
          ? JSON.parse(lastEvaluatedKey as string)
          : undefined,
      };

      const result = await followService.getFollowersByUserId(userId, options);

      res.status(200).json({
        success: true,
        data: {
          follows: result.items,
          count: result.count,
          lastEvaluatedKey: result.lastEvaluatedKey,
        },
      });
    } catch (error) {
      console.error("Error in getFollowersByUserId controller:", error);
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error retrieving followers list",
        error: msg,
      });
    }
  }

  async deleteFollow(req: Request, res: Response) {
    try {
      const { followerId, followedId } = req.params;

      if (!followerId || !followedId) {
        res.status(400).json({
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
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error deleting follow relationship",
        error: msg,
      });
    }
  }

  async checkUserFollowing(req: Request, res: Response) {
    try {
      const { followerId, followedId } = req.params;

      if (!followerId || !followedId) {
        res.status(400).json({
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
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error checking follow status",
        error: msg,
      });
    }
  }

  async getFollowingCount(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
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
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error getting following count",
        error: msg,
      });
    }
  }

  async getFollowersCount(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({
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
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error getting followers count",
        error: msg,
      });
    }
  }

  async getMutualFollows(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { limit } = req.query;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      const options = {
        limit: limit ? parseInt(limit as string) : 20,
      };

      const result = await followService.getMutualFollows(userId, options);

      res.status(200).json({
        success: true,
        data: {
          follows: result.items,
          count: result.count,
        },
      });
    } catch (error) {
      console.error("Error in getMutualFollows controller:", error);
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Error getting mutual follows",
        error: msg,
      });
    }
  }
}

export const followController = new FollowController(); 