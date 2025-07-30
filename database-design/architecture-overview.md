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
                       │┌────────┐ ┌──────┐ ┌─────────┐         │     ┌─────────────────┐
                       ││DynamoDB| │Redis │ │ Fedify  │         │     │   S3 Bucket     │
                       ││Local   | │Queue │ │ Integration│      │     │ (Media Files)   │
                       ││+Fedify | │Mgmt  │ │ Layer   │         │     └─────────────────┘
                       │└────────┘ └──────┘ └─────────┘         │     
                       └────────────────────────────────────────┘
```

## MVP Data Flow

### Core Operations
1. **Create Post** → Validate content → Store in DynamoDB Local → Fedify stores ActivityPub data in same DynamoDB → Upload media to S3
2. **Follow User** → Transaction in DynamoDB Local → Update follower counts → Fedify stores ActivityPub data in DynamoDB
3. **Like Post** → Store in DynamoDB Local → Update post like count → Fedify manages ActivityPub activities in DynamoDB
4. **View Profile** → Query DynamoDB Local for both app data and Fedify data → Return ActivityPub-compatible data

### Read Operations (Unified Database)
1. **Load User Posts** → Single DynamoDB query (app data + Fedify data in same database)
2. **User Profile** → Single DynamoDB query (unified storage)
3. **Following/Followers Lists** → DynamoDB relationship queries
4. **ActivityPub Federation** → DynamoDB stores remote actor data and activities

---

## Single Table Design Benefits

| Feature                | Benefit                                 | MVP Use Case 
|------------------------|-----------------------------------------|--------------
| **Unified Database**   | Single DynamoDB for app + Fedify data   | Simplified data management
| **Cost Efficiency**    | No AWS DynamoDB costs                   | Perfect for school project budget
| **Data Consistency**   | All data in one database                | No cache synchronization issues
| **Fedify Integration** | Native DynamoDB storage for ActivityPub | Best performance and reliability

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

## Data Storage Strategy (Unified DynamoDB + Minimal Redis)

### What's Stored in DynamoDB Local (Primary Database)
1. **Your Application Data**:
   - User profiles, posts, likes, follows
   - Authentication data, user sessions
   
2. **Fedify's ActivityPub Data** (same database, different key patterns):
   - ActivityPub Objects (Actor, Note, Follow, Like activities) - `FEDIFY#` prefix
   - Remote Federation Data (cached remote actor data and posts)
   - Activity Streams (activity sequences)
   - Signature Verification (cached public keys)
   - Job Queue Storage (ActivityPub message processing jobs)

### What Redis Handles (Minimal Usage)
1. **Queue Notifications** - Redis pub/sub for immediate job processing
2. **Rate Limiting** - API request counters (optional - could move to DynamoDB)
3. **Real-time Features** - WebSocket sessions, live updates (if needed)

### Database Key Patterns
- **Your App Data**: `USER#123`, `POST#456`, `FOLLOW#123#456`
- **Fedify Data**: `FEDIFY#actor:domain.com:username`, `FEDIFY#activity:12345`
- **Fedify Jobs**: `QUEUE#activitypub`, `JOB#job_id_123`

### Cache TTL Strategy
- ActivityPub objects: TTL handled in DynamoDB (configurable per item)
- User sessions: 24 hours (stored in DynamoDB with TTL)
- Rate limiting counters: 1 hour (DynamoDB with TTL)
- Job queue items: 24 hours (DynamoDB with automatic cleanup)
- Remote federation data: Configurable TTL per ActivityPub object type

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

### DynamoDB Local Capacity (Backend EC2) - Unified Storage
- **Memory Allocation**: 3GB heap size recommended (more data now)
- **Storage**: File-based persistence in `/home/dynamodblocal/data`
- **Performance**: Limited by EC2 instance specs
- **Concurrent Connections**: Recommended max 100
- **Data Types**: Application data + Fedify ActivityPub data + Job queues

### Redis Capacity (Backend EC2) - Minimal Usage
- **Memory**: 256MB (much reduced - only for queue notifications)
- **Connections**: 100 concurrent
- **Primary Use**: Job queue notifications, optional rate limiting

---

## Security Considerations

### Authentication
- JWT tokens stored in DynamoDB with TTL
- Token blacklisting for logout in DynamoDB
- Secure cookie handling

### Data Protection
- DynamoDB Local file-based storage (no encryption at rest)
- S3 bucket encryption
- HTTPS only communication
- **⚠️ Note**: DynamoDB Local doesn't provide encryption at rest

### Rate Limiting
- DynamoDB-based rate limiting with TTL
- Per-user and per-IP limits stored in DynamoDB
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
// DynamoDB TTL: Cache frequently accessed profiles with TTL

// POST /api/users/:id/follow
// DynamoDB: Transaction to create follow relationship + update counters
// Redis: Notify job queue for ActivityPub federation

// GET /api/users/:id/followers
// DynamoDB: Query PK = "USER#user123" SK begins_with "FOLLOWER#"
// DynamoDB TTL: Cache follower lists with 30-minute TTL
```

### Post Operations
```javascript
// POST /api/posts
// S3: Upload media files (if any)
// DynamoDB: Create post record + update user post count
// Redis: Queue ActivityPub federation job notification

// GET /api/posts/:id
// DynamoDB: Direct query (fast local storage)
// DynamoDB TTL: Popular posts cached with extended TTL

// POST /api/posts/:id/like
// DynamoDB: Immediate write to likes table + update post counter
// Redis: Queue ActivityPub federation job for remote servers
```

### Feed Operations
```javascript
// GET /api/feed
// DynamoDB: Query user's feed table directly
// DynamoDB TTL: Pre-computed feeds cached with TTL
// Background: Feed updates via DynamoDB job queue

// GET /api/timeline
// DynamoDB: Query GSI2 for recent posts in timeframe
// DynamoDB TTL: Popular timeline content cached with longer TTL
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
