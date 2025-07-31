// src/routes/profileRoutes.ts

import express from "express";
import profileController from "../controllers/userController";

const router = express.Router();

// All profile-related endpoints are mounted under /profiles
router.use("/profiles", profileController);

export default router;
