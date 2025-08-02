import express from "express";
import { followController } from "../controllers/followController";

const router = express.Router();

router.post("/", followController.createFollow);

router.get("/follower/:followerId/followed/:followedId", followController.getFollowByFollowerAndFollowed);
router.get("/following/:userId", followController.getFollowingByUserId);
router.get("/followers/:userId", followController.getFollowersByUserId);
router.get("/check/:followerId/:followedId", followController.checkUserFollowing);
router.get("/following/count/:userId", followController.getFollowingCount);
router.get("/followers/count/:userId", followController.getFollowersCount);
router.get("/mutual/:userId", followController.getMutualFollows);

router.delete("/follower/:followerId/followed/:followedId", followController.deleteFollow);

module.exports = router;