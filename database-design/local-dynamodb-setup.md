# Local DynamoDB Development Setup

## Overview
Amazon provides DynamoDB Local for development and testing. This allows you to develop your application without connecting to the AWS cloud service.

---

## Installation Options

### Option 1: Docker (Recommended)
```bash
# Pull the official DynamoDB Local image
docker pull amazon/dynamodb-local

# Run DynamoDB Local
docker run -p 8000:8000 amazon/dynamodb-local

# Run with persistent data (recommended for development)
docker run -p 8000:8000 -v "$PWD/local-dynamodb-data":/home/dynamodblocal/data amazon/dynamodb-local -jar DynamoDBLocal.jar -sharedDb -dbPath /home/dynamodblocal/data
```

### Option 2: Direct Download
```bash
# Download DynamoDB Local
curl -O https://s3-us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_latest.tar.gz

# Extract
tar -xzf dynamodb_local_latest.tar.gz

# Run (requires Java 8+)
java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb
```

### Option 3: Using AWS CLI
```bash
# Install AWS CLI if not already installed
npm install -g aws-cli-local

# Start DynamoDB Local using AWS CLI
aws dynamodb-local start
```

---

## Configuration for Your Social Media App

### 1. Environment Configuration
Create a `.env.local` file in your project root:

```env
# DynamoDB Configuration
NODE_ENV=development
DYNAMODB_ENDPOINT=http://localhost:8000
DYNAMODB_REGION=us-east-1
AWS_ACCESS_KEY_ID=dummy
AWS_SECRET_ACCESS_KEY=dummy

# Redis Configuration (for local Redis)
REDIS_URL=redis://localhost:6379

# Other configurations
JWT_SECRET=your-local-jwt-secret
API_PORT=3001
```

### 2. Database Connection Setup
Create `config/database.js`:

```javascript
const AWS = require('aws-sdk');

// Configure AWS SDK for local development
const dynamoConfig = {
  region: process.env.DYNAMODB_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

// Use local endpoint if in development
if (process.env.NODE_ENV === 'development') {
  dynamoConfig.endpoint = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
}

const dynamoClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
const dynamoDB = new AWS.DynamoDB(dynamoConfig);

module.exports = {
  dynamoClient,
  dynamoDB
};
```

### 3. Local Table Creation Script
Create `scripts/setup-local-db.js`:

```javascript
const { dynamoDB } = require('../config/database');

const createLocalTables = async () => {
  console.log('Creating local DynamoDB tables...');

  const tableParams = {
    TableName: 'SocialMediaApp-Local',
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
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      },
      {
        IndexName: 'GSI2',
        KeySchema: [
          { AttributeName: 'GSI2PK', KeyType: 'HASH' },
          { AttributeName: 'GSI2SK', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      },
      {
        IndexName: 'GSI3',
        KeySchema: [
          { AttributeName: 'GSI3PK', KeyType: 'HASH' },
          { AttributeName: 'GSI3SK', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 10,
      WriteCapacityUnits: 10
    }
  };

  try {
    // Check if table already exists
    try {
      await dynamoDB.describeTable({ TableName: 'SocialMediaApp-Local' }).promise();
      console.log('Table SocialMediaApp-Local already exists');
      return;
    } catch (error) {
      if (error.code !== 'ResourceNotFoundException') {
        throw error;
      }
    }

    // Create the table
    const result = await dynamoDB.createTable(tableParams).promise();
    console.log('Table created successfully:', result.TableDescription.TableName);

    // Wait for table to be active
    console.log('Waiting for table to be active...');
    await dynamoDB.waitFor('tableExists', { TableName: 'SocialMediaApp-Local' }).promise();
    console.log('Table is now active!');

    // Seed with sample data
    await seedSampleData();

  } catch (error) {
    console.error('Error creating table:', error);
    process.exit(1);
  }
};

const seedSampleData = async () => {
  const { dynamoClient } = require('../config/database');
  
  console.log('Seeding sample data...');

  const sampleUsers = [
    {
      PK: 'USER#user001',
      SK: 'PROFILE',
      GSI1PK: 'USERNAME#john_doe',
      GSI1SK: 'PROFILE',
      user_id: 'user001',
      username: 'john_doe',
      email: 'john@example.com',
      display_name: 'John Doe',
      bio: 'Software developer and coffee enthusiast ☕',
      created_at: '2025-01-20T10:00:00Z',
      updated_at: '2025-01-20T10:00:00Z',
      followers_count: 150,
      following_count: 200,
      posts_count: 25,
      is_verified: false,
      is_private: false,
      status: 'active'
    },
    {
      PK: 'USER#user002',
      SK: 'PROFILE',
      GSI1PK: 'USERNAME#jane_smith',
      GSI1SK: 'PROFILE',
      user_id: 'user002',
      username: 'jane_smith',
      email: 'jane@example.com',
      display_name: 'Jane Smith',
      bio: 'Designer & photographer 📸',
      created_at: '2025-01-21T14:30:00Z',
      updated_at: '2025-01-21T14:30:00Z',
      followers_count: 300,
      following_count: 180,
      posts_count: 45,
      is_verified: true,
      is_private: false,
      status: 'active'
    }
  ];

  const samplePosts = [
    {
      PK: 'POST#post001',
      SK: 'METADATA',
      GSI1PK: 'USER#user001',
      GSI1SK: 'POST#2025-01-27T15:30:00Z#post001',
      GSI2PK: 'TIMELINE#2025-01-27',
      GSI2SK: '2025-01-27T15:30:00Z#post001',
      post_id: 'post001',
      author_id: 'user001',
      author_username: 'john_doe',
      content: 'Just launched my new social media app! 🚀 Excited to share it with everyone.',
      content_type: 'text',
      created_at: '2025-01-27T15:30:00Z',
      updated_at: '2025-01-27T15:30:00Z',
      likes_count: 25,
      comments_count: 5,
      shares_count: 2,
      engagement_score: 100,
      visibility: 'public',
      is_deleted: false,
      hashtags: ['#coding', '#startup', '#launch'],
      mentions: []
    },
    {
      PK: 'POST#post002',
      SK: 'METADATA',
      GSI1PK: 'USER#user002',
      GSI1SK: 'POST#2025-01-27T16:00:00Z#post002',
      GSI2PK: 'TIMELINE#2025-01-27',
      GSI2SK: '2025-01-27T16:00:00Z#post002',
      post_id: 'post002',
      author_id: 'user002',
      author_username: 'jane_smith',
      content: 'Beautiful sunset from my balcony today 🌅',
      content_type: 'image',
      created_at: '2025-01-27T16:00:00Z',
      updated_at: '2025-01-27T16:00:00Z',
      likes_count: 50,
      comments_count: 8,
      shares_count: 3,
      engagement_score: 150,
      visibility: 'public',
      is_deleted: false,
      hashtags: ['#sunset', '#photography', '#nature'],
      mentions: []
    }
  ];

  // Sample follow relationship
  const sampleFollow = {
    PK: 'USER#user001',
    SK: 'FOLLOWING#user002',
    GSI1PK: 'USER#user002',
    GSI1SK: 'FOLLOWER#user001',
    follower_id: 'user001',
    followed_id: 'user002',
    follower_username: 'john_doe',
    followed_username: 'jane_smith',
    created_at: '2025-01-25T12:00:00Z',
    status: 'active',
    notification_enabled: true
  };

  // Insert sample data
  const allItems = [...sampleUsers, ...samplePosts, sampleFollow];
  
  for (const item of allItems) {
    try {
      await dynamoClient.put({
        TableName: 'SocialMediaApp-Local',
        Item: item
      }).promise();
    } catch (error) {
      console.warn('Failed to insert item:', item.PK, error.message);
    }
  }

  console.log('Sample data seeded successfully!');
};

// Run the script
if (require.main === module) {
  createLocalTables().then(() => {
    console.log('Local DynamoDB setup complete!');
    process.exit(0);
  }).catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

module.exports = { createLocalTables };
```

---

## Development Commands

### Package.json Scripts
Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "db:local:start": "docker run -d -p 8000:8000 --name dynamodb-local -v \"$PWD/local-dynamodb-data\":/home/dynamodblocal/data amazon/dynamodb-local -jar DynamoDBLocal.jar -sharedDb -dbPath /home/dynamodblocal/data",
    "db:local:stop": "docker stop dynamodb-local && docker rm dynamodb-local",
    "db:local:setup": "node scripts/setup-local-db.js",
    "db:local:reset": "npm run db:local:stop && npm run db:local:start && sleep 5 && npm run db:local:setup",
    "dev": "NODE_ENV=development nodemon server.js",
    "test": "NODE_ENV=test jest"
  }
}
```

### Quick Start Commands
```bash
# Start local DynamoDB
npm run db:local:start

# Setup tables and seed data
npm run db:local:setup

# Start your development server
npm run dev

# When done, stop local DynamoDB
npm run db:local:stop
```

---

## Testing with Local DynamoDB

### Jest Test Configuration
Create `tests/setup/db-setup.js`:

```javascript
const { createLocalTables } = require('../../scripts/setup-local-db');

// Setup test database before all tests
beforeAll(async () => {
  // Ensure we're in test mode
  process.env.NODE_ENV = 'test';
  process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
  
  await createLocalTables();
}, 30000); // 30 second timeout for setup

// Clean up after tests
afterAll(async () => {
  const { dynamoDB } = require('../../config/database');
  
  try {
    await dynamoDB.deleteTable({ TableName: 'SocialMediaApp-Local' }).promise();
  } catch (error) {
    console.warn('Failed to cleanup test table:', error.message);
  }
});
```

### Sample Test
Create `tests/api/users.test.js`:

```javascript
const request = require('supertest');
const app = require('../../server');

describe('User API', () => {
  test('should create a new user', async () => {
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      display_name: 'Test User',
      bio: 'This is a test user'
    };

    const response = await request(app)
      .post('/api/users')
      .send(userData)
      .expect(201);

    expect(response.body).toHaveProperty('user_id');
    expect(response.body.username).toBe(userData.username);
  });

  test('should get user profile', async () => {
    const response = await request(app)
      .get('/api/users/john_doe')
      .expect(200);

    expect(response.body.username).toBe('john_doe');
    expect(response.body.display_name).toBe('John Doe');
  });
});
```

---

## Local Redis Setup (Optional)

If you also want to run Redis locally:

```bash
# Using Docker
docker run -d -p 6379:6379 --name redis-local redis:alpine

# Or install locally (macOS)
brew install redis
redis-server

# Or install locally (Ubuntu)
sudo apt install redis-server
sudo systemctl start redis-server
```

---

## GUI Tools for Local Development

### 1. DynamoDB Admin (Web Interface)
```bash
npm install -g dynamodb-admin
dynamodb-admin
# Open http://localhost:8001
```

### 2. AWS CLI for Local DynamoDB
```bash
# List tables
aws dynamodb list-tables --endpoint-url http://localhost:8000

# Scan table
aws dynamodb scan --table-name SocialMediaApp-Local --endpoint-url http://localhost:8000

# Get specific item
aws dynamodb get-item --table-name SocialMediaApp-Local --key '{"PK":{"S":"USER#user001"},"SK":{"S":"PROFILE"}}' --endpoint-url http://localhost:8000
```

---

## Benefits of Local DynamoDB

✅ **No AWS costs** during development
✅ **Offline development** capability
✅ **Fast iteration** without network latency
✅ **Safe testing** environment
✅ **Identical API** to production DynamoDB
✅ **Easy reset** for testing different scenarios

This setup gives you a complete local development environment that mirrors your production setup exactly!
