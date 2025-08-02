/**
 * postModels.ts
 * Type definitions for posts, pagination, and related operations.
 */

/**
 * Full post object as stored/retrieved.
 */
export interface Post {
  post_id: string;
  author_id: string; // used as sort key in some patterns
  user_id: string; // compatibility / creator ID
  username: string;
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  likes_count: number;
  comments_count: number;
  shares_count: number;
  is_public: boolean;
  status: "active" | "deleted" | "hidden";
  tags: string[];
  location?: string | null;
}

/**
 * Input required to create a new post.
 * Required: user_id, username, content. Optional: media, tags, location. :contentReference[oaicite:0]{index=0}
 */
export interface CreatePostInput {
  user_id: string;
  username: string;
  content: string;
  media_url?: string;
  media_type?: string;
  tags?: string[];
  location?: string;
}

/**
 * Fields allowed to be updated on a post.
 * Excludes immutable fields like post_id, user_id, created_at. :contentReference[oaicite:1]{index=1}
 */
export interface UpdatePostInput {
  content?: string;
  media_url?: string | null;
  media_type?: string | null;
  tags?: string[];
  location?: string | null;
  is_public?: boolean;
  status?: "active" | "deleted" | "hidden";
}

/**
 * Input for liking/unliking a post.
 */
export interface LikePostInput {
  postId: string;
  userId: string;
}

/**
 * Result when like/unlike returns the updated post.
 */
export interface LikeUnlikeResult {
  post: Post;
}

export interface PostsResult {
  posts: Post[];
  count: number;
  lastEvaluatedKey?: Record<string, any>;
}

