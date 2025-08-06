// Configuration and environment variables
export const config = {
  // Server Configuration
  port: parseInt(process.env.PORT || '3000'),
  
  // DynamoDB Configuration
  dynamodb: {
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
    tableName: process.env.DYNAMODB_TABLE_NAME || 'ImageonApp',
  },
  
  // AWS Credentials (for local development)
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
  
  // Federation Configuration
  federation: {
    domain: process.env.FEDERATION_DOMAIN || 'localhost:3000',
    protocol: process.env.FEDERATION_PROTOCOL || 'http',
  },
} as const;

export type Config = typeof config;
