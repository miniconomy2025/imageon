import { userService } from "../services/userService";
import { User } from "../models/userModels";   
import { Request, Response } from "express";

class UserController {
  async createUser(req: Request, res: Response) {
    try {
      const { username, email, display_name, bio } = req.body;

      if (!username || !email || !display_name) {
        res.status(400).json({
          success: false,
          message: "Username, email, and display_name are required",
          errors: {
            username: !username ? "Username is required" : null,
            email: !email ? "Email is required" : null,
            display_name: !display_name ? "Display name is required" : null,
          },
        });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
        return;
      }

      const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
      if (!usernameRegex.test(username)) {
        res.status(400).json({
          success: false,
          message:
            "Username must be 3-30 characters long and contain only letters, numbers, underscores, and hyphens",
        });
        return;
      }

      const user = await userService.createUser({
        username,
        email,
        display_name,
        bio,
      });

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
      const msg = error instanceof Error ? error.message : String(error); 

      if (msg.includes("already exists")) {
        res.status(409).json({
          success: false,
          message: msg,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? msg : undefined,
      });
    }
  }

  async getUserById(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const user = await userService.getUserById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

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
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? msg : undefined,
      });
    }
  }

  async getUserByUsername(req: Request, res: Response) {
    try {
      const { username } = req.params;

      const user = await userService.getUserByUsername(username);

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

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
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? msg : undefined,
      });
    }
  }

  async getAllUsers(req: Request, res: Response) {
    try {
      const { limit = 20, lastEvaluatedKey } = req.query;

      const result = await userService.getAllUsers({
        limit: parseInt(limit as string),
        lastEvaluatedKey: lastEvaluatedKey
          ? JSON.parse(lastEvaluatedKey as string)
          : undefined,
      });

      const users = result.items.map((user: User) => ({ ...user }));

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
      const msg = error instanceof Error ? error.message : String(error); 
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? msg : undefined,
      });
    }
  }

  async updateUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const updates = req.body;

      const {
        user_id,
        username,
        email,
        created_at: _createdAt,
        ...allowedUpdates
      } = updates;

      if (Object.keys(allowedUpdates).length === 0) {
        res.status(400).json({
          success: false,
          message: "No valid fields to update",
        });
        return;
      }

      const updatedUser = await userService.updateUser(userId, allowedUpdates);

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
          created_at: userCreatedAt,
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
      const msg = error instanceof Error ? error.message : String(error); 

      if (msg === "User not found") {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? msg : undefined,
      });
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      await userService.deleteUser(userId);

      res.status(200).json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      console.error("Error in deleteUser controller:", error);
      const msg = error instanceof Error ? error.message : String(error); 

      if (msg === "User not found") {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? msg : undefined,
      });
    }
  }
}

export const userController = new UserController();