// src/controllers/postController.ts

import express, { Request, Response } from "express";
import multer from "multer";
import {
  createPost,
  getPostById,
  getTimelinePosts,
  likePost,
} from "../services/postService";
import {
  uploadPostMedia,
  getPostMediaUrl,
} from "../services/postStorageService";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// in-memory multer storage (buffer) since we send to S3 immediately :contentReference[oaicite:1]{index=1}
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB cap, adjust as needed
});

/**
 * POST /posts
 * Body: multipart/form-data
 * Fields:
 *   - authorId
 *   - authorUsername
 *   - content
 *   - contentType (text|image|video)
 *   - visibility (optional)
 *   - hashtags (optional, comma separated)
 *   - mentions (optional, comma separated)
 *   - files[] (optional) – image/video files to upload
 */
router.post(
  "/",
  upload.array("files", 5), // support up to 5 files
  async (req: Request, res: Response) => {
    try {
      const {
        authorId,
        authorUsername,
        content,
        contentType = "text",
        visibility = "public",
        hashtags,
        mentions,
      } = req.body as Record<string, any>;

      if (!authorId || !authorUsername || !content) {
        return res
          .status(400)
          .json({ message: "authorId, authorUsername, and content required" });
      }

      const postId = uuidv4();
      const mediaUrls: string[] = [];

      // If there are files, upload each and collect its URL
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files as Express.Multer.File[]) {
          const extension = file.originalname.split(".").pop() || "";
          const key = `post-media/${postId}/${uuidv4()}.${extension}`;
          const bucket = "posts"; // ensure this bucket exists locally in MinIO

          // Upload the raw buffer to S3/MinIO :contentReference[oaicite:2]{index=2}
          await uploadPostMedia(bucket, key, file.buffer, file.mimetype);

          // Optionally generate a presigned URL for access (could store raw key instead)
          const url = await getPostMediaUrl(bucket, key, 60 * 60); // 1h expiry :contentReference[oaicite:3]{index=3}
          mediaUrls.push(url);
        }
      }

      // Build post metadata and persist to DynamoDB transactionally :contentReference[oaicite:4]{index=4}
      await createPost({
        postId,
        authorId,
        authorUsername,
        content,
        contentType,
        mediaUrls: mediaUrls.length ? mediaUrls : undefined,
        visibility,
        hashtags: hashtags
          ? String(hashtags)
              .split(",")
              .map((h) => h.trim())
              .filter(Boolean)
          : undefined,
        mentions: mentions
          ? String(mentions)
              .split(",")
              .map((m) => m.trim())
              .filter(Boolean)
          : undefined,
      });

      res.status(201).json({ postId, mediaUrls });
    } catch (err) {
      console.error("Error creating post:", err);
      res.status(500).json({ message: "Failed to create post", error: String(err) });
    }
  }
);

/**
 * GET /posts/:postId
 */
router.get("/:postId", async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const post = await getPostById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json(post);
  } catch (err) {
    console.error("Error fetching post:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /posts/timeline?date=YYYY-MM-DD&limit=20
 */
router.get("/timeline", async (req: Request, res: Response) => {
  try {
    const date = String(req.query.date || new Date().toISOString().slice(0, 10)); // default today
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const lastKey = req.query.lastKey
      ? JSON.parse(String(req.query.lastKey))
      : undefined;

    const result = await getTimelinePosts(date, limit, lastKey);
    res.json(result);
  } catch (err) {
    console.error("Error fetching timeline:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /posts/:postId/like
 * Body: { userId: string, authorId: string }
 */
router.post("/:postId/like", async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { userId, authorId } = req.body as { userId: string; authorId: string };
    if (!userId || !authorId) {
      return res.status(400).json({ message: "userId and authorId required" });
    }

    await likePost(postId, userId, authorId); // transactional like :contentReference[oaicite:5]{index=5}
    res.json({ message: "Post liked" });
  } catch (err: any) {
    // Handle conditional failure (duplicate like) if desired
    console.error("Error liking post:", err);
    res.status(500).json({ message: "Failed to like post", error: String(err) });
  }
});

export default router;
