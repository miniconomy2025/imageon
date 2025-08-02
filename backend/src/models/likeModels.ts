
export type LikeStatus = "active" | "removed";

export interface Like {
  post_id: string;
  user_id: string;
  username: string;
  created_at: string;
  updated_at?: string;
  status: LikeStatus;
}

export interface CreateLikeInput {
  post_id: string;
  user_id: string;
  username: string;
}

export interface CheckUserLikeResult {
  hasLiked: boolean;
  userId: string;
  postId: string;
}

export interface LikeCountResult {
  postId: string;
  count: number;
}

export interface LikesResult {
  likes: Like[];
  count: number;
  lastEvaluatedKey?: Record<string, any>;
}