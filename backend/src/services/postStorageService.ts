// src/services/postStorageService.ts

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";

dotenv.config();

// Configure S3 / MinIO client
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "minioadmin",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "minioadmin",
  },
  forcePathStyle: true, // required for MinIO compatibility. :contentReference[oaicite:1]{index=1}
});

/**
 * Uploads media (image/video) for a post to the given bucket.
 * @param bucket Name of bucket (e.g., "posts")
 * @param key Object key (e.g., "post-media/post123.jpg")
 * @param body Buffer or stream
 * @param contentType MIME type like "image/jpeg"
 */
export async function uploadPostMedia(
  bucket: string,
  key: string,
  body: Buffer | Uint8Array | Blob,
  contentType: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body as any,
      ContentType: contentType,
    })
  );
}

/**
 * Generates a presigned GET URL for media so clients can fetch it directly.
 * @param bucket
 * @param key
 * @param expiresInSeconds defaults to 1 hour
 */
export async function getPostMediaUrl(
  bucket: string,
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return await getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds }); // presigned URL generation :contentReference[oaicite:2]{index=2}
}

/**
 * Deletes media object.
 */
export async function deletePostMedia(bucket: string, key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}
