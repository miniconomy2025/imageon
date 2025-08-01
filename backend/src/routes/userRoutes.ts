// src/routes/profileRoutes.ts

import express from "express";
import profileController from "../controllers/userController";
import postController from "../controllers/postController";

const router = express.Router();

// All profile-related endpoints are mounted under /profiles
router.use("/profiles", profileController);
router.use("/posts", postController);

export default router;
