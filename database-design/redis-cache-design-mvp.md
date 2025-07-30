# Redis Cache Design - MVP

## Overview
Redis serves as the caching layer and session store for our social media MVP, focusing on essential features: user sessions, profile caching, and basic post caching.

## MVP Cache Strategy

### 1. User Authentication & Sessions
```javascript
// JWT Token Storage (Blacklist approach)
Key Pattern: "auth:blacklist:{tokenId}"
TTL: Token expiration time
Data: "revoked"

// User Session Data
Key Pattern: "session:{userId}"
TTL: 24 hours
Data: {
  userId: "user123",
  username: "john_doe",
  lastActivity: "2025-01-27T10:00:00Z",
  loginTime: "2025-01-27T08:00:00Z"
}
```

### 2. User Profile Caching
```javascript
// User Profile Cache
Key Pattern: "user:profile:{userId}"
TTL: 1 hour
Data: {
  userId: "user123",
  username: "john_doe",
  displayName: "John Doe",
  bio: "Software developer",
  profileImageUrl: "https://...",
  followersCount: 150,
  followingCount: 200,
  postsCount: 45,
  // ActivityPub fields
  actorType: "Person",
  inboxUrl: "https://domain.com/users/john_doe/inbox",
  outboxUrl: "https://domain.com/users/john_doe/outbox"
}
```

### 3. Post Caching (Recent Posts Only)
```javascript
// User's Recent Posts
Key Pattern: "posts:user:{userId}"
TTL: 30 minutes
Data: [
  {
    postId: "post123",
    content: "Hello world!",
    createdAt: "2025-01-27T15:30:00Z",
    likesCount: 25,
    mediaUrls: ["https://..."]
  }
  // ... more posts (limit to 20 most recent)
]

// Public Timeline (Recent Posts)
Key Pattern: "timeline:public"
TTL: 15 minutes
Data: [
  {
    postId: "post456",
    authorId: "user789",
    authorUsername: "jane_doe",
    content: "Great day!",
    createdAt: "2025-01-27T16:00:00Z",
    likesCount: 10
  }
  // ... more posts (limit to 50 most recent)
]
```

### 4. Follow Relationships Caching
```javascript
// User's Following List
Key Pattern: "following:{userId}"
TTL: 2 hours
Data: [
  {
    userId: "user456",
    username: "jane_doe",
    displayName: "Jane Doe",
    profileImageUrl: "https://...",
    followedAt: "2025-01-27T12:00:00Z"
  }
  // ... more following (limit to 1000)
]

// User's Followers List
Key Pattern: "followers:{userId}"
TTL: 2 hours
Data: [
  {
    userId: "user789",
    username: "bob_smith",
    displayName: "Bob Smith",
    profileImageUrl: "https://...",
    followedAt: "2025-01-27T13:00:00Z"
  }
  // ... more followers (limit to 1000)
]
```

### 5. Like Tracking (User's Likes)
```javascript
// Posts Liked by User
Key Pattern: "likes:user:{userId}"
TTL: 1 hour
Data: [
  {
    postId: "post123",
    authorId: "user456",
    likedAt: "2025-01-27T16:30:00Z"
  }
  // ... more likes (limit to 500 recent)
]
```

---

## Cache Operations

### Authentication Operations
```javascript
// Check if token is blacklisted
const isTokenBlacklisted = async (tokenId) => {
  const result = await redis.get(`auth:blacklist:${tokenId}`);
  return result !== null;
};

// Blacklist token on logout
const blacklistToken = async (tokenId, expiresIn) => {
  await redis.setex(`auth:blacklist:${tokenId}`, expiresIn, 'revoked');
};

// Store user session
const storeSession = async (userId, sessionData) => {
  await redis.setex(`session:${userId}`, 86400, JSON.stringify(sessionData));
};
```

### Profile Operations
```javascript
// Get user profile from cache
const getUserProfile = async (userId) => {
  const cached = await redis.get(`user:profile:${userId}`);
  return cached ? JSON.parse(cached) : null;
};

// Cache user profile
const cacheUserProfile = async (userId, profileData) => {
  await redis.setex(`user:profile:${userId}`, 3600, JSON.stringify(profileData));
};

// Invalidate profile cache on update
const invalidateUserProfile = async (userId) => {
  await redis.del(`user:profile:${userId}`);
};
```

### Post Operations
```javascript
// Get user's posts from cache
const getUserPosts = async (userId) => {
  const cached = await redis.get(`posts:user:${userId}`);
  return cached ? JSON.parse(cached) : null;
};

// Cache user's recent posts
const cacheUserPosts = async (userId, posts) => {
  const recentPosts = posts.slice(0, 20); // Limit to 20 recent posts
  await redis.setex(`posts:user:${userId}`, 1800, JSON.stringify(recentPosts));
};

// Invalidate user posts cache
const invalidateUserPosts = async (userId) => {
  await redis.del(`posts:user:${userId}`);
};
```

### Follow Operations
```javascript
// Cache follow relationship
const cacheFollowRelationship = async (followerId, followedId, relationshipData) => {
  // Add to follower's following list
  const followingKey = `following:${followerId}`;
  const following = await redis.get(followingKey);
  const followingList = following ? JSON.parse(following) : [];
  followingList.unshift(relationshipData); // Add to beginning
  await redis.setex(followingKey, 7200, JSON.stringify(followingList.slice(0, 1000)));
  
  // Add to followed user's followers list
  const followersKey = `followers:${followedId}`;
  const followers = await redis.get(followersKey);
  const followersList = followers ? JSON.parse(followers) : [];
  followersList.unshift({
    userId: followerId,
    ...relationshipData
  });
  await redis.setex(followersKey, 7200, JSON.stringify(followersList.slice(0, 1000)));
};

// Remove follow relationship from cache
const removeFollowFromCache = async (followerId, followedId) => {
  // Remove from following list
  const followingKey = `following:${followerId}`;
  const following = await redis.get(followingKey);
  if (following) {
    const followingList = JSON.parse(following);
    const updated = followingList.filter(f => f.userId !== followedId);
    await redis.setex(followingKey, 7200, JSON.stringify(updated));
  }
  
  // Remove from followers list
  const followersKey = `followers:${followedId}`;
  const followers = await redis.get(followersKey);
  if (followers) {
    const followersList = JSON.parse(followers);
    const updated = followersList.filter(f => f.userId !== followerId);
    await redis.setex(followersKey, 7200, JSON.stringify(updated));
  }
};
```

---

## Cache Invalidation Strategy

### When to Invalidate
1. **Profile Updates** → Invalidate `user:profile:{userId}`
2. **New Post** → Invalidate `posts:user:{userId}` and `timeline:public`
3. **Follow/Unfollow** → Invalidate follow/follower lists
4. **Like Post** → Invalidate user's likes cache
5. **User Logout** → Remove session data

### Batch Invalidation
```javascript
const invalidateUserData = async (userId) => {
  const keys = [
    `user:profile:${userId}`,
    `posts:user:${userId}`,
    `following:${userId}`,
    `followers:${userId}`,
    `likes:user:${userId}`,
    `session:${userId}`
  ];
  
  await redis.del(...keys);
};
```

---

## Performance Optimization

### Connection Pooling
```javascript
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
  maxMemoryPolicy: 'allkeys-lru'
});
```

### Memory Management
- **Max Memory**: 1GB for MVP
- **Eviction Policy**: `allkeys-lru` (Least Recently Used)
- **Memory Usage Monitoring**: Track usage via CloudWatch

### Key Expiration Strategy
```javascript
// Automatic cleanup of expired keys
const cleanupExpiredKeys = async () => {
  // Redis handles this automatically with TTL
  // But we can monitor memory usage
  const info = await redis.info('memory');
  console.log('Redis memory usage:', info);
};
```

---

## Rate Limiting (MVP)

### API Rate Limiting
```javascript
// Simple rate limiting per user
Key Pattern: "rate_limit:{userId}:{endpoint}"
TTL: 60 seconds (sliding window)
Data: request_count

// Example: Limit post creation to 10 per minute
const checkRateLimit = async (userId, endpoint, limit = 10) => {
  const key = `rate_limit:${userId}:${endpoint}`;
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.expire(key, 60); // 1 minute window
  }
  
  return current <= limit;
};
```

---

## Monitoring & Alerts

### Key Metrics to Track
1. **Cache Hit Rate** → Target >80%
2. **Memory Usage** → Alert at >80%
3. **Connection Count** → Monitor for leaks
4. **Response Time** → Target <5ms

### Health Check
```javascript
const redisHealthCheck = async () => {
  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      latency: `${latency}ms`,
      memory: await redis.info('memory'),
      connections: await redis.info('clients')
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};
```

This simplified Redis design focuses exclusively on your MVP features while providing a solid foundation for caching and session management.
