import fs from "fs";
import path from "path";
import { uploadPostMedia, getPostMediaUrl } from "../services/postStorageService";

async function demo() {
  const bucket = "posts";
  const key = "post-images/image1.jpg";
  const fileBuffer = fs.readFileSync(path.resolve("assets/sample.jpg"));

  await uploadPostMedia(bucket, key, fileBuffer, "image/jpeg");

  const url = await getPostMediaUrl(bucket, key);
  console.log("Accessible at (presigned):", url);
}

demo().catch(console.error);
