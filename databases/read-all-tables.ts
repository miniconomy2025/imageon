#!/usr/bin/env node

const AWS = require("aws-sdk");
require("dotenv").config();

// Configure AWS SDK for local DynamoDB
const dynamoConfig = {
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  accessKeyId: "dummy",
  secretAccessKey: "dummy",
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
  white: "\x1b[37m",
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  header: (msg) =>
    console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`),
  data: (msg) => console.log(`${colors.magenta}📊 ${msg}${colors.reset}`),
  table: (msg) => console.log(`${colors.white}${msg}${colors.reset}`),
};

// Table configurations with descriptions
const TABLES = [
  {
    name: "Users",
    description: "User profiles and authentication data",
    keyFields: ["user_id", "username"],
    displayFields: [
      "display_name",
      "email",
      "bio",
      "followers_count",
      "following_count",
      "posts_count",
      "is_verified",
      "status",
    ],
  },
  {
    name: "Posts",
    description: "User posts and content",
    keyFields: ["post_id", "author_id"],
    displayFields: [
      "content",
      "author_username",
      "content_type",
      "likes_count",
      "comments_count",
      "shares_count",
      "engagement_score",
      "visibility",
      "hashtags",
    ],
  },
  {
    name: "Likes",
    description: "Post likes and reactions",
    keyFields: ["post_id", "user_id"],
    displayFields: ["username", "like_type", "created_at"],
  },
  {
    name: "Follows",
    description: "User follow relationships",
    keyFields: ["follower_id", "followed_id"],
    displayFields: [
      "follower_username",
      "followed_username",
      "status",
      "notification_enabled",
      "created_at",
    ],
  },
  {
    name: "ImageonApp",
    description: "Original single-table design",
    keyFields: ["PK", "SK"],
    displayFields: [
      "username",
      "email",
      "content",
      "author_username",
      "follower_username",
      "followed_username",
    ],
  },
];

// Format item for display
function formatItem(item, tableConfig) {
  const { keyFields, displayFields } = tableConfig;

  // Create a summary object
  const summary = {};

  // Add key fields
  keyFields.forEach((field) => {
    if (item[field]) {
      summary[field] = item[field];
    }
  });

  // Add display fields
  displayFields.forEach((field) => {
    if (item[field] !== undefined) {
      // Truncate long content
      if (field === "content" && item[field] && item[field].length > 100) {
        summary[field] = item[field].substring(0, 100) + "...";
      } else if (Array.isArray(item[field])) {
        summary[field] = item[field].join(", ");
      } else {
        summary[field] = item[field];
      }
    }
  });

  return summary;
}

// Read all items from a single table
async function readTableItems(tableConfig) {
  const { name, description } = tableConfig;

  try {
    log.header(`📋 Table: ${name}`);
    log.info(`Description: ${description}`);

    // Get table info
    const tableInfo = await dynamoDB
      .describeTable({ TableName: name })
      .promise();
    log.success(`Status: ${tableInfo.Table.TableStatus}`);

    // Scan all items
    let allItems = [];
    let lastEvaluatedKey = null;
    let scanCount = 0;

    do {
      const scanParams = {
        TableName: name,
        Limit: 100,
        ExclusiveStartKey: null,
      };

      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      const scanResult = await dynamoClient.scan(scanParams).promise();
      allItems = allItems.concat(scanResult.Items);
      lastEvaluatedKey = scanResult.LastEvaluatedKey;
      scanCount++;

      log.info(
        `Scanned batch ${scanCount}, found ${scanResult.Items.length} items...`
      );
    } while (lastEvaluatedKey);

    log.success(`Total items in ${name}: ${allItems.length}`);

    if (allItems.length === 0) {
      log.warning(`No items found in table '${name}'`);
      return;
    }

    // Display items
    allItems.forEach((item, index) => {
      log.data(`Item ${index + 1}:`);
      const formattedItem = formatItem(item, tableConfig);
      console.log(JSON.stringify(formattedItem, null, 2));
      console.log("");
    });

    // Show summary statistics
    log.info(`📊 Summary for ${name}:`);
    log.info(`  - Total items: ${allItems.length}`);

    // Show some statistics based on table type
    if (name === "Users") {
      const verifiedUsers = allItems.filter((item) => item.is_verified).length;
      const activeUsers = allItems.filter(
        (item) => item.status === "active"
      ).length;
      log.info(`  - Verified users: ${verifiedUsers}`);
      log.info(`  - Active users: ${activeUsers}`);
    } else if (name === "Posts") {
      const publicPosts = allItems.filter(
        (item) => item.visibility === "public"
      ).length;
      const totalLikes = allItems.reduce(
        (sum, item) => sum + (item.likes_count || 0),
        0
      );
      log.info(`  - Public posts: ${publicPosts}`);
      log.info(`  - Total likes across all posts: ${totalLikes}`);
    } else if (name === "Likes") {
      const likeTypes = {};
      allItems.forEach((item) => {
        const type = item.like_type || "unknown";
        likeTypes[type] = (likeTypes[type] || 0) + 1;
      });
      log.info(`  - Like types: ${JSON.stringify(likeTypes)}`);
    } else if (name === "Follows") {
      const activeFollows = allItems.filter(
        (item) => item.status === "active"
      ).length;
      log.info(`  - Active follows: ${activeFollows}`);
    }
  } catch (error) {
    log.error(`Failed to read table '${name}': ${error.message}`);
  }
}

// Main function to read all tables
async function readAllTables() {
  log.header("🔍 Reading All DynamoDB Tables");
  log.info("Scanning all tables for complete data overview...\n");

  try {
    // List all tables first
    const tables = await dynamoDB.listTables().promise();
    log.info(
      `Found ${tables.TableNames.length} tables: ${tables.TableNames.join(
        ", "
      )}`
    );

    // Read each table
    for (const tableConfig of TABLES) {
      // Check if table exists
      if (tables.TableNames.includes(tableConfig.name)) {
        await readTableItems(tableConfig);
      } else {
        log.warning(`Table '${tableConfig.name}' not found, skipping...`);
      }
    }

    log.header("✅ Complete Data Overview");
    log.success("All tables have been scanned and displayed.");
    log.info("Use this data to understand your current database state.");
  } catch (error) {
    log.error(`Failed to read tables: ${error.message}`);
  }
}

// Run the script
if (require.main === module) {
  readAllTables().catch((error) => {
    log.error(`Script failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { readAllTables, readTableItems };
