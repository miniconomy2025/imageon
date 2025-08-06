import { Follow, Accept, Like, Undo } from "@fedify/fedify";
import { ActorModel } from "../models/Actor.js";
import { crypto } from "../services/cryptography.js";
import { activityPub } from "../services/activitypub.js";
import { redis } from "../services/redis.js";
import { randomUUID } from "crypto";

const OUTBOX_PAGE_SIZE = 10;

export class FederationHandlers {
  /**
   * Actor dispatcher - handles requests for actor profiles
   */
  static async handleActorRequest(ctx: any, identifier: string) {
    try {
      // Rate limiting check
      const clientIp = ctx.request?.headers?.get?.('x-forwarded-for') || 
                      ctx.request?.headers?.get?.('x-real-ip') || 
                      'unknown';
      const rateLimitKey = `rate_limit:actor:${clientIp}`;
      const rateLimit = await redis.checkRateLimit(rateLimitKey, 100, 3600); // 100 requests per hour

      if (!rateLimit.allowed) {
        console.log(`⚠️ Rate limit exceeded for actor request: ${clientIp} (${identifier})`);
        return null; // This will result in a 404, which is better than exposing rate limiting
      }

      console.log(`🔍 Actor request for identifier: ${identifier} (remaining: ${rateLimit.remaining})`);
      
      // Check if actor exists in our database
      const actorData = await ActorModel.getActor(identifier);
      if (!actorData) {
        console.log(`❌ Actor not found: ${identifier}`);
        return null;
      }

      console.log(`✅ Actor found: ${identifier}`);

      // Get actor key pairs using Fedify's context method
      const keys = await ctx.getActorKeyPairs(identifier);
      console.log(`🔑 Key pairs retrieved for: ${identifier}`, keys.length > 0 ? 'SUCCESS' : 'FAILED');
      
      // Create and return the Person object using Fedify's standard pattern
      const person = await ActorModel.createPersonObject(ctx, identifier, actorData, keys);
      console.log(`👤 Person object created for: ${identifier}`);
      
      // Add detailed debugging for the Person object
      try {
        console.log(`🔍 Person object type: ${typeof person}`);
        console.log(`🔍 Person object constructor: ${person.constructor.name}`);
        console.log(`🔍 Person object has publicKeyId: ${!!person.publicKeyId}`);
        console.log(`🔍 Person object id: ${person.id}`);
        
        // Test if the object can be serialized safely
        const testSerialization = JSON.stringify({
          id: person.id?.toString(),
          name: person.name?.toString(),
          hasPublicKeyId: !!person.publicKeyId
        });
        console.log(`🔍 Basic serialization test: ${testSerialization}`);
        
      } catch (debugError) {
        console.error(`❌ Error during Person object debugging:`, debugError);
      }
      
      return person;
    } catch (error) {
      console.error(`❌ Error in handleActorRequest for ${identifier}:`, error);
      if (error instanceof Error) {
        console.error('Stack trace:', error.stack);
      }
      return null;
    }
  }

  /**
   * Key pairs dispatcher - handles cryptographic keys for actors
   */
  static async handleKeyPairsRequest(ctx: any, identifier: string) {
    // Check if actor exists
    const exists = await crypto.actorExists(identifier);
    if (!exists) {
      console.log(`Key pairs requested for non-existent actor: ${identifier}`);
      return [];
    }

    // Get or generate key pairs
    return await crypto.getOrGenerateKeyPairs(identifier);
  }

  /**
   * Follow activity handler
   */
  static async handleFollowActivity(ctx: any, follow: Follow) {
    if (follow.id == null || follow.actorId == null || follow.objectId == null) {
      console.log('Invalid follow activity: missing required fields');
      return;
    }

    // Parse the target actor from the follow object
    const parsed = ctx.parseUri(follow.objectId);
    if (parsed?.type !== "actor") {
      console.log('Follow target is not an actor:', follow.objectId);
      return;
    }

    // Check if the target actor exists in our system
    const targetExists = await ActorModel.exists(parsed.identifier);
    if (!targetExists) {
      console.log(`Follow target actor not found: ${parsed.identifier}`);
      return;
    }

    // Get the follower actor information
    const follower = await follow.getActor(ctx);
    if (follower == null) {
      console.log('Could not retrieve follower actor');
      return;
    }

    try {
      // Store the follower relationship
      await activityPub.saveFollower(
        follow.id.href, 
        follow.actorId.href, 
        follow.objectId.href
      );

      await activityPub.saveFollower(
        follow.id.href,
        follow.actorId.href,
        follow.objectId.href
      );

      await activityPub.saveActivity(
        randomUUID(),  
        'Accept',
        follow.objectId.href,  
        follow.id.href,   
        { 
          accepted_at: new Date().toISOString()
        }
      );

      const acceptActivity = new Accept({
        actor: follow.objectId, 
        object: follow    
      });
      await ctx.sendActivity(
        { identifier: parsed.identifier },
        acceptActivity
      );

      console.log(`✅ Auto-accepted follow: ${follow.actorId.href} → ${follow.objectId.href}`);

      console.log(`✅ Follow accepted: ${follow.actorId.href} -> ${follow.objectId.href}`);
    } catch (error) {
      console.error('Error processing follow activity:', error);
    }
  }

  /**
   * Accept activity handler
   * Handles incoming Accept activities which acknowledge a follow request
   */
  static async handleAcceptActivity(ctx: any, accept: Accept) {
    try {
      if (!accept || !accept.id || !accept.actorId || !accept.objectId) {
        console.log('Invalid Accept activity: missing required fields');
        return;
      }
      // Save the Accept activity in our database for audit purposes
      const activityId = accept.id.href ?? String(accept.id);
      const actorId = accept.actorId.href ?? String(accept.actorId);
      // The object of an Accept is usually the Follow activity being accepted
      await activityPub.saveActivity(activityId, 'Accept', actorId, String(accept.objectId?.href));
      console.log(`✅ Accept processed: ${actorId} accepted ${String(accept.objectId?.href)}`);
    } catch (error) {
      console.error('Error processing Accept activity:', error);
    }
  }

  /**
   * Like activity handler
   * Handles incoming Like activities on our posts
   */
  static async handleLikeActivity(ctx: any, like: any) {
    try {
      if (!like || !like.id || !like.actorId || !like.objectId) {
        console.log('Invalid Like activity: missing required fields');
        return;
      }
      const activityId = like.id.href ?? String(like.id);
      const actorId = like.actorId.href ?? String(like.actorId);
      const objectId = like.objectId.href ?? String(like.objectId);
      await activityPub.saveActivity(activityId, 'Like', actorId, objectId);
      console.log(`👍 Like received from ${actorId} on ${objectId}`);
    } catch (error) {
      console.error('Error processing Like activity:', error);
    }
  }

  /**
   * Undo activity handler
   * Handles incoming Undo activities (e.g. unfollow)
   */
  static async handleUndoActivity(ctx: any, undo: any) {
    try {
      if (!undo || !undo.id || !undo.actorId || !undo.object) {
        console.log('Invalid Undo activity: missing required fields');
        return;
      }
      const object = undo.object;
      // If the object is a Follow, remove the follower relationship
      if (object.type === 'Follow' && object.actor && object.object) {
        const followerId = object.actor.href ?? String(object.actor);
        const targetId = object.object.href ?? String(object.object);
        await activityPub.removeFollower(followerId, targetId);
        console.log(`👋 Unfollow processed: ${followerId} -> ${targetId}`);
        // Save the Undo activity
        const activityId = undo.id.href ?? String(undo.id);
        await activityPub.saveActivity(activityId, 'Undo', followerId, targetId);
      } else {
        // Other undo types can simply be recorded
        const activityId = undo.id.href ?? String(undo.id);
        const actorId = undo.actorId.href ?? String(undo.actorId);
        const objectId = object.id?.href ?? object.objectId?.href ?? String(object);
        await activityPub.saveActivity(activityId, 'Undo', actorId, objectId);
        console.log(`🔁 Undo received for unsupported type: ${JSON.stringify(object)}`);
      }
    } catch (error) {
      console.error('Error processing Undo activity:', error);
    }
  }

  /**
   * Outbox dispatcher - handles requests for actor outboxes
   */
  static async handleOutboxRequest(ctx: any, identifier: string, cursor?: string | null) {
    try {
      // Rate limiting check
      const clientIp = ctx?.request?.headers?.get?.('x-forwarded-for') || 
                      ctx?.request?.headers?.get?.('x-real-ip') || 
                      'unknown';
      const rateLimitKey = `rate_limit:outbox:${clientIp}`;
      const rateLimit = await redis.checkRateLimit(rateLimitKey, 50, 3600); // 50 requests per hour

      if (!rateLimit.allowed) {
        console.log(`⚠️ Rate limit exceeded for outbox request: ${clientIp} (${identifier})`);
        return null;
      }

      console.log(`📤 Outbox request for identifier: ${identifier}, cursor: ${cursor} (remaining: ${rateLimit.remaining})`);
      
      // Check if actor exists
      const exists = await ActorModel.exists(identifier);
      if (!exists) {
        console.log(`❌ Actor not found for outbox: ${identifier}`);
        return null;
      }

      const allActivities = await activityPub.getActorActivities(identifier);

      const sortedActivities = allActivities
        .slice()
        .sort((a: any, b: any) => {
          const aTime = a?.published ? new Date(a.published).getTime() : 0;
          const bTime = b?.published ? new Date(b.published).getTime() : 0;
          return bTime - aTime;
        });

      let offset = 0;
      if (typeof cursor === 'string' && cursor.trim() !== '') {
        const parsed = parseInt(cursor, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < sortedActivities.length) {
          offset = parsed;
        }
      }

      const endIndex = Math.min(offset + OUTBOX_PAGE_SIZE, sortedActivities.length);
      const pageActivities = sortedActivities.slice(offset, endIndex);

      const activityItems = pageActivities.map((activity: any) => ({
        id: activity.id,
        type: activity.type,
        actor: activity.actor,
        published: activity.published,
        object: activity.object,
        ...(activity.additionalData || {})
      }));

      const nextCursor = endIndex < sortedActivities.length ? String(endIndex) : null;

      return {
        items: activityItems,
        next: nextCursor,
      };
    } catch (error) {
      console.error(`❌ Error in handleOutboxRequest for ${identifier}:`, error);
      if (error instanceof Error) {
        console.error('Stack trace:', error.stack);
      }
      return null;
    }
  }
}

export const handleAcceptActivity = FederationHandlers.handleAcceptActivity;
export const handleLikeActivity = FederationHandlers.handleLikeActivity;
export const handleUndoActivity = FederationHandlers.handleUndoActivity;
