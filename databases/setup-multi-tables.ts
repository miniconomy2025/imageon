#!/usr/bin/env node

const AWS = require("aws-sdk");
require("dotenv").config();

// Configure AWS SDK for local DynamoDB
const dynamoConfig = {
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

const dynamoDB = new AWS.DynamoDB(dynamoConfig);
const dynamoClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);

// Table configurations
const TABLES = [
  {
    name: "Users",
    file: "create-users-table.json",
    description: "User profiles and authentication data",
  },
  {
    name: "Posts",
    file: "create-posts-table.json",
    description: "User posts and content",
  },
  {
    name: "Likes",
    file: "create-likes-table.json",
    description: "Post likes and reactions",
  },
  {
    name: "Follows",
    file: "create-follows-table.json",
    description: "User follow relationships",
  },
];

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  header: (msg) =>
    console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`),
};

// Check if DynamoDB is running
async function checkDynamoDBConnection() {
  try {
    await dynamoDB.listTables().promise();
    log.success("Connected to DynamoDB Local");
    return true;
  } catch (error) {
    log.error(`Failed to connect to DynamoDB: ${error.message}`);
    log.info("Make sure DynamoDB container is running on port 8000");
    return false;
  }
}

// Create a single table
async function createTable(tableConfig) {
  const { name, file, description } = tableConfig;

  try {
    // Check if table already exists
    try {
      const existing = await dynamoDB
        .describeTable({ TableName: name })
        .promise();
      log.success(
        `Table '${name}' already exists (${existing.Table.TableStatus})`
      );
      return true;
    } catch (error) {
      if (error.code !== "ResourceNotFoundException") {
        throw error;
      }
    }

    // Read table definition from JSON file
    const fs = require("fs");
    const path = require("path");
    const tableDefinitionPath = path.join(__dirname, file);

    if (!fs.existsSync(tableDefinitionPath)) {
      log.error(`Table definition file not found: ${file}`);
      return false;
    }

    const tableDefinition = JSON.parse(
      fs.readFileSync(tableDefinitionPath, "utf8")
    );

    log.info(`Creating table '${name}'...`);
    await dynamoDB.createTable(tableDefinition).promise();

    // Wait for table to be active
    log.info(`Waiting for table '${name}' to be active...`);
    await dynamoDB.waitFor("tableExists", { TableName: name }).promise();

    log.success(`Table '${name}' created successfully`);
    return true;
  } catch (error) {
    log.error(`Failed to create table '${name}': ${error.message}`);
    return false;
  }
}

// Seed sample data
async function seedSampleData() {
  log.header("🌱 Seeding Sample Data");

  const sampleData = {
    users: [
      {
        user_id: "user1",
        username: "john_doe",
        email: "john@example.com",
        display_name: "John Doe",
        bio: "Software developer and coffee enthusiast",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        is_verified: false,
        is_private: false,
        status: "active",
      },
      {
        user_id: "user2",
        username: "jane_smith",
        email: "jane@example.com",
        display_name: "Jane Smith",
        bio: "Digital artist and creative soul",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        is_verified: true,
        is_private: false,
        status: "active",
      },
      {
        user_id: "user3",
        username: "mike_wilson",
        email: "mike@example.com",
        display_name: "Mike Wilson",
        bio: "Photography lover and travel blogger",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        is_verified: false,
        is_private: false,
        status: "active",
      },
    ],
    posts: [
      {
        post_id: "post1",
        author_id: "user1",
        content:
          "Just finished a great coding session! 💻 #coding #programming",
        content_type: "text",
        author_username: "john_doe",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        engagement_score: 0,
        visibility: "public",
        is_deleted: false,
        hashtags: ["coding", "programming"],
        mentions: [],
      },
      {
        post_id: "post2",
        author_id: "user2",
        content: "Working on some amazing digital art today! 🎨 #art #digital",
        content_type: "text",
        author_username: "jane_smith",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        engagement_score: 0,
        visibility: "public",
        is_deleted: false,
        hashtags: ["art", "digital"],
        mentions: [],
      },
      {
        post_id: "post3",
        author_id: "user3",
        content:
          "Beautiful sunset captured during my evening walk! 🌅 #photography #sunset",
        content_type: "text",
        author_username: "mike_wilson",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        engagement_score: 0,
        visibility: "public",
        is_deleted: false,
        hashtags: ["photography", "sunset"],
        mentions: [],
      },
    ],
    follows: [
      {
        follower_id: "user1",
        followed_id: "user2",
        follower_username: "john_doe",
        followed_username: "jane_smith",
        created_at: new Date().toISOString(),
        status: "active",
        notification_enabled: true,
      },
      {
        follower_id: "user2",
        followed_id: "user3",
        follower_username: "jane_smith",
        followed_username: "mike_wilson",
        created_at: new Date().toISOString(),
        status: "active",
        notification_enabled: true,
      },
    ],
    likes: [
      {
        post_id: "post1",
        user_id: "user2",
        username: "jane_smith",
        created_at: new Date().toISOString(),
        like_type: "like",
      },
      {
        post_id: "post2",
        user_id: "user1",
        username: "john_doe",
        created_at: new Date().toISOString(),
        like_type: "love",
      },
      {
        post_id: "post3",
        user_id: "user1",
        username: "john_doe",
        created_at: new Date().toISOString(),
        like_type: "like",
      },
    ],
  };

  try {
    // Insert users
    log.info("Inserting sample users...");
    for (const user of sampleData.users) {
      await dynamoClient
        .put({
          TableName: "Users",
          Item: user,
        })
        .promise();
    }
    log.success(`Inserted ${sampleData.users.length} users`);

    // Insert posts
    log.info("Inserting sample posts...");
    for (const post of sampleData.posts) {
      await dynamoClient
        .put({
          TableName: "Posts",
          Item: post,
        })
        .promise();
    }
    log.success(`Inserted ${sampleData.posts.length} posts`);

    // Insert follows
    log.info("Inserting sample follow relationships...");
    for (const follow of sampleData.follows) {
      await dynamoClient
        .put({
          TableName: "Follows",
          Item: follow,
        })
        .promise();
    }
    log.success(`Inserted ${sampleData.follows.length} follow relationships`);

    // Insert likes
    log.info("Inserting sample likes...");
    for (const like of sampleData.likes) {
      await dynamoClient
        .put({
          TableName: "Likes",
          Item: like,
        })
        .promise();
    }
    log.success(`Inserted ${sampleData.likes.length} likes`);

    log.success("Sample data seeding completed!");
  } catch (error) {
    log.error(`Failed to seed sample data: ${error.message}`);
  }
}

// Verify setup
async function verifySetup() {
  log.header("🔍 Verifying Setup");

  try {
    // List all tables
    const tables = await dynamoDB.listTables().promise();
    log.info(
      `Found ${tables.TableNames.length} tables: ${tables.TableNames.join(
        ", "
      )}`
    );

    // Check each table
    for (const tableName of TABLES.map((t) => t.name)) {
      try {
        const tableInfo = await dynamoDB
          .describeTable({ TableName: tableName })
          .promise();
        log.success(`Table '${tableName}': ${tableInfo.Table.TableStatus}`);

        // Count items in each table
        const scanResult = await dynamoClient
          .scan({
            TableName: tableName,
            Select: "COUNT",
          })
          .promise();

        log.info(`  - Items: ${scanResult.Count}`);
      } catch (error) {
        log.error(`Failed to verify table '${tableName}': ${error.message}`);
      }
    }
  } catch (error) {
    log.error(`Failed to verify setup: ${error.message}`);
  }
}

// Main execution
async function main() {
  log.header("🚀 Multi-Table DynamoDB Setup");
  log.info("Setting up Users, Posts, Likes, and Follows tables...\n");

  // Check connection
  if (!(await checkDynamoDBConnection())) {
    process.exit(1);
  }

  // Create tables
  log.header("📋 Creating Tables");
  let successCount = 0;

  for (const tableConfig of TABLES) {
    const success = await createTable(tableConfig);
    if (success) successCount++;
  }

  log.success(`Created ${successCount}/${TABLES.length} tables successfully`);

  // Seed sample data
  await seedSampleData();

  // Verify setup
  await verifySetup();

  log.header("🎉 Setup Complete!");
  log.info("Your multi-table DynamoDB setup is ready for development.");
  log.info("Tables created: Users, Posts, Likes, Follows");
  log.info("Sample data has been inserted for testing.");
  log.info("\nNext steps:");
  log.info("  - Connect your application to these tables");
  log.info("  - Use the AWS SDK to interact with the data");
  log.info("  - Test your queries and access patterns");
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    log.error(`Setup failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main, createTable, seedSampleData, verifySetup };
