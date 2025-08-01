const express = require("express");
const likeController = require("../controllers/likeController");

const router = express.Router();

// Create a new like
// POST /api/likes
router.post("/", likeController.createLike);

// Get like by post and user
// GET /api/likes/post/:postId/user/:userId
router.get("/post/:postId/user/:userId", likeController.getLikeByPostAndUser);

// Get likes by post ID
// GET /api/likes/post/:postId
router.get("/post/:postId", likeController.getLikesByPostId);

// Get likes by user ID
// GET /api/likes/user/:userId
router.get("/user/:userId", likeController.getLikesByUserId);

// Check if user has liked a post
// GET /api/likes/check/:userId/:postId
router.get("/check/:userId/:postId", likeController.checkUserLike);

// Get like count for a post
// GET /api/likes/count/:postId
router.get("/count/:postId", likeController.getLikeCount);

// Delete a like
// DELETE /api/likes/post/:postId/user/:userId
router.delete("/post/:postId/user/:userId", likeController.deleteLike);

// Delete like by user and post
// DELETE /api/likes/user/:userId/post/:postId
router.delete(
  "/user/:userId/post/:postId",
  likeController.deleteLikeByUserAndPost
);

module.exports = router;
