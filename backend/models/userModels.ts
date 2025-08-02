/**
 * userModels.ts
 * Type definitions for user domain objects and related operations.
 */

/**
 * Possible statuses for a user.
 */
export type UserStatus = "active" | "suspended" | "deleted";

/**
 * Full user object as stored in DynamoDB.
 */
export interface User {
  user_id: string;
  username: string;
  email: string;
  display_name: string;
  bio: string;
  profile_image_url?: string | null;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_verified: boolean;
  is_private: boolean;
  status: UserStatus; // soft delete uses 'deleted' flag. :contentReference[oaicite:1]{index=1}
}

/**
 * Input required to create a new user.
 * Required: username, email, display_name. Optional: bio. :contentReference[oaicite:2]{index=2}
 */
export interface CreateUserInput {
  username: string;
  email: string;
  display_name: string;
  bio?: string;
}

/**
 * Fields allowed to be updated on a user profile.
 * Excludes immutable identifiers. :contentReference[oaicite:3]{index=3}
 */
export interface UpdateUserInput {
  display_name?: string;
  bio?: string;
  profile_image_url?: string | null;
  is_private?: boolean;
  // status might be toggled to 'deleted' for soft delete. :contentReference[oaicite:4]{index=4}
  status?: UserStatus;
}
