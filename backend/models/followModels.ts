/**
 * followModels.ts
 * Type definitions for follow relationships and pagination.
 */

export type FollowStatus = "active" | "removed";

/**
 * A follow relationship between two users.
 * - follower_id is the user who is doing the following.
 * - followed_id is the user being followed.
 * This mirrors standard social media semantics. :contentReference[oaicite:0]{index=0}
 */
export interface Follow {
  follower_id: string;
  followed_id: string;
  follower_username: string;
  followed_username: string;
  created_at: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
  status: FollowStatus; // e.g., "active" or "removed"
}

/**
 * Input required to create a follow relationship.
 * Prevents self-following, and callers should validate presence of all fields. :contentReference[oaicite:1]{index=1}
 */
export interface CreateFollowInput {
  follower_id: string;
  followed_id: string;
  follower_username: string;
  followed_username: string;
}

/**
 * Result of mutual follows for a user (users who both follow and are followed).
 */
export interface MutualFollowsResult {
  follows: Follow[]; // mutual follow relationships
  count: number;
  lastEvaluatedKey?: Record<string, any>;
}
