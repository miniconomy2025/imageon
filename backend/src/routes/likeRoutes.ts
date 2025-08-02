import express from "express";
import { likeController } from "../controllers/likeController";

const router = express.Router();

router.post("/", likeController.createLike);

router.get("/post/:postId/user/:userId", likeController.getLikeByPostAndUser);
router.get("/post/:postId", likeController.getLikesByPostId);
router.get("/user/:userId", likeController.getLikesByUserId);
router.get("/check/:userId/:postId", likeController.checkUserLike);
router.get("/count/:postId", likeController.getLikeCount);

router.delete("/post/:postId/user/:userId", likeController.deleteLike);
router.delete("/user/:userId/post/:postId", likeController.deleteLikeByUserAndPost);

module.exports = router;