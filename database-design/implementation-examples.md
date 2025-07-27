# Database Schema Implementation Examples

## DynamoDB Table Creation Scripts

### Main Table: SocialMediaApp
```javascript
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB();

const createMainTable = async () => {
  const params = {
    TableName: 'SocialMediaApp',
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'GSI1PK', AttributeType: 'S' },
      { AttributeName: 'GSI1SK', AttributeType: 'S' },
      { AttributeName: 'GSI2PK', AttributeType: 'S' },
      { AttributeName: 'GSI2SK', AttributeType: 'S' },
      { AttributeName: 'GSI3PK', AttributeType: 'S' },
      { AttributeName: 'GSI3SK', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'GSI1',
        KeySchema: [
          { AttributeName: 'GSI1PK', KeyType: 'HASH' },
          { AttributeName: 'GSI1SK', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        BillingMode: 'PAY_PER_REQUEST'
      },
      {
        IndexName: 'GSI2', 
        KeySchema: [
          { AttributeName: 'GSI2PK', KeyType: 'HASH' },
          { AttributeName: 'GSI2SK', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        BillingMode: 'PAY_PER_REQUEST'
      },
      {
        IndexName: 'GSI3',
        KeySchema: [
          { AttributeName: 'GSI3PK', KeyType: 'HASH' },
          { AttributeName: 'GSI3SK', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        BillingMode: 'PAY_PER_REQUEST'
      }
    ],
    BillingMode: 'PAY_PER_REQUEST',
    StreamSpecification: {
      StreamEnabled: true,
      StreamViewType: 'NEW_AND_OLD_IMAGES'
    },
    PointInTimeRecoverySpecification: {
      PointInTimeRecoveryEnabled: true
    },
    Tags: [
      { Key: 'Environment', Value: 'production' },
      { Key: 'Application', Value: 'social-media' }
    ]
  };

  try {
    const result = await dynamodb.createTable(params).promise();
    console.log('Table created successfully:', result.TableDescription.TableName);
    return result;
  } catch (error) {
    console.error('Error creating table:', error);
    throw error;
  }
};
```

---

## Sample Data Operations

### User Registration
```javascript
const createUser = async (userData) => {
  const { user_id, username, email, display_name, bio } = userData;
  const timestamp = new Date().toISOString();

  const params = {
    TableName: 'SocialMediaApp',
    Item: {
      PK: `USER#${user_id}`,
      SK: 'PROFILE',
      GSI1PK: `USERNAME#${username}`,
      GSI1SK: 'PROFILE',
      user_id,
      username,
      email,
      display_name,
      bio: bio || '',
      profile_image_url: '',
      created_at: timestamp,
      updated_at: timestamp,
      followers_count: 0,
      following_count: 0,
      posts_count: 0,
      is_verified: false,
      is_private: false,
      status: 'active'
    },
    ConditionExpression: 'attribute_not_exists(PK)' // Prevent duplicates
  };

  try {
    await dynamoClient.put(params).promise();
    
    // Cache user profile in Redis
    await redis.hset(`user:${user_id}:profile`, {
      username,
      display_name,
      bio,
      followers_count: 0,
      following_count: 0,
      posts_count: 0
    });
    await redis.expire(`user:${user_id}:profile`, 3600);

    return { success: true, user_id };
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      throw new Error('User already exists');
    }
    throw error;
  }
};
```

### Create Post
```javascript
const createPost = async (postData) => {
  const { user_id, username, content, content_type, media_urls, hashtags, mentions } = postData;
  const post_id = `post_${Date.now()}_${user_id}`;
  const timestamp = new Date().toISOString();
  const dateKey = timestamp.split('T')[0]; // YYYY-MM-DD

  // Transaction to create post and update user post count
  const params = {
    TransactItems: [
      {
        Put: {
          TableName: 'SocialMediaApp',
          Item: {
            PK: `POST#${post_id}`,
            SK: 'METADATA',
            GSI1PK: `USER#${user_id}`,
            GSI1SK: `POST#${timestamp}#${post_id}`,
            GSI2PK: `TIMELINE#${dateKey}`,
            GSI2SK: `${timestamp}#${post_id}`,
            post_id,
            author_id: user_id,
            author_username: username,
            content,
            content_type,
            media_urls: media_urls || [],
            created_at: timestamp,
            updated_at: timestamp,
            likes_count: 0,
            comments_count: 0,
            shares_count: 0,
            engagement_score: 0,
            visibility: 'public',
            is_deleted: false,
            hashtags: hashtags || [],
            mentions: mentions || []
          }
        }
      },
      {
        Update: {
          TableName: 'SocialMediaApp',
          Key: {
            PK: `USER#${user_id}`,
            SK: 'PROFILE'
          },
          UpdateExpression: 'ADD posts_count :inc SET updated_at = :timestamp',
          ExpressionAttributeValues: {
            ':inc': 1,
            ':timestamp': timestamp
          }
        }
      }
    ]
  };

  try {
    await dynamoClient.transactWrite(params).promise();

    // Add to Redis cache
    await redis.hset(`post:${post_id}:stats`, {
      likes_count: 0,
      comments_count: 0,
      shares_count: 0,
      views_count: 0
    });
    await redis.expire(`post:${post_id}:stats`, 21600); // 6 hours

    // Trigger feed update for followers (via DynamoDB Stream)
    return { success: true, post_id, timestamp };
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};
```

### Follow User
```javascript
const followUser = async (follower_id, followed_id, follower_username, followed_username) => {
  const timestamp = new Date().toISOString();
  const follow_id = `${follower_id}#${followed_id}`;

  const params = {
    TransactItems: [
      {
        Put: {
          TableName: 'SocialMediaApp',
          Item: {
            PK: `USER#${follower_id}`,
            SK: `FOLLOWING#${followed_id}`,
            GSI1PK: `USER#${followed_id}`,
            GSI1SK: `FOLLOWER#${follower_id}`,
            GSI2PK: 'FOLLOW_GRAPH',
            GSI2SK: `${timestamp}#${follow_id}`,
            follower_id,
            followed_id,
            follower_username,
            followed_username,
            created_at: timestamp,
            status: 'active',
            notification_enabled: true
          },
          ConditionExpression: 'attribute_not_exists(PK)'
        }
      },
      {
        Update: {
          TableName: 'SocialMediaApp',
          Key: { PK: `USER#${follower_id}`, SK: 'PROFILE' },
          UpdateExpression: 'ADD following_count :inc',
          ExpressionAttributeValues: { ':inc': 1 }
        }
      },
      {
        Update: {
          TableName: 'SocialMediaApp',
          Key: { PK: `USER#${followed_id}`, SK: 'PROFILE' },
          UpdateExpression: 'ADD followers_count :inc',
          ExpressionAttributeValues: { ':inc': 1 }
        }
      }
    ]
  };

  try {
    await dynamoClient.transactWrite(params).promise();

    // Update Redis caches
    await redis.del(`followers:${followed_id}`, `following:${follower_id}`);
    
    // Add to follower's feed generation queue
    await redis.lpush(`feed_regen_queue`, JSON.stringify({
      user_id: follower_id,
      action: 'follow',
      target_user: followed_id,
      timestamp
    }));

    return { success: true };
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      throw new Error('Already following this user');
    }
    throw error;
  }
};
```

---

## Feed Generation System

### DynamoDB Stream Handler for Feed Updates
```javascript
const AWS = require('aws-sdk');
const dynamoClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName === 'INSERT' && record.dynamodb.Keys.SK.S === 'METADATA') {
      const postData = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
      
      if (postData.PK.startsWith('POST#')) {
        await distributeFeedUpdate(postData);
      }
    }
  }
};

const distributeFeedUpdate = async (postData) => {
  const { author_id, post_id, content, created_at } = postData;
  
  // Get author's followers
  const followersResult = await dynamoClient.query({
    TableName: 'SocialMediaApp',
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${author_id}`,
      ':sk': 'FOLLOWER#'
    }
  }).promise();

  // Batch write to followers' feeds
  const batchSize = 25;
  const followers = followersResult.Items;
  
  for (let i = 0; i < followers.length; i += batchSize) {
    const batch = followers.slice(i, i + batchSize);
    const writeRequests = batch.map(follower => ({
      PutRequest: {
        Item: {
          PK: `FEED#${follower.follower_id}`,
          SK: `${created_at}#${post_id}`,
          GSI1PK: `FEED_MANAGEMENT#${follower.follower_id}`,
          GSI1SK: created_at,
          user_id: follower.follower_id,
          post_id,
          author_id,
          author_username: postData.author_username,
          content_preview: content.substring(0, 200),
          content_type: postData.content_type,
          created_at,
          inserted_at: new Date().toISOString(),
          engagement_score: 0,
          is_promoted: false,
          feed_rank: 1.0
        }
      }
    }));

    if (writeRequests.length > 0) {
      await dynamoClient.batchWrite({
        RequestItems: {
          'SocialMediaApp': writeRequests
        }
      }).promise();
    }
  }

  // Update Redis feed caches for active users
  await updateRedisFeedCaches(followers, postData);
};
```

---

## Redis Connection Setup

### Production Redis Configuration
```javascript
const Redis = require('ioredis');

// Redis Cluster Configuration
const redis = new Redis.Cluster([
  {
    host: 'your-redis-cluster-endpoint.cache.amazonaws.com',
    port: 6379
  }
], {
  dnsLookup: (address, callback) => callback(null, address),
  redisOptions: {
    password: process.env.REDIS_PASSWORD,
    connectTimeout: 10000,
    commandTimeout: 5000,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    keepAlive: 30000
  },
  enableOfflineQueue: false,
  scaleReads: 'slave'
});

// Connection event handlers
redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('close', () => {
  console.log('Redis connection closed');
});

module.exports = redis;
```

### Redis Helper Functions
```javascript
const redis = require('./redis-connection');

class CacheManager {
  // Set with automatic expiration
  async setWithTTL(key, value, ttlSeconds = 3600) {
    if (typeof value === 'object') {
      value = JSON.stringify(value);
    }
    await redis.setex(key, ttlSeconds, value);
  }

  // Get and parse JSON if needed
  async get(key) {
    const value = await redis.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  // Hash operations for complex objects
  async setHash(key, obj, ttlSeconds = 3600) {
    await redis.hset(key, obj);
    await redis.expire(key, ttlSeconds);
  }

  async getHash(key) {
    return await redis.hgetall(key);
  }

  // Sorted set operations for feeds
  async addToFeed(userId, postId, score, postData) {
    const feedKey = `feed:${userId}`;
    await redis.zadd(feedKey, score, JSON.stringify({ postId, ...postData }));
    await redis.expire(feedKey, 3600); // 1 hour TTL
    
    // Keep only latest 100 posts in cache
    await redis.zremrangebyrank(feedKey, 0, -101);
  }

  async getFeed(userId, limit = 20) {
    const feedKey = `feed:${userId}`;
    const posts = await redis.zrevrange(feedKey, 0, limit - 1);
    return posts.map(post => JSON.parse(post));
  }

  // Rate limiting
  async checkRateLimit(userId, action, limit, windowSeconds) {
    const key = `rate:${userId}:${action}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
    const current = await redis.incr(key);
    await redis.expire(key, windowSeconds);
    return current <= limit;
  }

  // Batch operations
  async pipeline(operations) {
    const pipe = redis.pipeline();
    operations.forEach(op => {
      pipe[op.command](...op.args);
    });
    return await pipe.exec();
  }
}

module.exports = new CacheManager();
```

This implementation provides a solid foundation for your social media app's database layer with both DynamoDB and Redis working together efficiently.
