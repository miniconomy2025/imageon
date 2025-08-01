const express = require("express");
const followController = require("../controllers/followController");

const router = express.Router();

// Create a new follow relationship
// POST /api/follows
router.post("/", followController.createFollow);

// Get follow relationship by follower and followed
// GET /api/follows/follower/:followerId/followed/:followedId
router.get(
  "/follower/:followerId/followed/:followedId",
  followController.getFollowByFollowerAndFollowed
);

// Get all users that a user is following
// GET /api/follows/following/:userId
router.get("/following/:userId", followController.getFollowingByUserId);

// Get all users following a user
// GET /api/follows/followers/:userId
router.get("/followers/:userId", followController.getFollowersByUserId);

// Check if user is following another user
// GET /api/follows/check/:followerId/:followedId
router.get(
  "/check/:followerId/:followedId",
  followController.checkUserFollowing
);

// Get following count for a user
// GET /api/follows/following/count/:userId
router.get("/following/count/:userId", followController.getFollowingCount);

// Get followers count for a user
// GET /api/follows/followers/count/:userId
router.get("/followers/count/:userId", followController.getFollowersCount);

// Get mutual follows for a user
// GET /api/follows/mutual/:userId
router.get("/mutual/:userId", followController.getMutualFollows);

// Delete a follow relationship
// DELETE /api/follows/follower/:followerId/followed/:followedId
router.delete(
  "/follower/:followerId/followed/:followedId",
  followController.deleteFollow
);

module.exports = router;
