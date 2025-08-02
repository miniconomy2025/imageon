const express = require("express");
const postController = require("../controllers/postController");

const router = express.Router();

router.post("/", postController.createPost);
router.post("/:postId/like", postController.likePost);

router.get("/", postController.getAllPosts);
router.get("/user/:userId", postController.getPostsByUserId);
router.get("/:postId", postController.getPostById);

router.put("/:postId", postController.updatePost);

router.delete("/:postId", postController.deletePost);
router.delete("/:postId/like", postController.unlikePost);

module.exports = router;
