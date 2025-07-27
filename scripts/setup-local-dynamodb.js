#!/usr/bin/env node

const AWS = require('aws-sdk');
require('dotenv').config();

// Configure AWS SDK for local DynamoDB
const dynamoConfig = {
  region: 'us-east-1',
  endpoint: 'http://localhost:8000',
  accessKeyId: 'dummy',
  secretAccessKey: 'dummy'
};

const dynamoDB = new AWS.DynamoDB(dynamoConfig);
const dynamoClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);

const TABLE_NAME = 'SocialMediaApp-Local';

const createTable = async () => {
  console.log('🚀 Setting up local DynamoDB for Social Media App...\n');

  const tableParams = {
    TableName: TABLE_NAME,
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
      const existing = await dynamoDB.describeTable({ TableName: TABLE_NAME }).promise();
      console.log(`✅ Table '${TABLE_NAME}' already exists`);
      console.log(`   Status: ${existing.Table.TableStatus}`);
      
      if (existing.Table.TableStatus === 'ACTIVE') {
        console.log('   Table is ready to use!\n');
        return true;
      }
    } catch (error) {
      if (error.code !== 'ResourceNotFoundException') {
        throw error;
      }
    }

    // Create the table
    console.log(`📝 Creating table '${TABLE_NAME}'...`);
    const result = await dynamoDB.createTable(tableParams).promise();
    console.log(`✅ Table creation initiated: ${result.TableDescription.TableName}`);

    // Wait for table to be active
    console.log('⏳ Waiting for table to become active...');
    await dynamoDB.waitFor('tableExists', { 
      TableName: TABLE_NAME,
      $waiter: {
        delay: 2,
        maxAttempts: 30
      }
    }).promise();
    
    console.log('✅ Table is now ACTIVE!\n');
    return true;

  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    return false;
  }
};

const seedSampleData = async () => {
  console.log('🌱 Seeding sample data...\n');

  const sampleData = [
    // Sample Users
    {
      PK: 'USER#user001',
      SK: 'PROFILE',
      GSI1PK: 'USERNAME#john_doe',
      GSI1SK: 'PROFILE',
      user_id: 'user001',
      username: 'john_doe',
      email: 'john@example.com',
      display_name: 'John Doe',
      bio: 'Full-stack developer passionate about React and Node.js 💻',
      profile_image_url: '',
      created_at: '2025-01-20T10:00:00Z',
      updated_at: '2025-01-27T10:00:00Z',
      followers_count: 150,
      following_count: 89,
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
      bio: 'UI/UX Designer & Photography enthusiast 📸 Creating beautiful digital experiences',
      profile_image_url: '',
      created_at: '2025-01-21T14:30:00Z',
      updated_at: '2025-01-27T14:30:00Z',
      followers_count: 300,
      following_count: 125,
      posts_count: 45,
      is_verified: true,
      is_private: false,
      status: 'active'
    },
    {
      PK: 'USER#user003',
      SK: 'PROFILE',
      GSI1PK: 'USERNAME#alex_dev',
      GSI1SK: 'PROFILE',
      user_id: 'user003',
      username: 'alex_dev',
      email: 'alex@example.com',
      display_name: 'Alex Rodriguez',
      bio: 'DevOps Engineer | Cloud Architecture | Coffee addict ☕',
      profile_image_url: '',
      created_at: '2025-01-22T09:15:00Z',
      updated_at: '2025-01-27T09:15:00Z',
      followers_count: 75,
      following_count: 200,
      posts_count: 12,
      is_verified: false,
      is_private: false,
      status: 'active'
    },
    
    // Sample Posts
    {
      PK: 'POST#post001',
      SK: 'METADATA',
      GSI1PK: 'USER#user001',
      GSI1SK: 'POST#2025-01-27T15:30:00Z#post001',
      GSI2PK: 'TIMELINE#2025-01-27',
      GSI2SK: '2025-01-27T15:30:00Z#post001',
      GSI3PK: 'POPULAR_POSTS',
      GSI3SK: '0125#2025-01-27T15:30:00Z',
      post_id: 'post001',
      author_id: 'user001',
      author_username: 'john_doe',
      content: 'Just finished building the authentication system for our social media app! 🚀 The JWT implementation with refresh tokens is working smoothly. Next up: implementing the feed algorithm! #coding #webdev #socialmedia',
      content_type: 'text',
      media_urls: [],
      created_at: '2025-01-27T15:30:00Z',
      updated_at: '2025-01-27T15:30:00Z',
      likes_count: 25,
      comments_count: 5,
      shares_count: 2,
      engagement_score: 125,
      visibility: 'public',
      is_deleted: false,
      hashtags: ['#coding', '#webdev', '#socialmedia'],
      mentions: []
    },
    {
      PK: 'POST#post002',
      SK: 'METADATA',
      GSI1PK: 'USER#user002',
      GSI1SK: 'POST#2025-01-27T16:00:00Z#post002',
      GSI2PK: 'TIMELINE#2025-01-27',
      GSI2SK: '2025-01-27T16:00:00Z#post002',
      GSI3PK: 'POPULAR_POSTS',
      GSI3SK: '0200#2025-01-27T16:00:00Z',
      post_id: 'post002',
      author_id: 'user002',
      author_username: 'jane_smith',
      content: 'Working on some new UI designs for mobile apps today. The intersection of psychology and design never ceases to amaze me! 🎨✨ How do you approach user-centered design?',
      content_type: 'text',
      media_urls: [],
      created_at: '2025-01-27T16:00:00Z',
      updated_at: '2025-01-27T16:00:00Z',
      likes_count: 42,
      comments_count: 8,
      shares_count: 6,
      engagement_score: 200,
      visibility: 'public',
      is_deleted: false,
      hashtags: ['#design', '#ux', '#mobile'],
      mentions: []
    },
    {
      PK: 'POST#post003',
      SK: 'METADATA',
      GSI1PK: 'USER#user003',
      GSI1SK: 'POST#2025-01-27T17:15:00Z#post003',
      GSI2PK: 'TIMELINE#2025-01-27',
      GSI2SK: '2025-01-27T17:15:00Z#post003',
      GSI3PK: 'POPULAR_POSTS',
      GSI3SK: '0050#2025-01-27T17:15:00Z',
      post_id: 'post003',
      author_id: 'user003',
      author_username: 'alex_dev',
      content: 'Deployed our first microservice to AWS EKS today! The auto-scaling is working beautifully. Docker + Kubernetes + AWS = 💪 What\'s your favorite cloud platform?',
      content_type: 'text',
      media_urls: [],
      created_at: '2025-01-27T17:15:00Z',
      updated_at: '2025-01-27T17:15:00Z',
      likes_count: 18,
      comments_count: 3,
      shares_count: 1,
      engagement_score: 50,
      visibility: 'public',
      is_deleted: false,
      hashtags: ['#devops', '#aws', '#kubernetes', '#docker'],
      mentions: []
    },

    // Follow Relationships
    {
      PK: 'USER#user001',
      SK: 'FOLLOWING#user002',
      GSI1PK: 'USER#user002',
      GSI1SK: 'FOLLOWER#user001',
      GSI2PK: 'FOLLOW_GRAPH',
      GSI2SK: '2025-01-25T12:00:00Z#user001#user002',
      follower_id: 'user001',
      followed_id: 'user002',
      follower_username: 'john_doe',
      followed_username: 'jane_smith',
      created_at: '2025-01-25T12:00:00Z',
      status: 'active',
      notification_enabled: true
    },
    {
      PK: 'USER#user001',
      SK: 'FOLLOWING#user003',
      GSI1PK: 'USER#user003',
      GSI1SK: 'FOLLOWER#user001',
      GSI2PK: 'FOLLOW_GRAPH',
      GSI2SK: '2025-01-26T14:30:00Z#user001#user003',
      follower_id: 'user001',
      followed_id: 'user003',
      follower_username: 'john_doe',
      followed_username: 'alex_dev',
      created_at: '2025-01-26T14:30:00Z',
      status: 'active',
      notification_enabled: true
    },
    {
      PK: 'USER#user002',
      SK: 'FOLLOWING#user001',
      GSI1PK: 'USER#user001',
      GSI1SK: 'FOLLOWER#user002',
      GSI2PK: 'FOLLOW_GRAPH',
      GSI2SK: '2025-01-26T16:00:00Z#user002#user001',
      follower_id: 'user002',
      followed_id: 'user001',
      follower_username: 'jane_smith',
      followed_username: 'john_doe',
      created_at: '2025-01-26T16:00:00Z',
      status: 'active',
      notification_enabled: true
    },

    // Sample Feed Entries (pre-computed feeds)
    {
      PK: 'FEED#user001',
      SK: '2025-01-27T16:00:00Z#post002',
      GSI1PK: 'FEED_MANAGEMENT#user001',
      GSI1SK: '2025-01-27T16:00:00Z',
      user_id: 'user001',
      post_id: 'post002',
      author_id: 'user002',
      author_username: 'jane_smith',
      content_preview: 'Working on some new UI designs for mobile apps today. The intersection of psychology and design...',
      content_type: 'text',
      created_at: '2025-01-27T16:00:00Z',
      inserted_at: '2025-01-27T16:01:00Z',
      engagement_score: 200,
      is_promoted: false,
      feed_rank: 1.0
    },
    {
      PK: 'FEED#user001',
      SK: '2025-01-27T17:15:00Z#post003',
      GSI1PK: 'FEED_MANAGEMENT#user001',
      GSI1SK: '2025-01-27T17:15:00Z',
      user_id: 'user001',
      post_id: 'post003',
      author_id: 'user003',
      author_username: 'alex_dev',
      content_preview: 'Deployed our first microservice to AWS EKS today! The auto-scaling is working beautifully...',
      content_type: 'text',
      created_at: '2025-01-27T17:15:00Z',
      inserted_at: '2025-01-27T17:16:00Z',
      engagement_score: 50,
      is_promoted: false,
      feed_rank: 0.8
    },

    // Sample Likes
    {
      PK: 'POST#post001',
      SK: 'LIKE#user002',
      GSI1PK: 'USER#user002',
      GSI1SK: 'LIKE#2025-01-27T15:45:00Z#post001',
      user_id: 'user002',
      post_id: 'post001',
      author_id: 'user001',
      created_at: '2025-01-27T15:45:00Z',
      like_type: 'like'
    },
    {
      PK: 'POST#post002',
      SK: 'LIKE#user001',
      GSI1PK: 'USER#user001',
      GSI1SK: 'LIKE#2025-01-27T16:05:00Z#post002',
      user_id: 'user001',
      post_id: 'post002',
      author_id: 'user002',
      created_at: '2025-01-27T16:05:00Z',
      like_type: 'like'
    }
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const item of sampleData) {
    try {
      await dynamoClient.put({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK)'
      }).promise();
      
      // Progress indicator
      const entityType = item.SK === 'PROFILE' ? 'User' : 
                        item.SK === 'METADATA' ? 'Post' :
                        item.SK.startsWith('FOLLOWING') ? 'Follow' :
                        item.SK.startsWith('LIKE') ? 'Like' :
                        item.PK.startsWith('FEED') ? 'Feed' : 'Item';
      
      console.log(`  ✅ ${entityType}: ${item.PK}`);
      successCount++;
      
    } catch (error) {
      if (error.code === 'ConditionalCheckFailedException') {
        console.log(`  ⚠️  Item already exists: ${item.PK}`);
      } else {
        console.log(`  ❌ Failed to insert: ${item.PK} - ${error.message}`);
        errorCount++;
      }
    }
  }

  console.log(`\n📊 Seeding complete!`);
  console.log(`   ✅ Successfully inserted: ${successCount} items`);
  if (errorCount > 0) {
    console.log(`   ❌ Errors: ${errorCount} items`);
  }
  console.log();
};

const verifySetup = async () => {
  console.log('🔍 Verifying setup...\n');

  try {
    // Check table status
    const tableInfo = await dynamoDB.describeTable({ TableName: TABLE_NAME }).promise();
    console.log(`✅ Table Status: ${tableInfo.Table.TableStatus}`);
    console.log(`✅ Item Count: ${tableInfo.Table.ItemCount || 0}`);

    // Test a few queries
    const userQuery = await dynamoClient.get({
      TableName: TABLE_NAME,
      Key: { PK: 'USER#user001', SK: 'PROFILE' }
    }).promise();

    if (userQuery.Item) {
      console.log(`✅ Sample user found: ${userQuery.Item.username} (${userQuery.Item.display_name})`);
    }

    const postsQuery = await dynamoClient.query({
      TableName: TABLE_NAME,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'TIMELINE#2025-01-27'
      },
      Limit: 5
    }).promise();

    console.log(`✅ Sample posts found: ${postsQuery.Items?.length || 0} posts in timeline`);
    
    console.log('\n🎉 Local DynamoDB is ready for development!');
    console.log('\n💡 Next steps:');
    console.log('   1. Start your backend server: npm run dev');
    console.log('   2. Test API endpoints with the sample data');
    console.log('   3. Use DynamoDB Admin UI: http://localhost:8001 (if installed)');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
};

// Main execution
const main = async () => {
  try {
    console.log('='.repeat(60));
    console.log('🗄️  LOCAL DYNAMODB SETUP FOR SOCIAL MEDIA APP');
    console.log('='.repeat(60));
    console.log();

    const tableCreated = await createTable();
    if (!tableCreated) {
      process.exit(1);
    }

    await seedSampleData();
    await verifySetup();

    console.log('\n' + '='.repeat(60));
    console.log('✨ Setup completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('🔧 Make sure DynamoDB Local is running on port 8000');
    console.error('   Run: docker run -p 8000:8000 amazon/dynamodb-local');
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { createTable, seedSampleData, verifySetup };
