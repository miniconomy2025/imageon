import { db } from "./database.js";
import { redis } from "./redis.js";

export class ActivityPubService {
  /**
   * Save a follower relationship
   */
  async saveFollower(followId: string, actorId: string, targetActorId: string) {
    // Extract identifier from URIs for cleaner storage
    const followerIdentifier = this.extractIdentifierFromUri(actorId);
    const targetIdentifier = this.extractIdentifierFromUri(targetActorId);

    if (!followerIdentifier || !targetIdentifier) {
      console.error("Could not extract identifiers from URIs:", {
        actorId,
        targetActorId,
      });
      return false;
    }

    return await db.putItem({
      PK: `FOLLOWER#${targetIdentifier}`,
      SK: `ACTOR#${followerIdentifier}`,
      GSI1PK: "FOLLOWER_RELATIONSHIP",
      GSI1SK: `${targetIdentifier}#${followerIdentifier}`,
      GSI2PK: `ACTOR#${followerIdentifier}`,
      GSI2SK: "FOLLOWING",
      follower_id: actorId,
      following_id: targetActorId,
      status: "accepted",
      follow_activity_id: followId,
    });
  }

  /**
   * Get followers for an actor
   */
  async getFollowers(identifier: string) {
    const followers = await db.queryItems(`FOLLOWER#${identifier}`);
    return followers.map((item: any) => item.follower_id);
  }

  /**
   * Get following for an actor
   */
  async getFollowing(identifier: string) {
    try {
      const following = await db.queryItems("", {
        sortKeyExpression: "GSI2PK = :gsi2pk AND GSI2SK = :gsi2sk",
        attributeValues: {
          ":gsi2pk": `ACTOR#${identifier}`,
          ":gsi2sk": "FOLLOWING",
        },
      });
      return following.map((item: any) => item.following_id);
    } catch (error) {
      console.error(`Error getting following for ${identifier}:`, error);
      return [];
    }
  }

  /**
   * Save an activity to the database
   */
  async saveActivity(
    activityId: string,
    activityType: string,
    actorId: string,
    objectId: string,
    additionalData?: Record<string, any>
  ) {
    const identifier = this.extractIdentifierFromUri(actorId);
    if (!identifier) {
      console.error("Could not extract identifier from actor URI:", actorId);
      return false;
    }

    return await db.putItem({
      PK: `ACTIVITY#${activityId}`,
      SK: activityType.toUpperCase(),
      GSI1PK: `ACTOR#${identifier}`,
      GSI1SK: new Date().toISOString(),
      GSI2PK: `${activityType.toUpperCase()}_ACTIVITIES`,
      GSI2SK: new Date().toISOString(),
      id: activityId,
      type: activityType,
      actor: actorId,
      object: objectId,
      published: new Date().toISOString(),
      ...additionalData,
    });
  }

  /**
   * Get activities for a specific actor (with caching)
   */
  async getActorActivities(identifier: string) {
    try {
      // Try to get from cache first
      const cached = await redis.getCachedActorActivities(identifier);
      if (cached) {
        console.log(`🟢 Cache hit for activities: ${identifier}`);
        return cached;
      }

      // Cache miss - get from database
      console.log(
        `🔍 Cache miss for activities: ${identifier}, fetching from database`
      );
      const activities = await db.queryItemsByGSI1(`ACTOR#${identifier}`);
      const result = activities || [];

      // Cache the result for future requests
      await redis.cacheActorActivities(identifier, result, 900); // Cache for 15 minutes
      console.log(`💾 Cached activities for: ${identifier}`);

      return result;
    } catch (error) {
      console.error(`Error getting activities for ${identifier}:`, error);
      return [];
    }
  }

  /**
   * Extract actor identifier from ActivityPub URI
   */
  extractIdentifierFromUri(uri: string): string | null {
    try {
      const url = new URL(uri);
      const pathParts = url.pathname.split("/");
      const usersIndex = pathParts.indexOf("users");
      if (usersIndex !== -1 && pathParts[usersIndex + 1]) {
        return pathParts[usersIndex + 1];
      }
      return null;
    } catch (error) {
      console.error("Error parsing URI:", uri, error);
      return null;
    }
  }

  /**
   * Check if actor is local to this server
   */
  isLocalActor(actorUri: string): boolean {
    try {
      const url = new URL(actorUri);
      return url.hostname === "localhost" || url.hostname.includes("localhost");
    } catch {
      return false;
    }
  }

  /**
   * Create a like activity
   */
  async createLike(actorIdentifier: string, postId: string, url: string) {
    try {
      const timestamp = new Date().toISOString();
      const likeId = `like-${Date.now()}-${actorIdentifier}`;

      const actorUri = new URL(`${url}/users/${actorIdentifier}`);
      const postUri = new URL(`${url}/objects/${postId}`);
      const likeUri = new URL(`${url}/activities/${likeId}`);

      // Check if user already liked this post
      const existingLike = await this.checkUserLikedPost(
        actorIdentifier,
        postId
      );
      if (existingLike) {
        return { error: "User already liked this post", existing: true };
      }

      // Check if post exists
      const post = await db.getItem(`OBJECT#${postId}`, "NOTE");
      if (!post) {
        return { error: "Post not found" };
      }

      // Create the like activity
      const likeData = {
        PK: `ACTIVITY#${likeId}`,
        SK: "LIKE",
        GSI1PK: `OBJECT#${postId}`, // ← For querying likes on this post
        GSI1SK: timestamp, // ← Chronological order
        GSI2PK: "LIKE_ACTIVITIES", // ← For querying all likes
        GSI2SK: timestamp,

        // ActivityPub Like fields
        id: likeUri,
        type: "Like",
        actor: actorUri,
        object: postUri,
        published: timestamp,
      };

      // Save like and update post like count atomically
      const likeSuccess = await db.putItem(likeData);

      if (likeSuccess) {
        // Update post like count
        await this.incrementPostLikeCount(postId);

        // Invalidate caches
        await redis.invalidateActor(actorIdentifier);

        console.log(`✅ Like created: ${actorUri} liked ${postUri}`);
        return {
          success: true,
          likeId,
          likeUri,
          actor: actorUri,
          object: postUri,
        };
      }

      return { error: "Failed to create like" };
    } catch (error) {
      console.error("Error creating like:", error);
      return { error: "Internal error" };
    }
  }

  /**
   * Check if a user already liked a specific post
   */
  async checkUserLikedPost(
    actorIdentifier: string,
    postId: string
  ): Promise<boolean> {
    try {
      // Query all likes for this post and check if this user is among them
      const likes = await db.queryItemsByGSI1(`OBJECT#${postId}`);
      const actorUri = `http://localhost:3000/users/${actorIdentifier}`;

      return likes.some(
        (like: any) => like.SK === "LIKE" && like.actor === actorUri
      );
    } catch (error) {
      console.error("Error checking if user liked post:", error);
      return false;
    }
  }

  /**
   * Get all likes for a specific post
   */
  async getPostLikes(postId: string) {
    try {
      const likes = await db.queryItemsByGSI1(`OBJECT#${postId}`, {
        sortKeyExpression: "SK = :sk",
        attributeValues: {
          ":sk": "LIKE",
        },
      });

      return likes.map((like: any) => ({
        id: like.id,
        actor: like.actor,
        published: like.published,
      }));
    } catch (error) {
      console.error(`Error getting likes for post ${postId}:`, error);
      return [];
    }
  }

  /**
   * Increment post like count
   */
  async incrementPostLikeCount(postId: string) {
    try {
      const post = await db.getItem(`OBJECT#${postId}`, "NOTE");
      if (post) {
        const updatedPost = {
          ...post,
          likes_count: (post.likes_count || 0) + 1,
          updated_at: new Date().toISOString(),
        };
        await db.putItem(updatedPost);
      }
    } catch (error) {
      console.error("Error incrementing like count:", error);
    }
  }

  /**
   * Create a new post (Note) and associated Create activity
   */
  async createPost(
    actorIdentifier: string,
    content: string,
    options: {
      mediaUrls?: string[];
      hashtags?: string[];
      mentions?: string[];
      visibility?: "public" | "followers" | "private";
    } = {}
  ) {
    try {
      const timestamp = new Date().toISOString();
      const postId = `post-${Date.now()}-${actorIdentifier}`;
      const activityId = `activity-create-${Date.now()}-${actorIdentifier}`;

      const actorUri = `http://localhost:3000/users/${actorIdentifier}`;
      const postUri = `http://localhost:3000/objects/${postId}`;
      const activityUri = `http://localhost:3000/activities/${activityId}`;

      // 1. Create the Note/Post object
      const postData = {
        PK: `OBJECT#${postId}`,
        SK: "NOTE",
        GSI1PK: `ACTOR#${actorIdentifier}`, // ← For user's posts query
        GSI1SK: timestamp, // ← Chronological order
        GSI2PK: "PUBLIC_POSTS", // ← For public timeline
        GSI2SK: timestamp,

        // ActivityPub Note fields
        id: postUri,
        type: "Note",
        attributedTo: actorUri,
        content: content,
        published: timestamp,
        to:
          options.visibility === "public"
            ? ["https://www.w3.org/ns/activitystreams#Public"]
            : [],
        cc: options.visibility === "followers" ? [`${actorUri}/followers`] : [],

        // Additional metadata
        attachment: options.mediaUrls || [],
        tag: [
          ...(options.hashtags || []).map((tag) => ({
            type: "Hashtag",
            name: tag,
            href: `http://localhost:3000/tags/${tag.replace("#", "")}`,
          })),
          ...(options.mentions || []).map((mention) => ({
            type: "Mention",
            name: mention,
          })),
        ],

        // Engagement counters
        likes_count: 0,
        replies_count: 0,
        shares_count: 0,
      };

      // 2. Create the Create activity
      const activityData = {
        PK: `ACTIVITY#${activityId}`,
        SK: "CREATE",
        GSI1PK: `ACTOR#${actorIdentifier}`, // ← For user's activities
        GSI1SK: timestamp,
        GSI2PK: "CREATE_ACTIVITIES", // ← For all post activities
        GSI2SK: timestamp,

        // ActivityPub Create fields
        id: activityUri,
        type: "Create",
        actor: actorUri,
        object: postUri,
        published: timestamp,
        to: postData.to,
        cc: postData.cc,
      };

      // 3. Save both in a transaction
      const success = await Promise.all([
        db.putItem(postData),
        db.putItem(activityData),
      ]);

      if (success.every(Boolean)) {
        // 4. Invalidate caches
        await redis.invalidateActor(actorIdentifier);

        console.log(`✅ Post created: ${postUri}`);
        return { postId, postUri, activityId, activityUri };
      }

      return null;
    } catch (error) {
      console.error("Error creating post:", error);
      return null;
    }
  }
}

// Export a singleton instance
export const activityPub = new ActivityPubService();
