# Fedify Social Network

A federated social network built with Fedify, DynamoDB, and Redis.

## Features

- ✅ **Text Posting**: Create and view text posts
- ✅ **Federation**: Interoperate with ActivityPub servers (Mastodon, etc.)
- ✅ **Persistent Storage**: Posts stored in DynamoDB
- ✅ **Caching**: Redis for fast performance
- ✅ **Scalable**: Production-ready architecture

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file with:

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here

# DynamoDB Table Names
POSTS_TABLE=fedify-posts
USERS_TABLE=fedify-users

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Server Configuration
PORT=8001
```

### 3. Setup DynamoDB

```bash
npm run setup-db
```

### 4. Start Redis

Make sure Redis is running locally or update `REDIS_URL` in your `.env` file.

### 5. Start the Server

```bash
npm run dev
```

## Architecture

- **DynamoDB**: Persistent storage for posts
- **Redis**: Caching layer for fast reads
- **Fedify**: ActivityPub federation
- **Express**: Web server and API

## API Endpoints

- `GET /` - Web interface
- `POST /api/posts` - Create a post
- `GET /api/posts` - Get all posts
- `GET /api/users/:username/posts` - Get posts by user

## Federation

- `GET /.well-known/webfinger` - User discovery
- `GET /.well-known/nodeinfo` - Server information
- `GET /users/:username` - User profiles

## Database Schema

### Posts Table
- `id` (String, Primary Key)
- `username` (String)
- `content` (String)
- `createdAt` (String)
- `attributedTo` (String)
- `username_createdAt` (String, GSI)

## Caching Strategy

- **Individual posts**: 1 hour cache
- **All posts**: 5 minutes cache
- **User posts**: 5 minutes cache
- **Cache invalidation**: Automatic on new posts 