const AWS = require("aws-sdk");
require("dotenv").config();

// DynamoDB Configuration
const getDynamoConfig = () => {
  const isLocal =
    process.env.NODE_ENV === "development" || process.env.DYNAMODB_ENDPOINT;

  if (isLocal) {
    // Local DynamoDB configuration
    return {
      region: process.env.AWS_REGION || "us-east-1",
      endpoint: process.env.DYNAMODB_ENDPOINT || "http://localhost:8000",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    };
  } else {
    // Production AWS configuration
    return {
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    };
  }
};

// Initialize DynamoDB instances
const dynamoConfig = getDynamoConfig();

const dynamoDB = new AWS.DynamoDB(dynamoConfig);
const dynamoClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);

// Table configuration
const TABLE_CONFIG = {
  name: process.env.DYNAMODB_TABLE_NAME || "ImageonApp",
  localName: process.env.DYNAMODB_LOCAL_TABLE_NAME || "ImageonApp-Local",

  // Get the appropriate table name based on environment
  getTableName: () => {
    const isLocal =
      process.env.NODE_ENV === "development" || process.env.DYNAMODB_ENDPOINT;
    return isLocal ? TABLE_CONFIG.localName : TABLE_CONFIG.name;
  },

  // Multi-table names
  tables: {
    users: "Users",
    posts: "Posts",
    likes: "Likes",
    follows: "Follows",
  },

  // GSI names
  indexes: {
    GSI1: "GSI1",
    GSI2: "GSI2",
    GSI3: "GSI3",
  },
};

// Export configuration and instances
module.exports = {
  dynamoDB,
  dynamoClient,
  getDynamoConfig,
  TABLE_CONFIG,
};
