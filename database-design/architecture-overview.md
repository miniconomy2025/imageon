# Database Architecture Overview

## System Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Backend       │
│   (React)       │◄──►│   (Express.js)  │◄──►│   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                       ┌────────────────────────────────┼────────────────────────────────┐
                       │                                │                                │
                       ▼                                ▼                                ▼
            ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
            │   DynamoDB      │              │     Redis       │              │   S3 Bucket     │
            │  (Primary DB)   │              │    (Cache)      │              │ (Media Files)   │
            └─────────────────┘              └─────────────────┘              └─────────────────┘
```

## Data Flow Architecture

### Write Operations
1. **User creates post** → API validates → DynamoDB writes → Redis cache update → S3 media upload
2. **User follows someone** → Transaction in DynamoDB → Redis cache invalidation → Feed regeneration
3. **User likes post** → Redis immediate update → Background DynamoDB sync

### Read Operations
1. **Load feed** → Check Redis cache → If miss, query DynamoDB → Cache result
2. **User profile** → Redis cache → Fallback to DynamoDB
3. **Search users** → Redis autocomplete → Enhanced results from DynamoDB

---

## Database Comparison Summary

| Feature | DynamoDB | Redis | Recommendation |
|---------|----------|-------|----------------|
| **Primary Storage** | ✅ Perfect | ❌ Not suitable | Use DynamoDB |
| **Caching** | ❌ Overkill | ✅ Ideal | Use Redis |
| **Real-time Features** | ❌ Not optimal | ✅ Excellent | Use Redis |
| **Complex Queries** | ⚠️ Limited | ❌ Very limited | Design around limitations |
| **Scalability** | ✅ Unlimited | ✅ Very high | Both excellent |
| **Cost at Scale** | ✅ Predictable | ✅ Cost-effective | Both good |
| **ACID Transactions** | ⚠️ Limited | ❌ No | Design carefully |

---

## Implementation Priority

### Phase 1: MVP Core
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
