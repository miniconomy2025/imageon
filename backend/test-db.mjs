// Test DynamoDB connection and key generation
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

console.log("Testing DynamoDB connection...");

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'ImageonApp';

console.log("Using endpoint:", process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000');
console.log("Using table:", TABLE_NAME);

try {
  // Test putting a key pair
  const testKeyPair = {
    PK: 'ACTOR#me',
    SK: 'KEYPAIR',
    privateKey: { test: 'private key data' },
    publicKey: { test: 'public key data' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  console.log("Putting test key pair...");
  const putCommand = new PutCommand({
    TableName: TABLE_NAME,
    Item: testKeyPair
  });
  await docClient.send(putCommand);
  console.log("✅ Put successful");

  // Test getting the key pair
  console.log("Getting test key pair...");
  const getCommand = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: 'ACTOR#me',
      SK: 'KEYPAIR'
    }
  });
  const result = await docClient.send(getCommand);
  console.log("✅ Get successful:", result.Item ? 'Found' : 'Not found');

} catch (error) {
  console.error("❌ Error:", error);
}
