import Redis from 'ioredis';

export interface RedisConfig {
  host: string;
  port: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
  retryDelayOnFailover?: number;
}

export const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  retryDelayOnFailover: 100,
};

/**
 * Create a new Redis instance with default configuration
 */
export function createRedisInstance(): Redis {
  const redis = new Redis(redisConfig);

  redis.on('connect', () => {
    console.log('✅ Redis connected');
  });

  redis.on('error', (error) => {
    console.error('❌ Redis connection error:', error);
  });

  redis.on('ready', () => {
    console.log('🚀 Redis ready');
  });

  return redis;
}
