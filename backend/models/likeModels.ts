/**
 * likeModels.ts
 * Type definitions for likes, pagination, and related operations.
 */

/**
 * Possible statuses for a like.
 */
export type LikeStatus = "active" | "removed";

/**
 * Representation of a like stored in the system.
 * Mirrors the shape of what is persisted in DynamoDB. 
 * @property post_id - ID of the post being liked (partition key)
 * @property user_id - ID of the user who liked (sort key)
 * @property username - Username of the user who liked
 * @property created_at - ISO timestamp of creation
 * @property updated_at - ISO timestamp of last update (optional)
 * @property status - Current status of the like (e.g., active or removed)
 */
export interface Like {
  post_id: string;
  user_id: string;
  username: string;
  created_at: string;
  updated_at?: string;
  status: LikeStatus;
}

/**
 * Input required to create a new like.
 * The service should validate that the user hasn't already liked the post
 * and that required fields are present. :contentReference[oaicite:0]{index=0}
 */
export interface CreateLikeInput {
  post_id: string;
  user_id: string;
  username: string;
}

/**
 * Result for checking if a user has liked a given post.
 */
export interface CheckUserLikeResult {
  hasLiked: boolean;
  userId: string;
  postId: string;
}

/**
 * Result for like count retrieval.
 */
export interface LikeCountResult {
  postId: string;
  count: number;
}

export interface LikesResult {
  likes: Like[];
  count: number;
  lastEvaluatedKey?: Record<string, any>;
}
