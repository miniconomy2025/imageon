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
      console.error('Could not extract identifiers from URIs:', { actorId, targetActorId });
      return false;
    }

    return await db.putItem({
      PK: `FOLLOWER#${targetIdentifier}`,
      SK: `ACTOR#${followerIdentifier}`,
      GSI1PK: 'FOLLOWER_RELATIONSHIP',
      GSI1SK: `${targetIdentifier}#${followerIdentifier}`,
      GSI2PK: `ACTOR#${followerIdentifier}`,
      GSI2SK: 'FOLLOWING',
      follower_id: actorId,
      following_id: targetActorId,
      status: 'accepted',
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
      const following = await db.queryItems('', {
        sortKeyExpression: 'GSI2PK = :gsi2pk AND GSI2SK = :gsi2sk',
        attributeValues: {
          ':gsi2pk': `ACTOR#${identifier}`,
          ':gsi2sk': 'FOLLOWING',
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
  async saveActivity(activityId: string, activityType: string, actorId: string, objectId: string, additionalData?: Record<string, any>) {
    const identifier = this.extractIdentifierFromUri(actorId);
    if (!identifier) {
      console.error('Could not extract identifier from actor URI:', actorId);
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
      console.log(`🔍 Cache miss for activities: ${identifier}, fetching from database`);
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
  private extractIdentifierFromUri(uri: string): string | null {
    try {
      const url = new URL(uri);
      const pathParts = url.pathname.split('/');
      const usersIndex = pathParts.indexOf('users');
      if (usersIndex !== -1 && pathParts[usersIndex + 1]) {
        return pathParts[usersIndex + 1];
      }
      return null;
    } catch (error) {
      console.error('Error parsing URI:', uri, error);
      return null;
    }
  }

  /**
   * Check if actor is local to this server
   */
  isLocalActor(actorUri: string): boolean {
    try {
      const url = new URL(actorUri);
      return url.hostname === 'localhost' || url.hostname.includes('localhost');
    } catch {
      return false;
    }
  }
}

// Export a singleton instance
export const activityPub = new ActivityPubService();
