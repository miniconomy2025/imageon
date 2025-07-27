# Redis Cache Design for Social Media App

## Overview
Redis serves as a high-performance cache layer and handles real-time features for the social media application.

---

## Redis Data Structures & Use Cases

### 1. User Sessions
**Structure**: Hash
**Pattern**: `session:{session_token}`
**TTL**: 24 hours (sliding window)

```redis
HSET session:abc123xyz user_id "user123"
HSET session:abc123xyz username "john_doe"
HSET session:abc123xyz created_at "2025-01-27T10:00:00Z"
HSET session:abc123xyz last_active "2025-01-27T15:30:00Z"
HSET session:abc123xyz device_info "Mozilla/5.0..."
EXPIRE session:abc123xyz 86400
```

### 2. User Feed Cache
**Structure**: Sorted Set
**Pattern**: `feed:{user_id}`
**TTL**: 1 hour
**Score**: Timestamp (for chronological order)

```redis
# Cache user's personalized feed
ZADD feed:user123 1706367000 "post456:user789:This is a great post..."
ZADD feed:user123 1706366800 "post457:user101:Check out this photo..."
ZADD feed:user123 1706366600 "post458:user234:Loving the weather today..."
EXPIRE feed:user123 3600

# Retrieve latest 20 posts
ZREVRANGE feed:user123 0 19 WITHSCORES
```

### 3. Post Engagement Counters
**Structure**: Hash
**Pattern**: `post:{post_id}:stats`
**TTL**: 6 hours

```redis
HSET post:post456:stats likes_count 125
HSET post:post456:stats comments_count 23
HSET post:post456:stats shares_count 7
HSET post:post456:stats views_count 1540
HSET post:post456:stats engagement_score 2.8
EXPIRE post:post456:stats 21600
```

### 4. Real-time Like Tracking
**Structure**: Set
**Pattern**: `post:{post_id}:likes`
**TTL**: 2 hours

```redis
# Track who liked a post
SADD post:post456:likes user123 user456 user789
EXPIRE post:post456:likes 7200

# Check if user liked post
SISMEMBER post:post456:likes user123

# Get like count
SCARD post:post456:likes
```

### 5. User Online Status
**Structure**: Sorted Set
**Pattern**: `online_users`
**Score**: Last active timestamp

```redis
# Set user as online
ZADD online_users 1706367000 user123

# Get users online in last 5 minutes
ZRANGEBYSCORE online_users (1706366700 +inf

# Remove inactive users (cleanup job)
ZREMRANGEBYSCORE online_users -inf (1706366400
```

### 6. Trending Hashtags
**Structure**: Sorted Set
**Pattern**: `trending:hashtags:{timeframe}`
**Score**: Usage count

```redis
# Track hashtag usage
ZINCRBY trending:hashtags:hourly 1 "#coding"
ZINCRBY trending:hashtags:hourly 1 "#startup"
EXPIRE trending:hashtags:hourly 3600

# Get top 10 trending hashtags
ZREVRANGE trending:hashtags:hourly 0 9 WITHSCORES
```

### 7. Rate Limiting
**Structure**: String (counter)
**Pattern**: `rate_limit:{user_id}:{action}:{time_window}`
**TTL**: Time window duration

```redis
# Post creation rate limit (5 posts per minute)
INCR rate_limit:user123:post:1706367060
EXPIRE rate_limit:user123:post:1706367060 60

# Check current count
GET rate_limit:user123:post:1706367060
```

### 8. Notification Queue
**Structure**: List
**Pattern**: `notifications:{user_id}`
**TTL**: 7 days

```redis
# Add notification
LPUSH notifications:user123 '{"type":"like","from":"user456","post_id":"post789","timestamp":"2025-01-27T15:30:00Z"}'
EXPIRE notifications:user123 604800

# Get latest notifications
LRANGE notifications:user123 0 19

# Mark as read (remove from queue)
LTRIM notifications:user123 20 -1
```

### 9. User Activity Timeline
**Structure**: Sorted Set
**Pattern**: `activity:{user_id}`
**Score**: Timestamp

```redis
# Track user activities
ZADD activity:user123 1706367000 "posted:post456"
ZADD activity:user123 1706367120 "liked:post789"
ZADD activity:user123 1706367240 "followed:user456"
EXPIRE activity:user123 86400

# Get recent activity
ZREVRANGE activity:user123 0 9 WITHSCORES
```

### 10. Search Autocomplete
**Structure**: Sorted Set
**Pattern**: `autocomplete:users`, `autocomplete:hashtags`
**Score**: Popularity or frequency

```redis
# User search autocomplete
ZADD autocomplete:users 150 "john_doe"
ZADD autocomplete:users 200 "jane_smith" 
ZADD autocomplete:users 75 "john_wilson"

# Search for users starting with "john"
# This requires a more complex implementation with prefix matching
```

---

## Redis Pub/Sub for Real-time Features

### 1. Real-time Notifications
```redis
# Subscribe to user notifications
SUBSCRIBE notifications:user123

# Publish notification
PUBLISH notifications:user123 '{"type":"new_follower","data":{"user_id":"user456","username":"jane_doe"}}'
```

### 2. Live Feed Updates
```redis
# Subscribe to feed updates
SUBSCRIBE feed_updates:user123

# Publish new post to followers
PUBLISH feed_updates:user123 '{"type":"new_post","post_id":"post456","author":"john_doe"}'
```

### 3. Typing Indicators (Future)
```redis
# Direct message typing indicators
PUBLISH typing:conversation:conv123 '{"user_id":"user123","typing":true}'
```

---

## Cache Strategies

### 1. Write-Through Pattern (User Profiles)
```javascript
// Update user profile
async function updateUserProfile(userId, updates) {
  // Update DynamoDB
  await dynamoClient.update({
    TableName: 'SocialMediaApp',
    Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    UpdateExpression: 'SET display_name = :name, bio = :bio',
    ExpressionAttributeValues: updates
  }).promise();
  
  // Update Redis cache
  await redis.hset(`user:${userId}:profile`, updates);
  await redis.expire(`user:${userId}:profile`, 3600);
}
```

### 2. Cache-Aside Pattern (Feed Data)
```javascript
// Get user feed with cache
async function getUserFeed(userId, limit = 20) {
  const cacheKey = `feed:${userId}`;
  
  // Try cache first
  const cached = await redis.zrevrange(cacheKey, 0, limit - 1, 'WITHSCORES');
  if (cached.length > 0) {
    return parseRedisResponse(cached);
  }
  
  // Fallback to DynamoDB
  const feedData = await getFeedFromDynamoDB(userId, limit);
  
  // Populate cache for next time
  const pipeline = redis.pipeline();
  feedData.forEach(item => {
    pipeline.zadd(cacheKey, item.timestamp, item.data);
  });
  pipeline.expire(cacheKey, 3600);
  await pipeline.exec();
  
  return feedData;
}
```

### 3. Write-Behind Pattern (Engagement Counters)
```javascript
// Increment like counter (async write to DB)
async function likePost(postId, userId) {
  // Immediate cache update
  await redis.sadd(`post:${postId}:likes`, userId);
  await redis.hincrby(`post:${postId}:stats`, 'likes_count', 1);
  
  // Queue for DB update (processed by background job)
  await redis.lpush('db_updates_queue', JSON.stringify({
    type: 'like',
    post_id: postId,
    user_id: userId,
    timestamp: Date.now()
  }));
}
```

---

## Performance Optimizations

### 1. Pipeline Operations
```javascript
// Batch multiple Redis operations
const pipeline = redis.pipeline();
pipeline.hset('user:user123:profile', 'display_name', 'John Doe');
pipeline.zadd('feed:user123', Date.now(), 'post456');
pipeline.incr('post:post456:views');
const results = await pipeline.exec();
```

### 2. Connection Pooling
```javascript
const Redis = require('ioredis');

const redis = new Redis({
  host: 'your-redis-cluster.cache.amazonaws.com',
  port: 6379,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
  keepAlive: 30000,
  family: 4,
  db: 0
});
```

### 3. Memory Optimization
```redis
# Use appropriate data types
# Instead of: SET user:123:followers_count 150
# Use: HSET user:123:stats followers_count 150 following_count 200

# Set memory policies
CONFIG SET maxmemory 2gb
CONFIG SET maxmemory-policy allkeys-lru
```

---

## Monitoring & Alerts

### Key Metrics to Track
- Cache hit ratio (target: >90%)
- Memory usage (alert at >80%)
- Connection count
- Slow queries (>10ms)
- Expired keys per second

### Redis Commands for Monitoring
```redis
INFO memory
INFO stats
SLOWLOG GET 10
CLIENT LIST
```

---

## Data Expiration Strategy

| Data Type | TTL | Reason |
|-----------|-----|--------|
| User sessions | 24 hours | Security & memory |
| Feed cache | 1 hour | Content freshness |
| Post stats | 6 hours | Engagement accuracy |
| Like tracking | 2 hours | Real-time features |
| Rate limiting | Variable | Based on limit window |
| Notifications | 7 days | User experience |
| Trending data | 1 hour | Relevance |

This Redis design provides fast access to frequently used data while supporting real-time features essential for a modern social media experience.
