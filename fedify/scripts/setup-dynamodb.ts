import { CreateTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { getLogger } from "@logtape/logtape";

const logger = getLogger("setup-dynamodb");

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const POSTS_TABLE = process.env.POSTS_TABLE || "fedify-posts";

async function createPostsTable() {
  try {
    const command = new CreateTableCommand({
      TableName: POSTS_TABLE,
      KeySchema: [
        {
          AttributeName: "id",
          KeyType: "HASH", // Partition key
        },
      ],
      AttributeDefinitions: [
        {
          AttributeName: "id",
          AttributeType: "S",
        },
        {
          AttributeName: "username",
          AttributeType: "S",
        },
        {
          AttributeName: "username_createdAt",
          AttributeType: "S",
        },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "UsernameCreatedAtIndex",
          KeySchema: [
            {
              AttributeName: "username",
              KeyType: "HASH",
            },
            {
              AttributeName: "username_createdAt",
              KeyType: "RANGE",
            },
          ],
          Projection: {
            ProjectionType: "ALL",
          },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          },
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
    });

    await dynamoClient.send(command);
    logger.info(`✅ Posts table '${POSTS_TABLE}' created successfully!`);
  } catch (error: any) {
    if (error.name === "ResourceInUseException") {
      logger.info(`ℹ️ Table '${POSTS_TABLE}' already exists`);
    } else {
      logger.error(`❌ Error creating posts table: ${error.message}`);
      throw error;
    }
  }
}

async function main() {
  logger.info("🚀 Setting up DynamoDB tables...");

  try {
    await createPostsTable();
    logger.info("✅ DynamoDB setup completed successfully!");
  } catch (error) {
    logger.error(`❌ Setup failed: ${error}`);
    process.exit(1);
  }
}

main();
