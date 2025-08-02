import express from "express";
import { userController } from "../controllers/userController";

const router = express.Router();

router.post("/", userController.createUser);

router.get("/", userController.getAllUsers);
router.get("/username/:username", userController.getUserByUsername);
router.get("/:userId", userController.getUserById);

router.put("/:userId", userController.updateUser);

router.delete("/:userId", userController.deleteUser);

module.exports = router;