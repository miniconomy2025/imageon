/**
 * Centralized Cache Key Registry & Federation Cache Utilities
 * Single source of truth for all cache keys used throughout the application
 */

// KvKey type for Fedify compatibility (array of one or more strings)
type KvKey = readonly [string, ...string[]];

export class CacheKeys {
  /**
   * Core ActivityPub & Federation Cache Keys
   * Returns KvKey arrays for Fedify KvStore compatibility
   */
  static readonly FEDERATION = {
    // Actor-related keys
    actor: (identifier: string): KvKey => ["actor", identifier],
    actorKeyPairs: (identifier: string): KvKey => ["keys", identifier],
    note: (noteId: string): KvKey => ["note", noteId],
    // Social graph keys  
    followers: (identifier: string): KvKey => ["followers", identifier],
    followersCount: (identifier: string): KvKey => ["followers_count", identifier],
    followerCountAlt: (identifier: string): KvKey => ["follower_count", identifier], // Alternative pattern used in redis.ts
    following: (identifier: string): KvKey => ["following", identifier],
    
    // Activity & content keys
    activities: (identifier: string): KvKey => ["activities", identifier],
    outbox: (identifier: string, cursor?: string): KvKey => {
      return cursor ? ["outbox", identifier, cursor] : ["outbox", identifier];
    },
    
    // Remote federation keys
    remoteActor: (actorUri: string): KvKey => ["remote_actor", Buffer.from(actorUri).toString('base64')],
    
    // Delivery tracking
    deliveryStatus: (activityId: string, targetInbox: string): KvKey => [
      "delivery", 
      Buffer.from(activityId).toString('base64'), 
      Buffer.from(targetInbox).toString('base64')
    ],
  } as const;

  /**
   * Rate Limiting Keys (continue to return strings for Redis service compatibility)
   */
  static readonly RATE_LIMIT = {
    actor: (ip: string) => `rate_limit:actor:${ip}`,
    outbox: (ip: string) => `rate_limit:outbox:${ip}`,
    followers: (ip: string) => `rate_limit:followers:${ip}`,
    generic: (type: string, ip: string) => `rate_limit:${type}:${ip}`,
  } as const;

  /**
   * Queue Management Keys (for future use)
   */
  static readonly QUEUE = {
    immediate: (queueName: string) => `queue:${queueName}`,
    delayed: (queueName: string) => `queue:${queueName}:delayed`,
  } as const;

  /**
   * Legacy key patterns (for backward compatibility)
   * These map to the new centralized patterns above
   */
  static readonly LEGACY = {
    actor: CacheKeys.FEDERATION.actor,
    followers: CacheKeys.FEDERATION.followers,
    followersCount: CacheKeys.FEDERATION.followersCount,
    following: CacheKeys.FEDERATION.following,
    activities: CacheKeys.FEDERATION.activities,
    outbox: CacheKeys.FEDERATION.outbox,
    rateLimit: CacheKeys.RATE_LIMIT.generic,
  } as const;
}

export class FederationCache {
  /**
   * Cache TTL settings (in seconds)
   */
  static readonly TTL = {
    ACTOR_PROFILE: 600,    // 10 minutes - actor profiles change infrequently
    ACTOR_KEYS: 86400,     // 24 hours - cryptographic keys rarely change
    FOLLOWERS: 300,        // 5 minutes - followers list
    FOLLOWERS_COUNT: 180,  // 3 minutes - counts change more frequently
    ACTIVITIES: 120,       // 2 minutes - activities cache
    OUTBOX: 300,          // 5 minutes - outbox content
    RATE_LIMITS: 3600,    // 1 hour - rate limiting data
    REMOTE_ACTOR: 7200,   // 2 hours - remote actor data
    DELIVERY_STATUS: 86400, // 24 hours - delivery tracking
  } as const;

  /**
   * Cache key patterns (using centralized registry)
   */
  static readonly KEYS = CacheKeys.FEDERATION;

  /**
   * Safely get data from cache with error handling
   */
  static async safeGet<T>(
    kv: any, 
    key: string, 
    parser?: (data: string) => T
  ): Promise<T | null> {
    try {
      const cached = await kv.get(key);
      if (cached === null || cached === undefined) {
        return null;
      }
      
      if (parser) {
        return parser(cached);
      }
      
      // Default to JSON parsing
      return JSON.parse(cached);
    } catch (error) {
      console.warn(`⚠️ Cache read error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Safely set data in cache with error handling
   */
  static async safeSet(
    kv: any, 
    key: string, 
    value: any, 
    ttl: number
  ): Promise<boolean> {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      await kv.set(key, serialized, { ttl });
      return true;
    } catch (error) {
      console.warn(`⚠️ Cache write error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Safely delete from cache with error handling
   */
  static async safeDelete(kv: any, key: KvKey): Promise<boolean> {
    try {
      await kv.delete(key);
      return true;
    } catch (error) {
      console.warn(`⚠️ Cache delete error for key ${JSON.stringify(key)}:`, error);
      return false;
    }
  }

  /**
   * Invalidate all follower-related cache for an actor
   */
  static async invalidateFollowerCache(kv: any, identifier: string): Promise<void> {
    const keys = [
      CacheKeys.FEDERATION.followers(identifier),
      CacheKeys.FEDERATION.followersCount(identifier),
      CacheKeys.FEDERATION.actor(identifier), // Actor profile may include follower count
    ];

    console.log(`🗑️ Invalidating follower cache for: ${identifier}`);
    
    await Promise.all(
      keys.map(key => this.safeDelete(kv, key))
    );
  }

  /**
   * Invalidate all actor-related cache
   */
  static async invalidateActorCache(kv: any, identifier: string): Promise<void> {
    const keys = [
      CacheKeys.FEDERATION.actor(identifier),
      CacheKeys.FEDERATION.followers(identifier),
      CacheKeys.FEDERATION.followersCount(identifier),
      CacheKeys.FEDERATION.following(identifier),
      CacheKeys.FEDERATION.activities(identifier),
      CacheKeys.FEDERATION.outbox(identifier),
    ];

    console.log(`🗑️ Invalidating all cache for actor: ${identifier}`);
    
    await Promise.all(
      keys.map(key => this.safeDelete(kv, key))
    );
  }

  /**
   * Get or compute cached data with automatic caching
   */
  static async getOrCompute<T>(
    kv: any,
    key: string,
    ttl: number,
    computeFn: () => Promise<T>,
    parser?: (data: string) => T
  ): Promise<T | null> {
    // Try cache first
    const cached = await this.safeGet(kv, key, parser);
    if (cached !== null) {
      console.log(`🎯 Cache HIT: ${key}`);
      return cached;
    }

    console.log(`💾 Cache MISS: ${key} - computing...`);
    
    try {
      // Compute fresh data
      const fresh = await computeFn();
      
      // Cache the result
      await this.safeSet(kv, key, fresh, ttl);
      console.log(`💿 Cached: ${key}`);
      
      return fresh;
    } catch (error) {
      console.error(`❌ Error computing data for ${key}:`, error);
      return null;
    }
  }

  /**
   * Batch cache operations
   */
  static async batchSet(
    kv: any, 
    operations: Array<{ key: string; value: any; ttl: number }>
  ): Promise<void> {
    await Promise.all(
      operations.map(op => this.safeSet(kv, op.key, op.value, op.ttl))
    );
  }

  /**
   * Get cache statistics (useful for monitoring)
   */
  static async getCacheStats(kv: any, prefix: string): Promise<any> {
    // Note: This would require Redis SCAN commands
    // Implementation depends on your Redis client capabilities
    console.log(`📊 Cache stats requested for prefix: ${prefix}`);
    return {
      message: "Cache stats not implemented - requires Redis SCAN support"
    };
  }

  /**
   * Validate cache key patterns
   * Useful for ensuring all cache keys follow the centralized registry
   */
  static validateCacheKey(key: string): { valid: boolean; pattern?: string; suggestion?: string } {
    const patterns = [
      { pattern: /^actor:/, name: 'FEDERATION.actor' },
      { pattern: /^keys:/, name: 'FEDERATION.actorKeyPairs' },
      { pattern: /^followers:/, name: 'FEDERATION.followers' },
      { pattern: /^followers_count:/, name: 'FEDERATION.followersCount' },
      { pattern: /^follower_count:/, name: 'FEDERATION.followerCountAlt' },
      { pattern: /^following:/, name: 'FEDERATION.following' },
      { pattern: /^activities:/, name: 'FEDERATION.activities' },
      { pattern: /^outbox:/, name: 'FEDERATION.outbox' },
      { pattern: /^remote_actor:/, name: 'FEDERATION.remoteActor' },
      { pattern: /^delivery:/, name: 'FEDERATION.deliveryStatus' },
      { pattern: /^rate_limit:/, name: 'RATE_LIMIT.*' },
    ];

    for (const { pattern, name } of patterns) {
      if (pattern.test(key)) {
        return { valid: true, pattern: name };
      }
    }

    return { 
      valid: false, 
      suggestion: 'Consider using CacheKeys registry for consistent key patterns' 
    };
  }

  /**
   * Get all cache keys used by an actor
   * Useful for complete cache invalidation
   */
  static getActorCacheKeys(identifier: string): KvKey[] {
    return [
      CacheKeys.FEDERATION.actor(identifier),
      CacheKeys.FEDERATION.actorKeyPairs(identifier),
      CacheKeys.FEDERATION.followers(identifier),
      CacheKeys.FEDERATION.followersCount(identifier),
      CacheKeys.FEDERATION.followerCountAlt(identifier),
      CacheKeys.FEDERATION.following(identifier),
      CacheKeys.FEDERATION.activities(identifier),
      CacheKeys.FEDERATION.outbox(identifier),
    ];
  }

  /**
   * Migrate old cache keys to new centralized patterns
   * Useful when updating cache key patterns
   */
  static async migrateCacheKeys(kv: any, oldKey: string, newKey: string): Promise<boolean> {
    try {
      const value = await kv.get(oldKey);
      if (value !== null) {
        await kv.set(newKey, value);
        await kv.delete(oldKey);
        console.log(`✅ Migrated cache key: ${oldKey} → ${newKey}`);
        return true;
      }
      return false;
    } catch (error) {
      console.warn(`⚠️ Failed to migrate cache key ${oldKey} → ${newKey}:`, error);
      return false;
    }
  }
}

/**
 * Example usage:
 * 
 * // Using centralized cache keys
 * const actorKey = CacheKeys.FEDERATION.actor('testuser');
 * const followersKey = CacheKeys.FEDERATION.followers('testuser');
 * const rateLimitKey = CacheKeys.RATE_LIMIT.actor('192.168.1.1');
 * 
 * // Get followers with caching
 * const followers = await FederationCache.getOrCompute(
 *   ctx.kv,
 *   CacheKeys.FEDERATION.followers(identifier),
 *   FederationCache.TTL.FOLLOWERS,
 *   () => activityPub.getFollowers(identifier)
 * );
 * 
 * // Validate cache key pattern
 * const validation = FederationCache.validateCacheKey('actor:testuser');
 * 
 * // Get all keys for an actor
 * const allKeys = FederationCache.getActorCacheKeys('testuser');
 * 
 * // Complete actor cache invalidation
 * await Promise.all(
 *   allKeys.map(key => FederationCache.safeDelete(ctx.kv, key))
 * );
 */
