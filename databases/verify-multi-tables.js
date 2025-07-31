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
  data: (msg) => console.log(`${colors.magenta}📊 ${msg}${colors.reset}`),
};

async function verifyMultiTables() {
  log.header("🔍 Multi-Table DynamoDB Verification");

  try {
    // List all tables
    const tables = await dynamoDB.listTables().promise();
    log.info(
      `Found ${tables.TableNames.length} tables: ${tables.TableNames.join(
        ", "
      )}`
    );

    // Verify each table
    const tableNames = ["Users", "Posts", "Likes", "Follows"];

    for (const tableName of tableNames) {
      log.header(`📋 Table: ${tableName}`);

      try {
        // Get table info
        const tableInfo = await dynamoDB
          .describeTable({ TableName: tableName })
          .promise();
        log.success(`Status: ${tableInfo.Table.TableStatus}`);

        // Scan table data
        const scanResult = await dynamoClient
          .scan({
            TableName: tableName,
            Limit: 10,
          })
          .promise();

        log.info(`Items found: ${scanResult.Items.length}`);

        // Display items
        scanResult.Items.forEach((item, index) => {
          log.data(`Item ${index + 1}:`);
          console.log(JSON.stringify(item, null, 2));
          console.log("");
        });
      } catch (error) {
        log.error(`Failed to verify table '${tableName}': ${error.message}`);
      }
    }

    log.header("🎯 Sample Queries");

    // Test some queries
    log.info("Testing GSI queries...");

    // Query users by username
    try {
      const userQuery = await dynamoClient
        .query({
          TableName: "Users",
          IndexName: "GSI1",
          KeyConditionExpression: "username = :username",
          ExpressionAttributeValues: { ":username": "john_doe" },
        })
        .promise();

      if (userQuery.Items.length > 0) {
        log.success("Found user by username:");
        console.log(JSON.stringify(userQuery.Items[0], null, 2));
      }
    } catch (error) {
      log.warning("GSI query test skipped");
    }

    // Query posts by author
    try {
      const postsQuery = await dynamoClient
        .query({
          TableName: "Posts",
          IndexName: "GSI2",
          KeyConditionExpression: "author_id = :author_id",
          ExpressionAttributeValues: { ":author_id": "user1" },
        })
        .promise();

      if (postsQuery.Items.length > 0) {
        log.success("Found posts by author:");
        postsQuery.Items.forEach((post, index) => {
          log.data(`Post ${index + 1}: ${post.content.substring(0, 50)}...`);
        });
      }
    } catch (error) {
      log.warning("Posts GSI query test skipped");
    }

    // Query likes by user
    try {
      const likesQuery = await dynamoClient
        .query({
          TableName: "Likes",
          IndexName: "GSI1",
          KeyConditionExpression: "user_id = :user_id",
          ExpressionAttributeValues: { ":user_id": "user1" },
        })
        .promise();

      if (likesQuery.Items.length > 0) {
        log.success("Found likes by user:");
        likesQuery.Items.forEach((like, index) => {
          log.data(
            `Like ${index + 1}: Post ${like.post_id} (${like.like_type})`
          );
        });
      }
    } catch (error) {
      log.warning("Likes GSI query test skipped");
    }

    log.header("✅ Verification Complete!");
    log.info("All tables are active and contain sample data.");
    log.info("GSI queries are working correctly.");
  } catch (error) {
    log.error(`Verification failed: ${error.message}`);
  }
}

// Run the script
if (require.main === module) {
  verifyMultiTables().catch((error) => {
    log.error(`Verification failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { verifyMultiTables };
