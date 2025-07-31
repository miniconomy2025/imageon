#!/usr/bin/env node

const AWS = require("aws-sdk");
const dotenv = require("dotenv");
dotenv.config();

// Configure AWS SDK for local DynamoDB
const dynamoConfig = {
  region: "af-south-1",
  endpoint: "http://localhost:8000",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

const dynamoDB = new AWS.DynamoDB(dynamoConfig);
const dynamoClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);

const TABLE_NAME = "ImageonApp";

async function connectAndRead() {
  console.log("🔗 Connecting to DynamoDB Local...\n");

  try {
    // 1. List all tables
    console.log("📋 Listing tables...");
    const tables = await dynamoDB.listTables().promise();
    console.log("Available tables:", tables.TableNames);
    console.log();

    if (!tables.TableNames.includes(TABLE_NAME)) {
      console.log(`❌ Table '${TABLE_NAME}' not found!`);
      console.log(
        "Please create the table first using the setup instructions."
      );
      return;
    }

    // 2. Get table description
    console.log(`📊 Getting table info for '${TABLE_NAME}'...`);
    const tableInfo = await dynamoDB
      .describeTable({ TableName: TABLE_NAME })
      .promise();
    console.log(`Table Status: ${tableInfo.Table.TableStatus}`);
    console.log(`Item Count: ${tableInfo.Table.ItemCount || 0}`);
    console.log();

    // 3. Scan the table to see all items
    console.log("🔍 Scanning table for all items...");
    const scanResult = await dynamoClient
      .scan({
        TableName: TABLE_NAME,
        Limit: 20,
      })
      .promise();

    console.log(`Found ${scanResult.Items.length} items:`);
    console.log("=".repeat(60));

    scanResult.Items.forEach((item, index) => {
      console.log(`\n${index + 1}. Item:`);
      console.log(`   PK: ${item.PK}`);
      console.log(`   SK: ${item.SK}`);

      // Show entity type based on SK
      if (item.SK === "PROFILE") {
        console.log(`   Type: User Profile`);
        console.log(`   Username: ${item.username || "N/A"}`);
        console.log(`   Email: ${item.email || "N/A"}`);
        console.log(`   Display Name: ${item.display_name || "N/A"}`);
      } else if (item.SK === "AUTH") {
        console.log(`   Type: User Auth`);
        console.log(`   Username: ${item.username || "N/A"}`);
        console.log(`   Email: ${item.email || "N/A"}`);
      } else if (item.SK === "METADATA") {
        console.log(`   Type: Post`);
        console.log(`   Author: ${item.author_username || "N/A"}`);
        console.log(
          `   Content: ${(item.content || "N/A").substring(0, 50)}...`
        );
      } else if (item.SK.startsWith("FOLLOWING")) {
        console.log(`   Type: Follow Relationship`);
        console.log(`   Follower: ${item.follower_username || "N/A"}`);
        console.log(`   Following: ${item.followed_username || "N/A"}`);
      } else if (item.SK.startsWith("LIKE")) {
        console.log(`   Type: Like`);
        console.log(`   User: ${item.user_id || "N/A"}`);
      } else {
        console.log(`   Type: ${item.SK}`);
      }

      // Show additional attributes (excluding PK/SK)
      const additionalAttrs = Object.keys(item).filter(
        (key) =>
          ![
            "PK",
            "SK",
            "GSI1PK",
            "GSI1SK",
            "GSI2PK",
            "GSI2SK",
            "GSI3PK",
            "GSI3SK",
          ].includes(key)
      );
      if (additionalAttrs.length > 0) {
        console.log(`   Additional attributes: ${additionalAttrs.join(", ")}`);
      }
    });

    // 4. Query specific entity types
    console.log("\n" + "=".repeat(60));
    console.log("🔍 Querying specific entity types...\n");

    // Query user profiles
    console.log("👥 User Profiles:");
    const userProfiles = await dynamoClient
      .scan({
        TableName: TABLE_NAME,
        FilterExpression: "SK = :sk",
        ExpressionAttributeValues: { ":sk": "PROFILE" },
        Limit: 5,
      })
      .promise();

    userProfiles.Items.forEach((user, index) => {
      console.log(
        `   ${index + 1}. ${user.username} (${user.display_name}) - ${
          user.email
        }`
      );
    });

    // Query posts
    console.log("\n📝 Posts:");
    const posts = await dynamoClient
      .scan({
        TableName: TABLE_NAME,
        FilterExpression: "SK = :sk",
        ExpressionAttributeValues: { ":sk": "METADATA" },
        Limit: 5,
      })
      .promise();

    posts.Items.forEach((post, index) => {
      console.log(
        `   ${index + 1}. ${post.author_username}: ${(
          post.content || ""
        ).substring(0, 50)}...`
      );
    });

    // Query follows
    console.log("\n👥 Follow Relationships:");
    const follows = await dynamoClient
      .scan({
        TableName: TABLE_NAME,
        FilterExpression: "begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":sk": "FOLLOWING" },
        Limit: 5,
      })
      .promise();

    follows.Items.forEach((follow, index) => {
      console.log(
        `   ${index + 1}. ${follow.follower_username} → ${
          follow.followed_username
        }`
      );
    });

    console.log("\n✅ Successfully connected and read from DynamoDB!");
    console.log("\n💡 Next steps:");
    console.log("   - Use AWS CLI for more operations");
    console.log("   - Connect from your application");
    console.log("   - Add more data to test with");
  } catch (error) {
    console.error("❌ Error connecting to DynamoDB:", error.message);
    console.error("\nTroubleshooting:");
    console.error("1. Make sure DynamoDB container is running: docker ps");
    console.error(
      "2. Check if table exists: aws dynamodb list-tables --endpoint-url http://localhost:8000"
    );
    console.error("3. Create table if needed using the setup instructions");
  }
}

// Run the script
if (require.main === module) {
  connectAndRead();
}

module.exports = { connectAndRead };
