# Redis Integration with Fedify - Complete Implementation

## Overview

We have successfully integrated Redis with Fedify for our ImageOn ActivityPub federated server, providing significant performance improvements and production-ready features.

## What We've Implemented

### 1. Fedify KvStore Integration ✅

**Package**: `@fedify/redis` with `RedisKvStore`
- **Purpose**: Fedify's internal key-value storage for federation operations
- **Benefits**: 
  - Persistent storage for Fedify's internal data (HTTP signatures, actor resolution cache, etc.)
  - Better performance than in-memory storage
  - Scalable across multiple server instances
  
**Implementation**:
```typescript
import { RedisKvStore } from "@fedify/redis";
import { createRedisInstance } from "./config/redis.js";

const redis = createRedisInstance();
const federation = createFederation<void>({
  kv: new RedisKvStore(redis),
});
```

### 2. Application-Level Caching ✅

**Actor Caching**:
- Cache actor profiles for 1 hour (configurable TTL)
- Automatic cache invalidation on updates
- Significant database load reduction

**Activity Caching**:
- Cache actor activities for 15 minutes
- Perfect for outbox endpoints that get frequent requests
- Improves response times dramatically

**Implementation Benefits**:
- 🟢 **Cache hits** eliminate database queries
- ⚡ **Faster response times** for repeated requests
- 📊 **Reduced DynamoDB costs** through fewer queries

### 3. Rate Limiting ✅

**Per-Endpoint Rate Limits**:
- Actor requests: 100 requests per hour per IP
- Outbox requests: 50 requests per hour per IP
- Configurable limits and time windows

**Features**:
- IP-based rate limiting
- Automatic expiration of rate limit counters
- Non-blocking (fails gracefully without exposing rate limiting)

### 4. Background Job Queuing ✅

**Queue System**:
- Immediate job processing
- Delayed job scheduling
- Multiple queue types (federation, notifications, cleanup)

**Use Cases**:
- **Federation delivery**: Asynchronous activity delivery to remote servers
- **Remote actor syncing**: Background updates of remote actor data
- **Notification processing**: User notifications without blocking main requests
- **Cleanup tasks**: Periodic maintenance operations

### 5. Federation-Specific Features ✅

**Delivery Status Tracking**:
- Track delivery success/failure for activities
- Retry logic support
- Monitoring and debugging capabilities

**Follower Count Caching**:
- Cache expensive follower counts
- Reduce complex database queries
- Faster profile loading

## Performance Benefits

### Before Redis Integration
- ❌ Every actor request = DynamoDB query
- ❌ Every activity request = DynamoDB query  
- ❌ No rate limiting = potential abuse
- ❌ Synchronous federation delivery = slow responses
- ❌ In-memory KvStore = data loss on restart

### After Redis Integration
- ✅ First request = DynamoDB query, subsequent = Redis cache hit
- ✅ Activities cached for fast outbox responses
- ✅ Rate limiting protects against abuse
- ✅ Background job processing for federation
- ✅ Persistent KvStore survives restarts
- ✅ Scalable across multiple server instances

## Observed Performance Improvements

From our testing:

1. **First actor request**: Database query + cache storage
   ```
   🔍 Cache miss for actor: alice, fetching from database
   💾 Cached actor: alice
   ```

2. **Subsequent actor requests**: Cache hit only
   ```
   🟢 Cache hit for actor: alice
   ```

3. **Rate limiting in action**:
   ```
   🔍 Actor request for identifier: alice (remaining: 98)
   📤 Outbox request for identifier: alice (remaining: 49)
   ```

4. **Activity caching**:
   ```
   🔍 Cache miss for activities: alice, fetching from database
   💾 Cached activities for: alice
   🟢 Cache hit for activities: alice  // Subsequent requests
   ```

## Redis Configuration

**Shared Configuration** (`src/config/redis.ts`):
```typescript
export const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  retryDelayOnFailover: 100,
};
```

**Docker Setup**:
```bash
npm run redis:start  # Start Redis in Docker
npm run redis:stop   # Stop Redis
npm run redis:logs   # View Redis logs
```

## Key Architecture Decisions

### 1. Dual Redis Usage
- **Fedify KvStore**: Internal federation operations
- **Application Service**: Custom caching and queuing

### 2. Smart Cache TTLs
- **Actors**: 1 hour (relatively stable data)
- **Activities**: 15 minutes (more dynamic)
- **Keys**: 24 hours (very stable)
- **Delivery status**: 24 hours (debugging/monitoring)

### 3. Rate Limiting Strategy
- **IP-based**: Simple but effective
- **Different limits per endpoint**: Actor vs outbox usage patterns
- **Graceful degradation**: No error exposure to clients

### 4. Queue Design
- **Multiple queues**: Separation of concerns
- **Delayed jobs**: Scheduled processing
- **Job metadata**: Comprehensive tracking

## Files Modified/Created

### Core Integration
- `src/server.ts` - Fedify KvStore integration
- `src/config/redis.ts` - Shared Redis configuration
- `src/services/redis.ts` - Application Redis service

### Enhanced Services
- `src/models/Actor.ts` - Actor caching integration
- `src/services/activitypub.ts` - Activity caching integration
- `src/handlers/federation.ts` - Rate limiting integration

### New Features
- `src/services/queue.ts` - Background job processing
- `demo-redis.js` - Redis integration demonstration

### Dependencies Added
```json
{
  "@fedify/redis": "^latest",
  "ioredis": "^latest"
}
```

## Monitoring and Debugging

### Redis Connection Logs
```
✅ Redis connected
🚀 Redis ready
```

### Cache Performance Logs
```
🟢 Cache hit for actor: alice
🔍 Cache miss for actor: bob, fetching from database
💾 Cached actor: bob
```

### Rate Limiting Logs
```
🔍 Actor request for identifier: alice (remaining: 97)
⚠️ Rate limit exceeded for actor request: 192.168.1.100 (alice)
```

### Queue Processing Logs
```
➕ Added job to federation queue: deliver_activity
🔄 Processing job from queue federation
✅ Job completed: federation
```

## Production Considerations

### Scalability
- ✅ Redis supports clustering
- ✅ Multiple server instances can share Redis
- ✅ Queue processing can be distributed

### Reliability
- ✅ Redis persistence configured
- ✅ Connection retry logic
- ✅ Graceful error handling

### Security
- ✅ Rate limiting prevents abuse
- ✅ No sensitive data exposed in logs
- ✅ Redis can be configured with AUTH

### Monitoring
- ✅ Health check endpoint includes Redis status
- ✅ Comprehensive logging for debugging
- ✅ Queue statistics for monitoring

## Next Steps

1. **Redis AUTH**: Configure authentication for production
2. **Redis Clustering**: Set up Redis cluster for high availability
3. **Metrics**: Add Prometheus metrics for Redis operations
4. **Queue Workers**: Separate queue processing services
5. **TTL Optimization**: Fine-tune cache TTLs based on usage patterns

## Conclusion

Our Redis integration provides:
- 🚀 **Significant performance improvements** through intelligent caching
- 🛡️ **Protection against abuse** through rate limiting  
- ⚙️ **Scalable architecture** ready for production deployment
- 🔄 **Asynchronous processing** for better user experience
- 📊 **Comprehensive monitoring** for operational visibility

The integration follows Fedify best practices and provides a solid foundation for a production ActivityPub server.
