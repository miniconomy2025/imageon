import Redis from 'ioredis';
import { createRedisInstance } from '../config/redis.js';

/**
 * Minimal Redis Service
 * Only handles operations that Fedify's ctx.kv cannot do:
 * - Rate limiting (requires atomic operations)
 * - Health checks and connection management
 */
class RedisService {
  private readonly redis: Redis;

  constructor() {
    this.redis = createRedisInstance();
  }

  /**
   * Rate limiting using atomic Redis operations
   * This cannot be reliably done with ctx.kv due to race conditions
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
   * Health check for Redis connection
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
   * Close Redis connection
   */
  async disconnect() {
    await this.redis.quit();
  }
}

// Export singleton instance
export const redis = new RedisService();
