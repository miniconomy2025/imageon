
export type FollowStatus = "active" | "removed";

export interface Follow {
  follower_id: string;
  followed_id: string;
  follower_username: string;
  followed_username: string;
  created_at: string;
  updated_at?: string;
  status: FollowStatus;
}

export interface CreateFollowInput {
  follower_id: string;
  followed_id: string;
  follower_username: string;
  followed_username: string;
}

export interface MutualFollowsResult {
  follows: Follow[];
  count: number;
  lastEvaluatedKey?: Record<string, any>;
}