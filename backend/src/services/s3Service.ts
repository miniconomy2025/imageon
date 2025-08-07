// backend/src/services/s3Service.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "../config/index.js";
import { Readable } from "stream";

export class S3Service {
  private client = new S3Client({
    region: process.env.AWS_REGION || config.dynamodb.region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || config.aws.accessKeyId,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || config.aws.secretAccessKey,
    },
  });

  private bucket: string = process.env.AWS_S3_BUCKET || "";
  
  /**
   * Uploads a Buffer or stream to S3 and returns the public URL.
   */
  async uploadMedia(
    key: string,
    body: Buffer | Readable,
    contentType: string,
  ): Promise<string> {
    if (!this.bucket) {
      throw new Error(
        "S3 bucket name is not configured. Set AWS_S3_BUCKET in your environment."
      );
    }

    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: "public-read",
    });
    await this.client.send(cmd);
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }
}
