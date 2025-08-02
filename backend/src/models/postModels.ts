
export interface Post {
  post_id: string;
  author_id: string;
  user_id: string;
  username: string;
  content: string;
  media_url?: string | null;
  media_type?: string | null;
  created_at: string;
  updated_at: string; 
  likes_count: number;
  comments_count: number;
  shares_count: number;
  is_public: boolean;
  status: "active" | "deleted" | "hidden";
  tags: string[];
  location?: string | null;
}

export interface CreatePostInput {
  user_id: string;
  username: string;
  content: string;
  media_url?: string;
  media_type?: string;
  tags?: string[];
  location?: string;
}

export interface UpdatePostInput {
  content?: string;
  media_url?: string | null;
  media_type?: string | null;
  tags?: string[];
  location?: string | null;
  is_public?: boolean;
  status?: "active" | "deleted" | "hidden";
}

export interface LikePostInput {
  postId: string;
  userId: string;
}

export interface LikeUnlikeResult {
  post: Post;
}

export interface PostsResult {
  posts: Post[];
  count: number;
  lastEvaluatedKey?: Record<string, any>;
}
