
export type UserStatus = "active" | "suspended" | "deleted";

export interface User {
  user_id: string;
  username: string;
  email: string;
  display_name: string;
  bio: string;
  profile_image_url?: string | null;
  created_at: string;
  updated_at: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_verified: boolean;
  is_private: boolean;
  status: UserStatus;
}

export interface CreateUserInput {
  username: string;
  email: string;
  display_name: string;
  bio?: string;
}

export interface UpdateUserInput {
  display_name?: string;
  bio?: string;
  profile_image_url?: string | null;
  is_private?: boolean;
  status?: UserStatus;
}