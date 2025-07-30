# Database Architecture Overview - MVP

## System Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   AWS Services  │
│   (React/TS)    │◄──►│   (Node.js/TS)  │◄──►│                 │
│                 │    │                 │    │                 │
│   Frontend EC2  │    │  Backend EC2    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                       ┌────────────────────────────────┼────────────────────────────────┐
                       │                                │                                │
                       ▼                                ▼                                ▼
            ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
            │   DynamoDB      │              │     Redis       │              │   S3 Bucket     │
            │ (Single Table)  │              │  (Cache/Auth)   │              │ (Media Files)   │
            └─────────────────┘              └─────────────────┘              └─────────────────┘
```

## MVP Data Flow

### Core Operations
1. **Create Post** → Validate content → Store in DynamoDB → Cache timeline → Upload media to S3
2. **Follow User** → Transaction in DynamoDB → Update follower counts → Cache relationship
3. **Like Post** → Store in DynamoDB → Update post like count → Cache user's likes
4. **View Profile** → Check Redis cache → Query DynamoDB if needed → Return ActivityPub-compatible data

### Read Operations (Optimized for MVP)
1. **Load User Posts** → Redis cache → DynamoDB query with GSI1
2. **User Profile** → Redis cache → DynamoDB user profile query
3. **Following/Followers Lists** → DynamoDB relationship queries

---

## Single Table Design Benefits

| Feature | Benefit | MVP Use Case |
|---------|---------|--------------|
| **Cost Efficiency** | Single table = lower costs | Perfect for MVP budget |
| **Simple Operations** | One table to manage | Faster development |
| **Performance** | Optimized access patterns | Quick user experience |
| **Scalability** | Built-in AWS scaling | Ready for growth |

---

## MVP Implementation Phases

### Phase 1: Core MVP (Current)
- ✅ User profiles (ActivityPub Actor compatible)
- ✅ Create posts with media
- ✅ Follow/unfollow users
- ✅ Like posts (no unlike)
- ✅ View user profiles
- ✅ Basic timeline

### Phase 2: Future Enhancements (Post-MVP)
- Comments on posts
- Post analytics
- Advanced search
- Notifications
- Direct messaging

---

## ActivityPub Integration

The MVP is designed with ActivityPub compatibility in mind:

### User Profiles (Actor Objects)
- Support for Person and Group types
- Public key storage for federation
- Standard ActivityPub URLs (inbox, outbox, followers, following)

### Posts (Note Objects)
- Activity streams compatible
- Public/private visibility
- Mentions and hashtags support

### Activities
- Follow activities
- Like activities  
- Create activities for posts

---

## Cache Strategy (Redis)

### What We Cache
1. **User Sessions** - JWT tokens and auth state
2. **User Profiles** - Frequently accessed profile data
3. **Recent Posts** - Timeline and user posts
4. **Follow Relationships** - User connections for quick lookups

### Cache TTL Strategy
- User profiles: 1 hour
- Recent posts: 30 minutes
- Follow relationships: 2 hours
- Session data: 24 hours

---

## Database Capacity Planning

### MVP Estimated Load
- **Users**: 1,000 active users
- **Posts per day**: 500
- **Likes per day**: 2,000
- **Follow actions per day**: 100

### Infrastructure Setup
- **Frontend EC2**: Serves React application, handles routing
- **Backend EC2**: API server, database connections, business logic

### DynamoDB Capacity
- **Read**: 50 RCU (burst to 200)
- **Write**: 25 WCU (burst to 100)
- **Storage**: ~10GB initially

### Redis Capacity (Backend EC2)
- **Memory**: 1GB
- **Connections**: 1,000 concurrent
- **Throughput**: 10,000 ops/sec

---

## Security Considerations

### Authentication
- JWT tokens stored in Redis
- Token blacklisting for logout
- Secure cookie handling

### Data Protection
- DynamoDB encryption at rest
- S3 bucket encryption
- HTTPS only communication

### Rate Limiting
- Redis-based rate limiting
- Per-user and per-IP limits
- API endpoint protection

---

## Monitoring & Health Checks

### Key Metrics to Track
1. **Frontend EC2** - Static file serving, routing performance
2. **Backend API Responses** - Target <200ms
3. **DynamoDB Throttling** - Should be 0
4. **Redis Cache Hit Rate** - Target >80%
5. **S3 Upload Success Rate** - Target >99%

### Health Check Endpoints
- **Frontend**: `/` - Application availability
- **Backend**: `/health` - Basic service health
- **Backend**: `/health/db` - DynamoDB connectivity
- **Backend**: `/health/cache` - Redis connectivity
- **Backend**: `/health/storage` - S3 connectivity

This simplified architecture focuses on delivering your MVP features efficiently while maintaining the foundation for future growth and ActivityPub federation capabilities.
1. **DynamoDB Setup**
   - Users table with GSI for username lookups
   - Posts table with GSI for user posts and timeline
   - Follows relationship table
   - Basic feed table

2. **Redis Setup**
   - User session management
   - Basic post engagement counters
   - Simple feed caching

### Phase 2: Performance Optimization
1. **Advanced Caching**
   - Feed pre-computation
   - Trending content tracking
   - User activity caching

2. **Real-time Features**
   - Pub/Sub for notifications
   - Live engagement updates
   - Online user tracking

### Phase 3: Advanced Features
1. **Enhanced Social Features**
   - Comment threading
   - Advanced search
   - Content recommendations

2. **Analytics & Monitoring**
   - User behavior tracking
   - Performance metrics
   - Cost optimization

---

## API Endpoints & Database Operations

### User Management
```javascript
// GET /api/users/:username
// DynamoDB: Query GSI1 where GSI1PK = "USERNAME#john_doe"
// Redis: Cache user profile for 1 hour

// POST /api/users/:id/follow
// DynamoDB: Transaction to create follow relationship + update counters
// Redis: Invalidate follower/following caches + trigger feed regeneration

// GET /api/users/:id/followers
// DynamoDB: Query PK = "USER#user123" SK begins_with "FOLLOWER#"
// Redis: Cache results for 30 minutes
```

### Post Operations
```javascript
// POST /api/posts
// S3: Upload media files (if any)
// DynamoDB: Create post record + update user post count
// Redis: Add to author's cache + trigger follower feed updates

// GET /api/posts/:id
// Redis: Check post cache first
// DynamoDB: Fallback query + cache for 2 hours

// POST /api/posts/:id/like
// Redis: Immediate SADD to like set + HINCRBY counter
// DynamoDB: Background sync via queue processing
```

### Feed Operations
```javascript
// GET /api/feed
// Redis: ZREVRANGE from user's feed cache
// DynamoDB: If cache miss, query feed table + cache results
// Background: Continuous feed pre-computation via DynamoDB Streams

// GET /api/timeline
// DynamoDB: Query GSI2 for recent posts in timeframe
// Redis: Cache popular posts with higher TTL
```

---

## Monitoring & Observability

### DynamoDB Metrics
- Read/Write capacity utilization
- Throttled requests
- Hot partitions
- GSI performance

### Redis Metrics
- Memory usage and hit ratios
- Connection counts
- Slow log monitoring
- Eviction rates

### Application Metrics
- API response times
- Feed generation latency
- User engagement rates
- Error rates by endpoint

---

## Disaster Recovery & Backup

### DynamoDB
- **Point-in-time recovery**: Enabled (35-day retention)
- **Cross-region replication**: Global tables for critical data
- **Backup strategy**: Daily automated backups

### Redis
- **Persistence**: RDB snapshots + AOF logging
- **Replication**: Master-replica setup
- **Backup**: Automated snapshots to S3

### Media Files (S3)
- **Versioning**: Enabled for accidental deletions
- **Cross-region replication**: Critical images replicated
- **Lifecycle policies**: Archive old media to cheaper storage

---

## Security Considerations

### Access Control
- **DynamoDB**: IAM roles with least privilege
- **Redis**: AUTH enabled + VPC isolation
- **API**: JWT tokens with session management in Redis

### Data Encryption
- **DynamoDB**: Encryption at rest and in transit
- **Redis**: TLS encryption for connections
- **S3**: Server-side encryption for media files

### Privacy & Compliance
- **User data**: Anonymization strategies for analytics
- **GDPR compliance**: Data deletion workflows
- **Content moderation**: Automated and manual review processes

This architecture provides a solid foundation for your social media MVP while maintaining scalability for future growth.
