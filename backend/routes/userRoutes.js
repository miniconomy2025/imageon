const express = require("express");
const userController = require("../controllers/userController");

const router = express.Router();

/**
 * User Routes
 *
 * POST   /api/users              - Create a new user
 * GET    /api/users              - Get all users (with pagination)
 * GET    /api/users/:userId      - Get user by ID
 * GET    /api/users/username/:username - Get user by username
 * PUT    /api/users/:userId      - Update user profile
 * DELETE /api/users/:userId      - Delete user (soft delete)
 */

// Create a new user
router.post("/", userController.createUser);

// Get all users (with pagination)
router.get("/", userController.getAllUsers);

// Get user by username (must come before /:userId to avoid conflicts)
router.get("/username/:username", userController.getUserByUsername);

// Get user by ID
router.get("/:userId", userController.getUserById);

// Update user profile
router.put("/:userId", userController.updateUser);

// Delete user (soft delete)
router.delete("/:userId", userController.deleteUser);

module.exports = router;
