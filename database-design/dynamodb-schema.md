# DynamoDB Schema Design for Social Media App

## Overview
This design uses single-table design principles with DynamoDB, optimizing for access patterns and minimizing costs.

## Main Table: `SocialMediaApp`

### Primary Key Structure
- **PK (Partition Key)**: Entity identifier
- **SK (Sort Key)**: Entity type and additional sorting information

### Global Secondary Indexes (GSI)

#### GSI1: User-Based Queries
- **GSI1PK**: User-related groupings
- **GSI1SK**: Time-based or type-based sorting

#### GSI2: Time-Based Queries
- **GSI2PK**: Time-based partitioning
- **GSI2SK**: Timestamp for chronological sorting

#### GSI3: Content Discovery
- **GSI3PK**: Content type groupings
- **GSI3SK**: Popularity or engagement metrics

---

## Entity Designs

### 1. USER Entity
```
PK: USER#user123
SK: PROFILE
GSI1PK: USER#user123
GSI1SK: PROFILE
Attributes:
  - username: "john_doe"
  - email: "john@example.com"
  - display_name: "John Doe"
  - bio: "Software developer and coffee enthusiast"
  - profile_image_url: "https://..."
  - created_at: "2025-01-27T10:00:00Z"
  - updated_at: "2025-01-27T10:00:00Z"
  - followers_count: 150
  - following_count: 200
  - posts_count: 45
  - is_verified: false
  - is_private: false
  - status: "active"
```

### 2. POST Entity
```
PK: POST#post456
SK: METADATA
GSI1PK: USER#user123
GSI1SK: POST#2025-01-27T15:30:00Z#post456
GSI2PK: TIMELINE#2025-01-27
GSI2SK: 2025-01-27T15:30:00Z#post456
GSI3PK: POPULAR_POSTS
GSI3SK: 1000#2025-01-27T15:30:00Z (engagement_score#timestamp)
Attributes:
  - author_id: "user123"
  - author_username: "john_doe"
  - content: "Just launched my new project! 🚀"
  - content_type: "text" | "image" | "video"
  - media_urls: ["https://..."]
  - created_at: "2025-01-27T15:30:00Z"
  - updated_at: "2025-01-27T15:30:00Z"
  - likes_count: 25
  - comments_count: 5
  - shares_count: 2
  - engagement_score: 1000 (calculated metric)
  - visibility: "public" | "followers" | "private"
  - is_deleted: false
  - hashtags: ["#coding", "#startup"]
  - mentions: ["@jane_doe"]
```

### 3. FOLLOW Relationship
```
PK: USER#user123
SK: FOLLOWING#user456
GSI1PK: USER#user456
GSI1SK: FOLLOWER#user123
GSI2PK: FOLLOW_GRAPH
GSI2SK: 2025-01-27T12:00:00Z#user123#user456
Attributes:
  - follower_id: "user123"
  - followed_id: "user456"
  - follower_username: "john_doe"
  - followed_username: "jane_doe"
  - created_at: "2025-01-27T12:00:00Z"
  - status: "active" | "blocked" | "muted"
  - notification_enabled: true
```

### 4. USER FEED (Pre-computed)
```
PK: FEED#user123
SK: 2025-01-27T15:30:00Z#post456
GSI1PK: FEED_MANAGEMENT#user123
GSI1SK: 2025-01-27T15:30:00Z
Attributes:
  - user_id: "user123"
  - post_id: "post456"
  - author_id: "user456"
  - author_username: "jane_doe"
  - content_preview: "Just shared an amazing sunset photo..."
  - content_type: "image"
  - created_at: "2025-01-27T15:30:00Z"
  - inserted_at: "2025-01-27T15:31:00Z"
  - engagement_score: 850
  - is_promoted: false
  - feed_rank: 1.0
```

### 5. LIKE Entity
```
PK: POST#post456
SK: LIKE#user123
GSI1PK: USER#user123
GSI1SK: LIKE#2025-01-27T16:00:00Z#post456
Attributes:
  - user_id: "user123"
  - post_id: "post456"
  - author_id: "user456"
  - created_at: "2025-01-27T16:00:00Z"
  - like_type: "like" | "love" | "laugh" (future expansion)
```

### 6. COMMENT Entity
```
PK: POST#post456
SK: COMMENT#comment789
GSI1PK: USER#user123
GSI1SK: COMMENT#2025-01-27T16:30:00Z#comment789
GSI2PK: COMMENT#comment789
GSI2SK: METADATA
Attributes:
  - comment_id: "comment789"
  - post_id: "post456"
  - user_id: "user123"
  - username: "john_doe"
  - content: "Great post! Thanks for sharing."
  - created_at: "2025-01-27T16:30:00Z"
  - updated_at: "2025-01-27T16:30:00Z"
  - likes_count: 3
  - replies_count: 1
  - parent_comment_id: null (for nested comments)
  - is_deleted: false
```

---

## Access Patterns & Queries

### User Profile Queries
```javascript
// Get user profile
{
  TableName: "SocialMediaApp",
  Key: {
    PK: "USER#user123",
    SK: "PROFILE"
  }
}

// Get user's posts
{
  TableName: "SocialMediaApp",
  IndexName: "GSI1",
  KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :sk)",
  ExpressionAttributeValues: {
    ":pk": "USER#user123",
    ":sk": "POST#"
  },
  ScanIndexForward: false, // newest first
  Limit: 20
}
```

### Feed Queries
```javascript
// Get user's personalized feed
{
  TableName: "SocialMediaApp",
  KeyConditionExpression: "PK = :pk",
  ExpressionAttributeValues: {
    ":pk": "FEED#user123"
  },
  ScanIndexForward: false,
  Limit: 20,
  ExclusiveStartKey: lastEvaluatedKey // for pagination
}

// Get timeline posts (discovery)
{
  TableName: "SocialMediaApp",
  IndexName: "GSI2",
  KeyConditionExpression: "GSI2PK = :pk",
  ExpressionAttributeValues: {
    ":pk": "TIMELINE#2025-01-27"
  },
  ScanIndexForward: false,
  Limit: 50
}
```

### Social Graph Queries
```javascript
// Get user's following list
{
  TableName: "SocialMediaApp",
  KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
  ExpressionAttributeValues: {
    ":pk": "USER#user123",
    ":sk": "FOLLOWING#"
  },
  Limit: 100
}

// Get user's followers
{
  TableName: "SocialMediaApp",
  IndexName: "GSI1",
  KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :sk)",
  ExpressionAttributeValues: {
    ":pk": "USER#user123",
    ":sk": "FOLLOWER#"
  },
  Limit: 100
}
```

### Engagement Queries
```javascript
// Get post likes
{
  TableName: "SocialMediaApp",
  KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
  ExpressionAttributeValues: {
    ":pk": "POST#post456",
    ":sk": "LIKE#"
  },
  Limit: 50
}

// Get post comments
{
  TableName: "SocialMediaApp",
  KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
  ExpressionAttributeValues: {
    ":pk": "POST#post456",
    ":sk": "COMMENT#"
  },
  ScanIndexForward: true, // oldest first for comments
  Limit: 20
}
```

---

## Capacity Planning

### Read Capacity Units (RCU) Estimation
- **User profile views**: 100 RCU/sec
- **Feed loading**: 200 RCU/sec  
- **Post details**: 50 RCU/sec
- **Social graph**: 30 RCU/sec
- **Total**: ~400 RCU/sec

### Write Capacity Units (WCU) Estimation
- **New posts**: 20 WCU/sec
- **Likes/reactions**: 50 WCU/sec
- **Comments**: 15 WCU/sec
- **Follow/unfollow**: 10 WCU/sec
- **Feed updates**: 100 WCU/sec (via streams)
- **Total**: ~200 WCU/sec

### Cost Optimization Tips
1. Use **On-Demand billing** for unpredictable traffic
2. Enable **Auto Scaling** for provisioned capacity
3. Implement **TTL** for temporary data (feed entries older than 30 days)
4. Use **DynamoDB Streams** for real-time feed updates
5. Batch operations where possible to reduce API calls

---

## Data Consistency & Transactions

### Eventually Consistent Reads
- Feed loading (acceptable to see slightly stale data)
- Follower/following counts
- Like counts display

### Strong Consistency Required
- User authentication data
- Follow/unfollow actions
- Post creation/deletion

### Transaction Examples
```javascript
// Follow a user (atomic operation)
const followUser = {
  TransactItems: [
    {
      Put: {
        TableName: "SocialMediaApp",
        Item: {
          PK: "USER#user123",
          SK: "FOLLOWING#user456",
          // ... other attributes
        }
      }
    },
    {
      Put: {
        TableName: "SocialMediaApp", 
        Item: {
          PK: "USER#user456",
          SK: "FOLLOWER#user123",
          // ... other attributes
        }
      }
    },
    {
      Update: {
        TableName: "SocialMediaApp",
        Key: { PK: "USER#user123", SK: "PROFILE" },
        UpdateExpression: "ADD following_count :inc",
        ExpressionAttributeValues: { ":inc": 1 }
      }
    },
    {
      Update: {
        TableName: "SocialMediaApp", 
        Key: { PK: "USER#user456", SK: "PROFILE" },
        UpdateExpression: "ADD followers_count :inc",
        ExpressionAttributeValues: { ":inc": 1 }
      }
    }
  ]
};
```
