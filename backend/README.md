# Imageon Backend API

A Node.js/Express backend API for the Imageon social media application, built with DynamoDB and following clean architecture principles.

## 🚀 Features

- **User Management**: Create, read, update, and delete users
- **DynamoDB Integration**: Multi-table design with Global Secondary Indexes
- **RESTful API**: Clean, consistent API endpoints
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Proper error responses and logging
- **Security**: Helmet for security headers, CORS support

## 📋 Prerequisites

- Node.js >= 18.0.0
- Docker (for local DynamoDB)
- AWS CLI (optional, for database operations)

## 🛠️ Installation

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up environment variables**:

   ```bash
   cp .env.example .env
   ```

   Configure your `.env` file:

   ```env
   NODE_ENV=development
   PORT=3001
   AWS_REGION=us-east-1
   DYNAMODB_ENDPOINT=http://localhost:8000
   AWS_ACCESS_KEY_ID=dummy
   AWS_SECRET_ACCESS_KEY=dummy
   ```

3. **Start DynamoDB Local**:

   ```bash
   npm run db:local:start
   ```

4. **Set up database tables** (from the `databases` folder):
   ```bash
   cd ../databases
   npm run setup:multi
   ```

## 🚀 Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on `http://localhost:3001`

## 📚 API Endpoints

### Users

| Method   | Endpoint                        | Description                     |
| -------- | ------------------------------- | ------------------------------- |
| `POST`   | `/api/users`                    | Create a new user               |
| `GET`    | `/api/users`                    | Get all users (with pagination) |
| `GET`    | `/api/users/:userId`            | Get user by ID                  |
| `GET`    | `/api/users/username/:username` | Get user by username            |
| `PUT`    | `/api/users/:userId`            | Update user profile             |
| `DELETE` | `/api/users/:userId`            | Delete user (soft delete)       |

### Posts

| Method   | Endpoint                  | Description          |
| -------- | ------------------------- | -------------------- |
| `POST`   | `/api/posts`              | Create a new post    |
| `GET`    | `/api/posts`              | Get all posts (feed) |
| `GET`    | `/api/posts/:postId`      | Get post by ID       |
| `GET`    | `/api/posts/user/:userId` | Get posts by user ID |
| `PUT`    | `/api/posts/:postId`      | Update post          |
| `DELETE` | `/api/posts/:postId`      | Delete post          |
| `POST`   | `/api/posts/:postId/like` | Like a post          |
| `DELETE` | `/api/posts/:postId/like` | Unlike a post        |

### Likes

| Method   | Endpoint                               | Description                  |
| -------- | -------------------------------------- | ---------------------------- |
| `POST`   | `/api/likes`                           | Create a new like            |
| `GET`    | `/api/likes/post/:postId/user/:userId` | Get like by post and user    |
| `GET`    | `/api/likes/post/:postId`              | Get likes by post ID         |
| `GET`    | `/api/likes/user/:userId`              | Get likes by user ID         |
| `GET`    | `/api/likes/check/:userId/:postId`     | Check if user liked post     |
| `GET`    | `/api/likes/count/:postId`             | Get like count for post      |
| `DELETE` | `/api/likes/post/:postId/user/:userId` | Delete like by post and user |
| `DELETE` | `/api/likes/user/:userId/post/:postId` | Delete like by user and post |

### Follows

| Method   | Endpoint                                                 | Description                        |
| -------- | -------------------------------------------------------- | ---------------------------------- |
| `POST`   | `/api/follows`                                           | Create a new follow relationship   |
| `GET`    | `/api/follows/follower/:followerId/followed/:followedId` | Get follow relationship            |
| `GET`    | `/api/follows/following/:userId`                         | Get users that a user is following |
| `GET`    | `/api/follows/followers/:userId`                         | Get users following a user         |
| `GET`    | `/api/follows/check/:followerId/:followedId`             | Check if user is following         |
| `GET`    | `/api/follows/following/count/:userId`                   | Get following count for user       |
| `GET`    | `/api/follows/followers/count/:userId`                   | Get followers count for user       |
| `GET`    | `/api/follows/mutual/:userId`                            | Get mutual follows for user        |
| `DELETE` | `/api/follows/follower/:followerId/followed/:followedId` | Delete follow relationship         |

### Health Check

- `GET /health` - Server health status

## 📝 User Creation Example

```bash
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "display_name": "John Doe",
    "bio": "Software developer and coffee enthusiast"
  }'
```

## 📝 Post Creation Example

```bash
curl -X POST http://localhost:3001/api/posts \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-123",
    "username": "johndoe",
    "content": "Just had an amazing cup of coffee! ☕",
    "media_url": "https://example.com/coffee.jpg",
    "media_type": "image",
    "tags": ["coffee", "morning", "goodvibes"],
    "location": "San Francisco, CA"
  }'
```

## 📝 Like Creation Example

```bash
curl -X POST http://localhost:3001/api/likes \
  -H "Content-Type: application/json" \
  -d '{
    "post_id": "post-123",
    "user_id": "user-456",
    "username": "johndoe"
  }'
```

## 📝 Follow Creation Example

```bash
curl -X POST http://localhost:3001/api/follows \
  -H "Content-Type: application/json" \
  -d '{
    "follower_id": "user-123",
    "followed_id": "user-456",
    "follower_username": "johndoe",
    "followed_username": "janedoe"
  }'
```

**Response**:

```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user_id": "uuid-here",
    "username": "johndoe",
    "display_name": "John Doe",
    "email": "john@example.com",
    "bio": "Software developer and coffee enthusiast",
    "created_at": "2024-01-01T00:00:00.000Z",
    "is_verified": false,
    "status": "active"
  }
}
```

## 🧪 Testing

### Run User Creation Tests

```bash
npm run test:user
```

This will test:

- ✅ User creation with valid data
- ✅ Duplicate username validation
- ✅ Duplicate email validation
- ✅ User retrieval (by username, email, ID)
- ✅ User updates
- ✅ User listing

### Run Jest Tests

```bash
npm test
```

## 🗄️ Database Schema

### Users Table

- **Primary Key**: `user_id` (String)
- **Sort Key**: `username` (String)
- **GSI1**: Username-based queries
- **GSI2**: Email-based queries

**Attributes**:

- `user_id` (String) - Unique identifier
- `username` (String) - Unique username
- `email` (String) - User email
- `display_name` (String) - Display name
- `bio` (String) - User bio
- `profile_image_url` (String) - Profile image URL
- `created_at` (String) - ISO timestamp
- `updated_at` (String) - ISO timestamp
- `followers_count` (Number) - Number of followers
- `following_count` (Number) - Number following
- `posts_count` (Number) - Number of posts
- `is_verified` (Boolean) - Verification status
- `is_private` (Boolean) - Privacy setting
- `status` (String) - User status

### Posts Table

- **Primary Key**: `post_id` (String)
- **Sort Key**: `user_id` (String)
- **GSI1**: User-based queries (user_id as hash key)

**Attributes**:

- `post_id` (String) - Unique identifier
- `user_id` (String) - ID of post creator
- `username` (String) - Username of post creator
- `content` (String) - Post content/text
- `media_url` (String) - URL to attached media
- `media_type` (String) - Type of media (image, video, etc.)
- `created_at` (String) - ISO timestamp
- `updated_at` (String) - ISO timestamp
- `likes_count` (Number) - Number of likes
- `comments_count` (Number) - Number of comments
- `shares_count` (Number) - Number of shares
- `is_public` (Boolean) - Whether post is public
- `status` (String) - Post status (active, deleted, hidden)
- `tags` (List) - Array of tags
- `location` (String) - Location where post was created

### Likes Table

- **Primary Key**: `post_id` (String) - HASH key
- **Sort Key**: `user_id` (String) - RANGE key
- **GSI1**: User-based queries (user_id as hash key, created_at as range key)
- **GSI2**: Time-based queries (created_at as hash key, post_id as range key)

**Attributes**:

- `post_id` (String) - ID of the post being liked (Primary Key - HASH)
- `user_id` (String) - ID of the user who liked the post (Primary Key - RANGE)
- `username` (String) - Username of the user who liked
- `created_at` (String) - ISO timestamp
- `updated_at` (String) - ISO timestamp
- `status` (String) - Like status (active, removed)

### Follows Table

- **Primary Key**: `follower_id` (String) - HASH key
- **Sort Key**: `followed_id` (String) - RANGE key
- **GSI1**: Followed-based queries (followed_id as hash key, created_at as range key)

**Attributes**:

- `follower_id` (String) - ID of the user who is following (Primary Key - HASH)
- `followed_id` (String) - ID of the user being followed (Primary Key - RANGE)
- `follower_username` (String) - Username of the follower
- `followed_username` (String) - Username of the user being followed
- `created_at` (String) - ISO timestamp
- `updated_at` (String) - ISO timestamp
- `status` (String) - Follow status (active, removed)

## 🏗️ Architecture

```
backend/
├── config/
│   └── dynamodb.js          # DynamoDB configuration
├── controllers/
│   ├── userController.js     # HTTP request handlers
│   ├── postController.js     # Post request handlers
│   ├── likeController.js     # Like request handlers
│   └── followController.js   # Follow request handlers
├── routes/
│   ├── userRoutes.js         # API route definitions
│   ├── postRoutes.js         # Post route definitions
│   ├── likeRoutes.js         # Like route definitions
│   └── followRoutes.js       # Follow route definitions
├── services/
│   ├── userService.js        # Business logic layer
│   ├── postService.js        # Post business logic
│   ├── likeService.js        # Like business logic
│   └── followService.js      # Follow business logic
├── middlewares/              # Custom middleware
├── utils/                    # Utility functions
├── server.js                 # Express app setup
├── test-user-creation.js     # User creation tests
├── test-post-creation.js     # Post creation tests
├── test-like-creation.js     # Like creation tests
└── test-follow-creation.js   # Follow creation tests
```

## 🔧 Development

### Adding New Features

1. **Service Layer**: Add business logic in `services/`
2. **Controller Layer**: Add HTTP handlers in `controllers/`
3. **Route Layer**: Define endpoints in `routes/`
4. **Testing**: Add tests for new functionality

### Testing

#### User Tests

```bash
npm run test:user
```

#### Post Tests

```bash
npm run test:post
```

#### Like Tests

```bash
npm run test:like
```

#### Follow Tests

```bash
npm run test:follow
```

### Database Operations

The application uses the multi-table DynamoDB setup from the `databases` folder:

- `Users` - User profiles and data
- `Posts` - User posts and content
- `Likes` - Post likes and reactions
- `Follows` - User follow relationships

## 🚨 Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": {
    "field": "Field-specific error"
  }
}
```

## 📊 Monitoring

- **Health Check**: `GET /health`
- **Logging**: Morgan for HTTP request logging
- **Error Tracking**: Global error handler with stack traces in development

## 🔒 Security

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Input Validation**: Request data validation
- **Error Sanitization**: Hide sensitive data in production

## 🚀 Deployment

1. Set environment variables for production
2. Ensure DynamoDB tables are created
3. Run `npm start` or use a process manager like PM2

## 📝 License

MIT License - see LICENSE file for details.
