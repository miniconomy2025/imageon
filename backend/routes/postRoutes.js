const express = require("express");
const postController = require("../controllers/postController");

const router = express.Router();

// Create a new post
// POST /api/posts
router.post("/", postController.createPost);

// Get all posts (feed)
// GET /api/posts
router.get("/", postController.getAllPosts);

// Get posts by user ID
// GET /api/posts/user/:userId
router.get("/user/:userId", postController.getPostsByUserId);

// Get post by ID
// GET /api/posts/:postId
router.get("/:postId", postController.getPostById);

// Update a post
// PUT /api/posts/:postId
router.put("/:postId", postController.updatePost);

// Delete a post
// DELETE /api/posts/:postId
router.delete("/:postId", postController.deletePost);

// Like a post
// POST /api/posts/:postId/like
router.post("/:postId/like", postController.likePost);

// Unlike a post
// DELETE /api/posts/:postId/like
router.delete("/:postId/like", postController.unlikePost);

module.exports = router;
