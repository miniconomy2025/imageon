import Redis from 'ioredis';
import type { ActorData } from '../models/Actor.js';
import { createRedisInstance } from '../config/redis.js';

class RedisService {
  private readonly redis: Redis;

  constructor() {
    this.redis = createRedisInstance();
  }

  /**
   * Cache actor data
   */
  async cacheActor(identifier: string, actorData: ActorData, ttl: number = 3600) {
    const key = `actor:${identifier}`;
    await this.redis.setex(key, ttl, JSON.stringify(actorData));
  }

  /**
   * Get cached actor data
   */
  async getCachedActor(identifier: string): Promise<ActorData | null> {
    const key = `actor:${identifier}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Cache actor activities
   */
  async cacheActorActivities(identifier: string, activities: unknown[], ttl: number = 900) {
    const key = `activities:${identifier}`;
    await this.redis.setex(key, ttl, JSON.stringify(activities));
  }

  /**
   * Get cached actor activities
   */
  async getCachedActorActivities(identifier: string): Promise<unknown[] | null> {
    const key = `activities:${identifier}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Cache remote actor data (from other servers)
   */
  async cacheRemoteActor(actorUri: string, actorData: unknown, ttl: number = 7200) {
    const key = `remote_actor:${Buffer.from(actorUri).toString('base64')}`;
    await this.redis.setex(key, ttl, JSON.stringify(actorData));
  }

  /**
   * Get cached remote actor data
   */
  async getCachedRemoteActor(actorUri: string): Promise<unknown> {
    const key = `remote_actor:${Buffer.from(actorUri).toString('base64')}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Invalidate cache for an actor
   */
  async invalidateActor(identifier: string) {
    const keys = [
      `actor:${identifier}`,
      `activities:${identifier}`,
    ];
    await this.redis.del(...keys);
  }

  /**
   * Cache cryptographic keys
   */
  async cacheKeyPairs(identifier: string, keyPairs: any[], ttl: number = 86400) {
    const key = `keys:${identifier}`;
    await this.redis.setex(key, ttl, JSON.stringify(keyPairs));
  }

  /**
   * Get cached key pairs
   */
  async getCachedKeyPairs(identifier: string): Promise<any[] | null> {
    const key = `keys:${identifier}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Rate limiting
   */
  async checkRateLimit(key: string, limit: number, window: number): Promise<{ allowed: boolean; remaining: number }> {
    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, window);
    }
    
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current)
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Close connection
   */
  async disconnect() {
    await this.redis.quit();
  }

  // ==== QUEUE FUNCTIONALITY === =
  
  /**
   * Add job to queue for background processing
   */
  async addToQueue(queueName: string, jobData: unknown, delay?: number): Promise<void> {
    const job = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      data: jobData,
      createdAt: new Date().toISOString(),
    };

    if (delay && delay > 0) {
      // Add to delayed queue
      const score = Date.now() + delay;
      await this.redis.zadd(`queue:${queueName}:delayed`, score, JSON.stringify(job));
    } else {
      // Add to immediate queue
      await this.redis.lpush(`queue:${queueName}`, JSON.stringify(job));
    }
  }

  /**
   * Get job from queue
   */
  async getFromQueue(queueName: string, timeout: number = 0): Promise<Record<string, unknown> | null> {
    // First check for delayed jobs that are ready
    await this.processDelayedJobs(queueName);

    // Then get from immediate queue
    const result = timeout > 0 
      ? await this.redis.brpop(`queue:${queueName}`, timeout)
      : await this.redis.rpop(`queue:${queueName}`);

    if (result) {
      const jobData = Array.isArray(result) ? result[1] : result;
      return JSON.parse(jobData);
    }
    return null;
  }

  /**
   * Process delayed jobs that are ready
   */
  private async processDelayedJobs(queueName: string): Promise<void> {
    const now = Date.now();
    const readyJobs = await this.redis.zrangebyscore(
      `queue:${queueName}:delayed`, 
      0, 
      now, 
      'LIMIT', 0, 100
    );

    for (const job of readyJobs) {
      await this.redis.zrem(`queue:${queueName}:delayed`, job);
      await this.redis.lpush(`queue:${queueName}`, job);
    }
  }

  /**
   * Get queue stats
   */
  async getQueueStats(queueName: string): Promise<{ immediate: number; delayed: number }> {
    const immediate = await this.redis.llen(`queue:${queueName}`);
    const delayed = await this.redis.zcard(`queue:${queueName}:delayed`);
    
    return { immediate, delayed };
  }

  // ==== FEDERATION-SPECIFIC CACHING ====

  /**
   * Cache delivery status for activities
   */
  async cacheDeliveryStatus(activityId: string, targetInbox: string, status: 'pending' | 'delivered' | 'failed', ttl: number = 86400): Promise<void> {
    const key = `delivery:${Buffer.from(activityId).toString('base64')}:${Buffer.from(targetInbox).toString('base64')}`;
    await this.redis.setex(key, ttl, JSON.stringify({
      status,
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * Get delivery status
   */
  async getDeliveryStatus(activityId: string, targetInbox: string): Promise<{ status: string; timestamp: string } | null> {
    const key = `delivery:${Buffer.from(activityId).toString('base64')}:${Buffer.from(targetInbox).toString('base64')}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Cache follower counts
   */
  async cacheFollowerCount(identifier: string, count: number, ttl: number = 3600): Promise<void> {
    const key = `follower_count:${identifier}`;
    await this.redis.setex(key, ttl, count.toString());
  }

  /**
   * Get cached follower count
   */
  async getCachedFollowerCount(identifier: string): Promise<number | null> {
    const key = `follower_count:${identifier}`;
    const cached = await this.redis.get(key);
    return cached ? parseInt(cached, 10) : null;
  }
}

// Export singleton instance
export const redis = new RedisService();
