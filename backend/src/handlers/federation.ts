import { Follow, Accept, Article, RequestContext, Context, InboxContext, Undo, Announce, Update, Delete, Recipient, Like, Create, Note } from '@fedify/fedify';
import { RedisKvStore } from '@fedify/redis';
import { Temporal } from '@js-temporal/polyfill';
import { ActorModel } from '../models/Actor.js';
import { crypto } from '../services/cryptography.js';
import { activityPub } from '../services/activitypub.js';
import { redis } from '../services/redis.js';
import { randomUUID } from 'crypto';
import { FederationCache, CacheKeys } from '../utils/cache.js';
import { db } from '../services/database.js';
import { config } from '../config/index.js';

// Define context data type to include KV store access
interface ContextData {
    kv: RedisKvStore;
}

const ACTIVITY_CONSTRUCTORS = {
    Create: Create,
    Follow: Follow,
    Accept: Accept,
    Like: Like,
    Undo: Undo,
    Announce: Announce,
    Update: Update,
    Delete: Delete
} as const;

const OBJECT_CONSTRUCTORS = {
    Note: Note,
    Article: Article
} as const;

const OUTBOX_PAGE_SIZE = 10;

export class FederationHandlers {
    static async isRateLimitExceeded(ctx: RequestContext<ContextData>, key: string, limit: number, period: number) {
        const clientIp = ctx.request?.headers?.get?.('x-forwarded-for') || ctx.request?.headers?.get?.('x-real-ip') || 'unknown';
        const rateLimitKey = CacheKeys.RATE_LIMIT.actor(clientIp);
        const rateLimit = await redis.checkRateLimit(rateLimitKey, limit, period);
        if (!rateLimit.allowed) {
            console.log(`⚠️ Rate limit exceeded for ${key}: ${clientIp} (${rateLimit.remaining} remaining)`);
            return true;
        }

        console.log(`✅ Rate limit OK for ${key}: ${clientIp} (${rateLimit.remaining} remaining)`);
        return false;
    }

    /**
     * Actor dispatcher - handles requests for actor profiles
     */
    static async handleActorRequest(ctx: RequestContext<ContextData>, identifier: string) {
        try {
            // Rate limiting check
            const isRateLimited = await FederationHandlers.isRateLimitExceeded(ctx, CacheKeys.RATE_LIMIT.actor(identifier), 100, 3600);

            if (isRateLimited) {
                return null; // Rate limit exceeded
            }

            // 🎯 TRY CACHE FIRST - Cache actor profiles for better performance
            const cacheKey = CacheKeys.FEDERATION.actor(identifier);
            const ttlSeconds = FederationCache.TTL.ACTOR_PROFILE;
            const ttl = Temporal.Duration.from({ seconds: ttlSeconds });

            try {
                const cached = await ctx.data.kv.get<string>(cacheKey);
                if (cached) {
                    console.log(`🎯 Cache HIT for actor: ${identifier}`);
                    console.log(`🔍 Cached actor profile:`, cached);
                    // return JSON.parse(cached);
                }
            } catch (cacheError) {
                console.warn(`⚠️ Cache error for actor ${identifier}:`, cacheError);
            }

            console.log(`💾 Cache MISS for actor: ${identifier} - creating fresh`);

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

            // 💿 CACHE THE RESULT
            try {
                await ctx.data.kv.set(cacheKey, JSON.stringify(person), { ttl });
                console.log(`💿 Cached actor profile for: ${identifier}`);
            } catch (cacheError) {
                console.warn(`⚠️ Failed to cache actor ${identifier}:`, cacheError);
            }

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
     * Following dispatcher - handles requests for actor following collection
     */
    static async handleFollowingRequest(ctx: RequestContext<ContextData>, identifier: string, cursor?: string | null) {
        try {
            const isRateLimited = await FederationHandlers.isRateLimitExceeded(ctx, CacheKeys.RATE_LIMIT.followers(identifier), 100, 3600);

            if (isRateLimited) {
                return null; // Rate limit exceeded
            }

            const following = await activityPub.getFollowing(identifier);

            if (following.length === 0) {
                console.log(`🔄 No following found for: ${identifier}`);
                return {
                    items: [],
                    next: null
                };
            }
            return {
                items: following
            };
        } catch (error) {
            console.error(`❌ Error in handleFollowingRequest for ${identifier}:`, error);
            if (error instanceof Error) {
                console.error('Stack trace:', error.stack);
            }
            return null;
        }
    }

    /**
     * Key pairs dispatcher - handles cryptographic keys for actors
     */
    static async handleKeyPairsRequest(ctx: Context<ContextData>, identifier: string) {
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
    static async handleFollowActivity(ctx: InboxContext<ContextData>, follow: Follow) {
        if (follow.id == null || follow.actorId == null || follow.objectId == null) {
            console.log('Invalid follow activity: missing required fields');
            return;
        }

        // Parse the target actor from the follow object
        const parsed = ctx.parseUri(follow.objectId);
        if (parsed?.type !== 'actor') {
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
            await activityPub.saveFollower(follow.id?.href, follow.actorId?.href, follow.objectId?.href);

            await activityPub.saveActivity(follow.id?.href, 'Follow', follow.actorId?.href, follow.objectId?.href, {
                accepted_at: new Date().toISOString()
            });

            // 🔥 CACHE INVALIDATION: Clear cached data using utility
            const targetIdentifier = parsed.identifier;
            await FederationCache.invalidateFollowerCache(ctx.data.kv, targetIdentifier);

            // Also invalidate activities cache since follow relationships affect outbox
            const activitiesKey = CacheKeys.FEDERATION.activities(targetIdentifier);
            await ctx.data.kv.delete(activitiesKey);
            console.log(`🗑️ Cache invalidated for activities: ${targetIdentifier}`);

            await ctx.sendActivity(
                { identifier: parsed.identifier },
                follower,
                new Accept({
                    id: new URL(`#accepts${follow.id?.href}`, ctx.getActorUri(parsed.identifier)),
                    actor: follow.objectId,
                    object: follow
                })
            );

            //save the accept activity in our database
            await FederationHandlers.handleAcceptActivity(
                ctx,
                new Accept({
                    id: new URL(`#accepts${follow.id?.href}`, ctx.getActorUri(parsed.identifier)),
                    actor: follow.objectId,
                    object: follow
                })
            );

            console.log(`✅ Follow auto accepted: ${follow.actorId?.href} -> ${follow.objectId?.href}`);
        } catch (error) {
            console.error('Error processing follow activity:', error);
        }
    }

    /**
     * Accept activity handler
     * Handles incoming Accept activities which acknowledge a follow request
     */
    static async handleAcceptActivity(ctx: InboxContext<ContextData>, accept: Accept) {
        try {
            if (!accept?.id || !accept?.actorId || !accept?.objectId) {
                console.log('Invalid Accept activity: missing required fields');
                return;
            }
            // Save the Accept activity in our database for audit purposes
            const activityId = accept.id?.href ?? String(accept.id);
            const actorId = accept.actorId?.href ?? String(accept.actorId);
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
    static async handleLikeActivity(ctx: InboxContext<ContextData>, like: any) {
        try {
            if (!like?.id || !like?.actorId || !like?.objectId) {
                console.log('Invalid Like activity: missing required fields');
                return;
            }
            const activityId = like.id?.href ?? String(like.id);
            const actorId = like.actorId?.href ?? String(like.actorId);
            const objectId = like.objectId?.href ?? String(like.objectId);
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
    static async handleUndoActivity(ctx: InboxContext<ContextData>, undo: any) {
        try {
            if (!undo?.id || !undo?.actorId || !undo?.object) {
                console.log('Invalid Undo activity: missing required fields');
                return;
            }
            const object = undo.object;
            // If the object is a Follow, remove the follower relationship
            if (object.type === 'Follow' && object.actor && object.object) {
                const followerId = object.actor?.href ?? String(object.actor);
                const targetId = object.object?.href ?? String(object.object);
                await activityPub.removeFollower(followerId, targetId);
                console.log(`👋 Unfollow processed: ${followerId} -> ${targetId}`);

                // 🔥 CACHE INVALIDATION: Clear cached data
                try {
                    // Extract identifier from target URI
                    const targetUrl = new URL(targetId);
                    const pathParts = targetUrl.pathname.split('/');
                    const usersIndex = pathParts.indexOf('users');
                    if (usersIndex !== -1 && pathParts[usersIndex + 1]) {
                        const targetIdentifier = pathParts[usersIndex + 1];
                        await ctx.data.kv.delete(CacheKeys.FEDERATION.followers(targetIdentifier));
                        await ctx.data.kv.delete(CacheKeys.FEDERATION.followersCount(targetIdentifier));

                        // Also invalidate activities cache
                        const activitiesKey = CacheKeys.FEDERATION.activities(targetIdentifier);
                        await ctx.data.kv.delete(activitiesKey);

                        console.log(`🗑️ Cache invalidated for unfollow of: ${targetIdentifier}`);
                    }
                } catch (cacheError) {
                    console.warn(`⚠️ Failed to invalidate cache for unfollow:`, cacheError);
                }

                // Save the Undo activity
                const activityId = undo.id?.href ?? String(undo.id);
                await activityPub.saveActivity(activityId, 'Undo', followerId, targetId);
            } else {
                // Other undo types can simply be recorded
                const activityId = undo.id?.href ?? String(undo.id);
                const actorId = undo.actorId?.href ?? String(undo.actorId);
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
    static async handleOutboxRequest(ctx: RequestContext<ContextData>, identifier: string, cursor?: string | null) {
        try {
            // Rate limiting check
            console.log(`📤 Outbox request for identifier: ${identifier}, cursor: ${cursor}`);
            const isRateLimited = await FederationHandlers.isRateLimitExceeded(ctx, CacheKeys.RATE_LIMIT.outbox(identifier), 100, 3600);

            if (isRateLimited) {
                return null; // Rate limit exceeded
            }
            // Check if actor exists
            const exists = await ActorModel.exists(identifier);
            if (!exists) {
                console.log(`❌ Actor not found for outbox: ${identifier}`);
                return null;
            }

            // Try to get activities from cache first
            const cacheKey = CacheKeys.FEDERATION.activities(identifier);
            const ttlSeconds = FederationCache.TTL.ACTIVITIES;
            const ttl = Temporal.Duration.from({ seconds: ttlSeconds });
            let allActivities;

            try {
                const cached = await ctx.data.kv.get<string>(cacheKey);
                if (cached) {
                    console.log(`🎯 Cache HIT for activities: ${identifier}`);
                    allActivities = JSON.parse(cached);
                } else {
                    console.log(`💾 Cache MISS for activities: ${identifier} - fetching from database`);
                    allActivities = await activityPub.getActorActivities(identifier);

                    // Cache the result
                    await ctx.data.kv.set(cacheKey, JSON.stringify(allActivities), { ttl });
                    console.log(`💿 Cached activities for ${identifier} (${allActivities.length} items)`);
                }
            } catch (cacheError) {
                console.warn(`⚠️ Cache error for activities ${identifier}, falling back to database:`, cacheError);
                allActivities = await activityPub.getActorActivities(identifier);
            }
            console.log(`All Activities for ${identifier}:`, allActivities);

            // Debug: Check published field format
            if (allActivities.length > 0) {
                console.log(`🔍 Sample activity published field:`, {
                    activityId: allActivities[0]?.id,
                    published: allActivities[0]?.published,
                    publishedType: typeof allActivities[0]?.published,
                    isString: typeof allActivities[0]?.published === 'string',
                    isDate: allActivities[0]?.published instanceof Date
                });
            }
            const sortedActivities = allActivities.slice().sort((a: any, b: any) => {
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

            const postActivities = pageActivities
                .map((activity: any) => {
                    try {
                        const ActivityClass = ACTIVITY_CONSTRUCTORS[activity.type as keyof typeof ACTIVITY_CONSTRUCTORS];

                        if (!ActivityClass) {
                            console.warn(`⚠️ Unknown activity type: ${activity.type}`);
                            return null;
                        }

                        // Handle different activity types
                        switch (activity.type) {
                            case 'Create': {
                                // For Create activities, we need to construct the object too
                                const objectType = activity.object?.type || 'Note';
                                const ObjectClass = OBJECT_CONSTRUCTORS[objectType as keyof typeof OBJECT_CONSTRUCTORS] || Note;

                                return new Create({
                                    id: new URL(activity.id),
                                    actor: ctx.getActorUri(identifier),
                                    published: Temporal.Instant.from(activity.published || new Date().toISOString()),
                                    object: new ObjectClass({
                                        id: new URL(activity.object?.id || activity.id),
                                        content: activity.object?.content || activity.additionalData?.content,
                                        published: Temporal.Instant.from(activity.published || new Date().toISOString())
                                    })
                                });
                            }

                            case 'Follow':
                                return new Follow({
                                    id: new URL(activity.id),
                                    actor: new URL(activity.actor),
                                    object: new URL(activity.object),
                                    published: Temporal.Instant.from(activity.published || new Date().toISOString())
                                });

                            case 'Like':
                                return new Like({
                                    id: new URL(activity.id),
                                    actor: new URL(activity.actor),
                                    object: new URL(activity.object),
                                    published: Temporal.Instant.from(activity.published || new Date().toISOString())
                                });

                            default:
                                // Generic activity creation
                                return new ActivityClass({
                                    id: new URL(activity.id),
                                    actor: new URL(activity.actor),
                                    object: new URL(activity.object),
                                    published: new Date(activity.published),
                                    ...activity.additionalData
                                });
                        }
                    } catch (error) {
                        console.error(`❌ Error processing activity ${activity?.id}:`, error);
                        return null;
                    }
                })
                .filter(Boolean);

            const nextCursor = endIndex < sortedActivities.length ? String(endIndex) : null;

            return {
                items: [...postActivities],
                next: nextCursor
            };
        } catch (error) {
            console.error(`❌ Error in handleOutboxRequest for ${identifier}:`, error);
            if (error instanceof Error) {
                console.error('Stack trace:', error.stack);
            }
            return null;
        }
    }

    /**
     * Followers dispatcher - handles requests for actor followers collection
     */
    static async handleFollowersRequest(ctx: Context<ContextData>, identifier: string, cursor?: string | null) {
        try {
            console.log(`👥 Followers request for identifier: ${identifier}, cursor: ${cursor}`);

            // Check if actor exists
            const exists = await ActorModel.exists(identifier);
            if (!exists) {
                console.log(`❌ Actor not found for followers: ${identifier}`);
                return null;
            }

            // Try to get followers from cache first
            const cacheKey = CacheKeys.FEDERATION.followers(identifier);
            const ttlSeconds = FederationCache.TTL.FOLLOWERS;
            const ttl = Temporal.Duration.from({ seconds: ttlSeconds });

            let allFollowers;
            try {
                // Use Fedify's KV store (Redis) for caching
                const cached = await ctx.data.kv.get<string>(cacheKey);
                if (cached) {
                    console.log(`🎯 Cache HIT for followers: ${identifier}`);
                    const parsed = JSON.parse(cached);
                    allFollowers = parsed.map((url: string) => new URL(url));
                } else {
                    console.log(`💾 Cache MISS for followers: ${identifier} - fetching from database`);
                    // Get followers from database
                    allFollowers = await activityPub.getFollowers(identifier);

                    // Cache the result
                    await ctx.data.kv.set(cacheKey, JSON.stringify(allFollowers), { ttl });
                    console.log(`💿 Cached followers for ${identifier} (${allFollowers.length} items)`);
                }
            } catch (cacheError) {
                console.warn(`⚠️ Cache error for ${identifier}, falling back to database:`, cacheError);
                allFollowers = await activityPub.getFollowers(identifier);
            }

            //if not cursor, return all followers
            if (!cursor) {
                return null; // Return all followers without pagination
            }
            // Parse cursor for pagination
            let offset = 0;
            const pageSize = 20; // Standard page size for followers

            if (typeof cursor === 'string' && cursor.trim() !== '') {
                const parsed = parseInt(cursor, 10);
                if (!isNaN(parsed) && parsed >= 0 && parsed < allFollowers.length) {
                    offset = parsed;
                }
            }

            const endIndex = Math.min(offset + pageSize, allFollowers.length);
            const pageFollowers = allFollowers.slice(offset, endIndex);

            const nextCursor = endIndex < allFollowers.length ? String(endIndex) : null;

            console.log(`✅ Returning ${pageFollowers.length} followers for ${identifier} (total: ${allFollowers.length})`);

            const items: Recipient[] = pageFollowers.map((follower: URL) => ({
                id: follower
            }));

            return {
                items,
                nextCursor: nextCursor ? `${ctx.getActorUri(identifier)}/followers?cursor=${nextCursor}` : null
            };
        } catch (error) {
            console.error(`❌ Error in handleFollowersRequest for ${identifier}:`, error);
            if (error instanceof Error) {
                console.error('Stack trace:', error.stack);
            }
            return null;
        }
    }

    /**
     * Followers count dispatcher - returns total number of followers
     */
    static async handleFollowersCountRequest(ctx: Context<ContextData>, identifier: string) {
        try {
            console.log(`🔢 Followers count request for identifier: ${identifier}`);

            // Check if actor exists
            const exists = await ActorModel.exists(identifier);
            if (!exists) {
                console.log(`❌ Actor not found for followers count: ${identifier}`);
                return 0;
            }

            // Try to get count from cache first
            const cacheKey = CacheKeys.FEDERATION.followersCount(identifier);
            const ttlSeconds = FederationCache.TTL.FOLLOWERS_COUNT;
            const ttl = Temporal.Duration.from({ seconds: ttlSeconds });

            try {
                const cached = await ctx.data.kv.get<string>(cacheKey);
                if (cached !== undefined) {
                    const count = parseInt(cached, 10);
                    console.log(`🎯 Cache HIT for followers count: ${identifier} = ${count}`);
                    return count;
                }
            } catch (cacheError) {
                console.warn(`⚠️ Cache error for count ${identifier}:`, cacheError);
            }

            // Get followers count from database
            const followers = await activityPub.getFollowers(identifier);
            const count = followers.length;

            // Cache the count
            try {
                await ctx.data.kv.set(cacheKey, String(count), { ttl });
                console.log(`💿 Cached followers count for ${identifier}: ${count}`);
            } catch (cacheError) {
                console.warn(`⚠️ Failed to cache count for ${identifier}:`, cacheError);
            }

            console.log(`✅ Followers count for ${identifier}: ${count}`);
            return count;
        } catch (error) {
            console.error(`❌ Error in handleFollowersCountRequest for ${identifier}:`, error);
            return 0;
        }
    }

    /**
     * Authorization check for followers collection access
     */
    static async handleFollowersAuthorization(ctx: Context<ContextData>, identifier: string, signedKey?: any, signedKeyOwner?: any) {
        try {
            console.log(`🔐 Followers authorization check for: ${identifier}`);

            // Check if actor exists
            const exists = await ActorModel.exists(identifier);
            if (!exists) {
                console.log(`❌ Actor not found for authorization: ${identifier}`);
                return false;
            }

            console.log(`✅ Followers access authorized for: ${identifier}`);
            return true;
        } catch (error) {
            console.error(`❌ Error in followers authorization for ${identifier}:`, error);
            return false;
        }
    }

    /**
     * Note object dispatcher - handles requests for individual Note objectss
     */
    static async handleNoteRequest(ctx: RequestContext<ContextData>, values: { identifier: string; noteId: string }) {
        try {
            const { identifier, noteId } = values;
            console.log(`📝 Note request for identifier: ${identifier}, noteId: ${noteId}`);

            // Rate limiting check
            const isRateLimited = await FederationHandlers.isRateLimitExceeded(ctx, 'note_request', 200, 3600);
            if (isRateLimited) {
                return null;
            }

            // Check if actor exists
            const exists = await ActorModel.exists(identifier);
            if (!exists) {
                console.log(`❌ Actor not found for note request: ${identifier}`);
                return null;
            }

            // Try to get note from cache first
            const cacheKey = CacheKeys.FEDERATION.activities(identifier); // Use activities cache for now
            const ttlSeconds = FederationCache.TTL.ACTIVITIES; // Use activities TTL
            const ttl = Temporal.Duration.from({ seconds: ttlSeconds });

            try {
                const cached = await ctx.data.kv.get<string>(cacheKey);
                if (cached) {
                    console.log(`🎯 Cache HIT for note: ${noteId}`);
                    const cachedActivities = JSON.parse(cached);
                    // Look for this specific note in cached activities
                    const cachedNote = cachedActivities.find((activity: any) => activity.object?.id?.includes(noteId) || activity.id?.includes(noteId));
                    if (cachedNote) {
                        return cachedNote;
                    }
                }
            } catch (cacheError) {
                console.warn(`⚠️ Cache error for note ${noteId}:`, cacheError);
            }

            // Get the post/note from database
            const postItem = await db.getItem(`OBJECT#${noteId}`, 'NOTE');
            if (!postItem) {
                console.log(`❌ Note not found: ${noteId}`);
                return null;
            }

            console.log(`📋 Note data for ${noteId}:`, JSON.stringify(postItem, null, 2));

            // Verify the post belongs to the requested actor
            // The owner is stored in GSI1PK as ACTOR#{identifier}
            const expectedOwnerKey = `ACTOR#${identifier}`;
            if (postItem.GSI1PK !== expectedOwnerKey) {
                console.log(`❌ Note ${noteId} does not belong to actor ${identifier}. Expected: ${expectedOwnerKey}, Found: ${postItem.GSI1PK}`);
                return null;
            }

            // Handle different possible timestamp field names
            const timestamp = postItem.created_at || postItem.createdAt || postItem.timestamp || postItem.published || new Date().toISOString();

            if (!timestamp) {
                console.log(`❌ No timestamp found for note ${noteId}. Available fields:`, Object.keys(postItem));
                return null;
            }

            console.log(`📅 Using timestamp for note ${noteId}: ${timestamp}`);

            // Create Note object
            const note = new Note({
                id: new URL(`/users/${identifier}/notes/${noteId}`, `${config.federation.protocol}://${config.federation.domain}`),
                content: postItem.content,
                published: Temporal.Instant.from(timestamp),
                attribution: ctx.getActorUri(identifier),
                to: new URL('https://www.w3.org/ns/activitystreams#Public') // Public visibility
            });

            console.log(`✅ Note object created for: ${identifier}/${noteId}`);

            // Cache the result
            try {
                await ctx.data.kv.set(cacheKey, JSON.stringify(note), { ttl });
                console.log(`💿 Cached note: ${noteId}`);
            } catch (cacheError) {
                console.warn(`⚠️ Failed to cache note ${noteId}:`, cacheError);
            }

            return note;
        } catch (error) {
            console.error(`❌ Error in handleNoteRequest for ${values?.identifier}/${values?.noteId}:`, error);
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
