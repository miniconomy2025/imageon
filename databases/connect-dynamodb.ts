#!/usr/bin/env ts-node

import AWS from 'aws-sdk';

// Configure AWS SDK for local DynamoDB
const dynamoConfig: AWS.DynamoDB.ClientConfiguration = {
  region: 'us-east-1',
  endpoint: 'http://localhost:8000',
  accessKeyId: 'dummy',
  secretAccessKey: 'dummy'
};

const dynamoDB = new AWS.DynamoDB(dynamoConfig);
const dynamoClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);

const TABLE_NAME = 'ImageonApp';

// Type definitions for our data
interface DynamoItem {
  PK: string;
  SK: string;
  [key: string]: any;
}

interface UserProfile extends DynamoItem {
  user_id: string;
  username: string;
  email: string;
  display_name?: string;
  bio?: string;
  profile_image_url?: string;
  created_at: string;
  updated_at: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_verified: boolean;
  is_private: boolean;
  status: string;
}

interface Post extends DynamoItem {
  post_id: string;
  author_id: string;
  author_username: string;
  content: string;
  content_type: string;
  created_at: string;
  updated_at: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  engagement_score: number;
  visibility: string;
  is_deleted: boolean;
  hashtags?: string[];
  mentions?: string[];
}

interface FollowRelationship extends DynamoItem {
  follower_id: string;
  followed_id: string;
  follower_username: string;
  followed_username: string;
  created_at: string;
  status: string;
  notification_enabled: boolean;
}

async function connectAndRead(): Promise<void> {
  console.log('🔗 Connecting to DynamoDB Local...\n');

  try {
    // 1. List all tables
    console.log('📋 Listing tables...');
    const tables = await dynamoDB.listTables().promise();
    console.log('Available tables:', tables.TableNames);
    console.log();

    if (!tables.TableNames.includes(TABLE_NAME)) {
      console.log(`❌ Table '${TABLE_NAME}' not found!`);
      console.log('Please create the table first using the setup instructions.');
      return;
    }

    // 2. Get table description
    console.log(`📊 Getting table info for '${TABLE_NAME}'...`);
    const tableInfo = await dynamoDB.describeTable({ TableName: TABLE_NAME }).promise();
    console.log(`Table Status: ${tableInfo.Table.TableStatus}`);
    console.log(`Item Count: ${tableInfo.Table.ItemCount || 0}`);
    console.log();

    // 3. Scan the table to see all items
    console.log('🔍 Scanning table for all items...');
    const scanResult = await dynamoClient.scan({
      TableName: TABLE_NAME,
      Limit: 20
    }).promise();

    console.log(`Found ${scanResult.Items.length} items:`);
    console.log('='.repeat(60));

    scanResult.Items.forEach((item: DynamoItem, index: number) => {
      console.log(`\n${index + 1}. Item:`);
      console.log(`   PK: ${item.PK}`);
      console.log(`   SK: ${item.SK}`);
      
      // Show entity type based on SK
      if (item.SK === 'PROFILE') {
        const profile = item as UserProfile;
        console.log(`   Type: User Profile`);
        console.log(`   Username: ${profile.username || 'N/A'}`);
        console.log(`   Email: ${profile.email || 'N/A'}`);
        console.log(`   Display Name: ${profile.display_name || 'N/A'}`);
        console.log(`   Followers: ${profile.followers_count || 0}`);
        console.log(`   Following: ${profile.following_count || 0}`);
      } else if (item.SK === 'AUTH') {
        console.log(`   Type: User Auth`);
        console.log(`   Username: ${item.username || 'N/A'}`);
        console.log(`   Email: ${item.email || 'N/A'}`);
      } else if (item.SK === 'METADATA') {
        const post = item as Post;
        console.log(`   Type: Post`);
        console.log(`   Author: ${post.author_username || 'N/A'}`);
        console.log(`   Content: ${(post.content || 'N/A').substring(0, 50)}...`);
        console.log(`   Likes: ${post.likes_count || 0}`);
        console.log(`   Comments: ${post.comments_count || 0}`);
      } else if (item.SK.startsWith('FOLLOWING')) {
        const follow = item as FollowRelationship;
        console.log(`   Type: Follow Relationship`);
        console.log(`   Follower: ${follow.follower_username || 'N/A'}`);
        console.log(`   Following: ${follow.followed_username || 'N/A'}`);
      } else if (item.SK.startsWith('LIKE')) {
        console.log(`   Type: Like`);
        console.log(`   User: ${item.user_id || 'N/A'}`);
      } else {
        console.log(`   Type: ${item.SK}`);
      }

      // Show additional attributes (excluding PK/SK and GSI fields)
      const additionalAttrs = Object.keys(item).filter(key => 
        !['PK', 'SK', 'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK', 'GSI3PK', 'GSI3SK'].includes(key)
      );
      if (additionalAttrs.length > 0) {
        console.log(`   Additional attributes: ${additionalAttrs.join(', ')}`);
      }
    });

    // 4. Query specific entity types
    console.log('\n' + '='.repeat(60));
    console.log('🔍 Querying specific entity types...\n');

    // Query user profiles
    console.log('👥 User Profiles:');
    const userProfiles = await dynamoClient.scan({
      TableName: TABLE_NAME,
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: { ':sk': 'PROFILE' },
      Limit: 5
    }).promise();

    userProfiles.Items.forEach((user: UserProfile, index: number) => {
      console.log(`   ${index + 1}. ${user.username} (${user.display_name}) - ${user.email}`);
    });

    // Query posts
    console.log('\n📝 Posts:');
    const posts = await dynamoClient.scan({
      TableName: TABLE_NAME,
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: { ':sk': 'METADATA' },
      Limit: 5
    }).promise();

    posts.Items.forEach((post: Post, index: number) => {
      console.log(`   ${index + 1}. ${post.author_username}: ${(post.content || '').substring(0, 50)}...`);
    });

    // Query follows
    console.log('\n👥 Follow Relationships:');
    const follows = await dynamoClient.scan({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':sk': 'FOLLOWING' },
      Limit: 5
    }).promise();

    follows.Items.forEach((follow: FollowRelationship, index: number) => {
      console.log(`   ${index + 1}. ${follow.follower_username} → ${follow.followed_username}`);
    });

    // 5. Test specific queries using GSI
    console.log('\n' + '='.repeat(60));
    console.log('🔍 Testing GSI queries...\n');

    // Query by username using GSI1
    console.log('🔍 Querying by username (GSI1):');
    try {
      const usernameQuery = await dynamoClient.query({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': 'USERNAME#john_doe' },
        Limit: 5
      }).promise();

      usernameQuery.Items.forEach((item: DynamoItem, index: number) => {
        console.log(`   ${index + 1}. Found user: ${item.username || 'N/A'}`);
      });
    } catch (error) {
      console.log('   ⚠️  No users found with that username pattern');
    }

    console.log('\n✅ Successfully connected and read from DynamoDB!');
    console.log('\n💡 Next steps:');
    console.log('   - Use AWS CLI for more operations');
    console.log('   - Connect from your application');
    console.log('   - Add more data to test with');

  } catch (error) {
    console.error('❌ Error connecting to DynamoDB:', (error as Error).message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure DynamoDB container is running: docker ps');
    console.error('2. Check if table exists: aws dynamodb list-tables --endpoint-url http://localhost:8000');
    console.error('3. Create table if needed using the setup instructions');
  }
}

// Run the script
if (require.main === module) {
  connectAndRead();
}

export { connectAndRead }; 