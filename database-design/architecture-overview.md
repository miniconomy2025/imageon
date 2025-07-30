# Database Architecture Overview - MVP

## System Architecture Diagram

```
┌─────────────────┐    ┌────────────────────────────────────────┐    ┌─────────────────┐
│   Frontend      │    │          Backend EC2                   │    │   AWS Services  │
│   (React/TS)    │◄──►│  ┌─────────────────┐                   │◄──►│                 │
│                 │    │  │   Backend API   │                   │    │                 │
│   Frontend EC2  │    │  │   (Node.js/TS)  │                   │    │                 │
└─────────────────┘    │  └─────────────────┘                   │    └─────────────────┘
                       │            │                           │                │
                       │  ┌─────────┼──────────┐                │                │
                       │  │         │          │                │                │
                       │  ▼         ▼          ▼                │                ▼
                       │┌──────┐ ┌──────┐ ┌─────────┐           │     ┌─────────────────┐
                       ││Dynamo│ │Redis │ │ Fedify  │           │     │   S3 Bucket     │
                       ││Local │ │Cache │ │ +Cache  │           │     │ (Media Files)   │
                       │└──────┘ └──────┘ └─────────┘           │     └─────────────────┘
                       └────────────────────────────────────────┘
```

## MVP Data Flow

### Core Operations
1. **Create Post** → Validate content → Store in DynamoDB Local → Fedify handles caching → Upload media to S3
2. **Follow User** → Transaction in DynamoDB Local → Update follower counts → Fedify cache update
3. **Like Post** → Store in DynamoDB Local → Update post like count → Fedify cache management
4. **View Profile** → Fedify checks cache → Query DynamoDB Local if needed → Return ActivityPub-compatible data

### Read Operations (Optimized for MVP)
1. **Load User Posts** → Fedify cache → DynamoDB Local query with GSI1
2. **User Profile** → Fedify cache → DynamoDB Local user profile query
3. **Following/Followers Lists** → DynamoDB Local relationship queries

---

## Single Table Design Benefits

| Feature | Benefit | MVP Use Case |
|---------|---------|--------------|
| **Cost Efficiency** | No AWS DynamoDB costs | Perfect for school project budget |
| **Simple Setup** | Self-contained on EC2 | Easy development and deployment |
| **Local Control** | Full control over database | No AWS service dependencies |
| **Fedify Integration** | Built-in ActivityPub caching | Simplified cache management |

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

## Cache Strategy (Fedify + Redis)

### What Fedify Handles (Built-in Redis Integration)
1. **ActivityPub Objects** - Actor, Note, Follow, Like activities (stored in Redis db 1)
2. **Federation Cache** - Remote actor data and posts (automatic caching)
3. **Activity Streams** - Cached activity sequences for timelines
4. **Signature Verification** - Cached public keys and verification results
5. **Queue Management** - ActivityPub message processing queues

### What You Still Handle (Application Level - Redis db 0)
1. **User Sessions** - JWT tokens and auth state 
2. **API Rate Limiting** - Request counters per user/IP
3. **Custom Application Cache** - Any app-specific caching needs

### Redis Database Separation
- **Database 0**: Your application (sessions, rate limiting, custom cache)
- **Database 1**: Fedify's ActivityPub federation (automatic management)

### Cache TTL Strategy
- ActivityPub objects: Managed automatically by Fedify (Redis db 1)
- User sessions: 24 hours (Redis db 0)
- Rate limiting counters: 1 hour (Redis db 0)
- Database connections: Connection pool managed

---

## Database Capacity Planning

### MVP Estimated Load
- **Users**: 1,000 active users
- **Posts per day**: 500
- **Likes per day**: 2,000
- **Follow actions per day**: 100

### Infrastructure Setup
- **Frontend EC2**: Serves React application, handles routing
- **Backend EC2**: API server, DynamoDB Local, Redis, Fedify integration

### DynamoDB Local Capacity (Backend EC2)
- **Memory Allocation**: 2GB heap size recommended
- **Storage**: File-based persistence in `/home/dynamodblocal/data`
- **Performance**: Limited by EC2 instance specs
- **Concurrent Connections**: Recommended max 100

### Redis Capacity (Backend EC2)
- **Memory**: 512MB (reduced since Fedify handles most caching)
- **Connections**: 500 concurrent
- **Primary Use**: Sessions and rate limiting only

---

## Security Considerations

### Authentication
- JWT tokens stored in Redis
- Token blacklisting for logout
- Secure cookie handling

### Data Protection
- DynamoDB Local file-based storage (no encryption at rest)
- S3 bucket encryption
- HTTPS only communication
- **⚠️ Note**: DynamoDB Local doesn't provide encryption at rest

### Rate Limiting
- Redis-based rate limiting
- Per-user and per-IP limits
- API endpoint protection

---

## Monitoring & Health Checks

### Key Metrics to Track
1. **Frontend EC2** - Static file serving, routing performance
2. **Backend API Responses** - Target <200ms
3. **DynamoDB Local Performance** - Query response times, memory usage
4. **Redis Performance** - Session storage, rate limiting counters
5. **S3 Upload Success Rate** - Target >99%
6. **Fedify Cache Performance** - ActivityPub object caching efficiency

### Health Check Endpoints
- **Frontend**: `/` - Application availability
- **Backend**: `/health` - Basic service health
- **Backend**: `/health/db` - DynamoDB Local connectivity
- **Backend**: `/health/cache` - Redis connectivity
- **Backend**: `/health/storage` - S3 connectivity
- **Backend**: `/health/fedify` - Fedify service status

This simplified architecture focuses on delivering your MVP features efficiently while maintaining the foundation for future growth and ActivityPub federation capabilities.

---

## Deployment Considerations

### Backend EC2 Setup Requirements
1. **Docker Installation**: Required for DynamoDB Local and Redis containers
2. **Memory Requirements**: Minimum 4GB RAM (2GB for DynamoDB Local, 512MB for Redis, rest for Node.js)
3. **Storage**: SSD recommended for DynamoDB Local performance
4. **Service Startup Order**:
   ```bash
   1. Start DynamoDB Local container
   2. Start Redis container  
   3. Wait for services to be ready
   4. Run database setup script
   5. Start Node.js API server
   ```

### Production Limitations (Important for School Project)
- **Data Loss Risk**: If EC2 instance restarts, all data in DynamoDB Local is lost unless properly persisted
- **No Automatic Backups**: Manual backup strategy needed if data preservation is important
- **Single Point of Failure**: No redundancy or failover capabilities
- **Limited Scalability**: Cannot scale beyond single EC2 instance resources

### Recommended EC2 Instance Types
- **Development**: t3.medium (2 vCPU, 4GB RAM)
- **Production**: t3.large (2 vCPU, 8GB RAM) for better performance
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
