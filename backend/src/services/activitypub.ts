import { db, docClient } from './database.js';
// Import configuration so we can perform custom queries
import { config } from '../config/index.js';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

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
            follow_activity_id: followId
        });
    }

    /**
     * Get followers for an actor
     */
    async getFollowers(identifier: string) {
        const followers = await db.queryItems(`FOLLOWER#${identifier}`);
        return followers.map((item: any) => new URL(item.follower_id));
    }

    /**
     * Get following for an actor
     */
    async getFollowing(identifier: string) {
        try {
            const params = {
                TableName: config.dynamodb.tableName,
                IndexName: 'GSI2',
                KeyConditionExpression: 'GSI2PK = :pk AND GSI2SK = :sk',
                ExpressionAttributeValues: {
                    ':pk': `ACTOR#${identifier}`,
                    ':sk': 'FOLLOWING'
                }
            };
            const result = await docClient.send(new QueryCommand(params));
            const items = result.Items ?? [];
            return items.map((item: any) => new URL(item.following_id));
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

        const item: Record<string, any> = {
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
            published: new Date().toISOString()
        };
        if (additionalData && Object.keys(additionalData).length > 0) {
            item.additionalData = additionalData;
        }
        return await db.putItem(item);
    }

    /**
     * Get activities for a specific actor (no caching - let handlers handle caching)
     */
    async getActorActivities(identifier: string) {
        try {
            console.log(`� Fetching activities for actor: ${identifier}`);
            const activities = await db.queryItemsByGSI1(`ACTOR#${identifier}`);
            const result = activities || [];

            // Enhance activities with likes information
            for (const activity of result) {
                if (activity.type === 'Create' && activity.object) {
                    // Get likes for this post/object
                    const likes = await this.getLikesForObject(activity.object);
                    const likesCount = likes.length;

                    // Add likes information to the activity
                    activity.likes = likes.map((like: any) => ({
                        id: like.id,
                        actor: like.actor,
                        object: like.object,
                        published: like.published
                    }));
                    activity.likesCount = likesCount;

                    console.log(`👍 Activity ${activity.id} has ${likesCount} likes`);
                }
            }

            console.log(`✅ Found ${result.length} activities for: ${identifier}`);
            return result;
        } catch (error) {
            console.error(`Error getting activities for ${identifier}:`, error);
            return [];
        }
    }

    /**
     * Get likes for a specific post/object
     */
    async getLikesForObject(objectId: string) {
        try {
            console.log(`👍 Fetching likes for object: ${objectId}`);
            const params = {
                TableName: config.dynamodb.tableName,
                IndexName: 'GSI2',
                KeyConditionExpression: 'GSI2PK = :pk AND GSI2SK > :minTime',
                FilterExpression: '#object = :objectId',
                ExpressionAttributeNames: {
                    '#object': 'object'
                },
                ExpressionAttributeValues: {
                    ':pk': 'LIKE_ACTIVITIES',
                    ':minTime': '2020-01-01T00:00:00.000Z', // Get all likes from 2020 onwards
                    ':objectId': objectId
                }
            };
            const result = await docClient.send(new QueryCommand(params));
            const likes = result.Items ?? [];
            console.log(`✅ Found ${likes.length} likes for object: ${objectId}`);
            return likes;
        } catch (error) {
            console.error(`Error getting likes for object ${objectId}:`, error);
            return [];
        }
    }

    /**
     * Remove a follower relationship (used when processing an Undo of Follow)
     */
    async removeFollower(actorId: string, targetIdentifier: string) {
        const followerIdentifier = this.extractIdentifierFromUri(actorId);
        if (!followerIdentifier || !targetIdentifier) {
            console.error('Could not extract identifiers from URIs for removeFollower:', { actorId, targetIdentifier });
            return false;
        }
        const pk = `FOLLOWER#${targetIdentifier}`;
        const sk = `ACTOR#${followerIdentifier}`;
        const deleted = await db.deleteItem(pk, sk as any);
        if (deleted) {
            console.log(`🗑️ Removed follower ${followerIdentifier} from ${targetIdentifier}`);
        }
        return deleted;
    }

  /**
   * Extract actor identifier from ActivityPub URI
   */
  private extractIdentifierFromUri(uri: string): string | null {
    try {
      const url = new URL(uri);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const usersIndex = pathParts.indexOf('users');
      if (usersIndex !== -1 && pathParts[usersIndex + 1]) {
        return pathParts[usersIndex + 1];
      }
      if (pathParts.length === 1 && pathParts[0].startsWith('@')) {
        return pathParts[0].substring(1);
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
            // Strip port from federation domain for comparison
            const expectedHost = config.federation.domain.split(':')[0];
            return url.hostname === expectedHost;
        } catch {
            return false;
        }
    }
}

// Export a singleton instance
export const activityPub = new ActivityPubService();
