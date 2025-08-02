// Test ActivityPub data structure
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ 
  region: 'us-east-1',
  endpoint: 'http://localhost:8000'
});
const docClient = DynamoDBDocumentClient.from(client);

console.log('🎭 ActivityPub Actors:');
const actorCommand = new ScanCommand({
  TableName: 'ImageonApp',
  FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
  ExpressionAttributeValues: {
    ':pk': 'ACTOR#',
    ':sk': 'PROFILE'
  }
});

const actors = await docClient.send(actorCommand);
actors.Items?.forEach(actor => {
  console.log(`  - ${actor.preferredUsername} (${actor.name}): ${actor.summary}`);
  console.log(`    Followers: ${actor.followers_count}, Following: ${actor.following_count}`);
  console.log(`    ID: ${actor.id}`);
  console.log('');
});

console.log('📝 Posts:');
const postCommand = new ScanCommand({
  TableName: 'ImageonApp',
  FilterExpression: 'begins_with(PK, :pk)',
  ExpressionAttributeValues: {
    ':pk': 'OBJECT#'
  }
});

const posts = await docClient.send(postCommand);
posts.Items?.forEach(post => {
  console.log(`  - ${post.id}`);
  console.log(`    By: ${post.attributedTo}`);
  console.log(`    Content: ${post.content}`);
  console.log(`    Likes: ${post.likes_count}, Shares: ${post.shares_count}`);
  console.log('');
});

console.log('❤️ Likes:');
const likeCommand = new ScanCommand({
  TableName: 'ImageonApp',
  FilterExpression: 'SK = :sk',
  ExpressionAttributeValues: {
    ':sk': 'LIKE'
  }
});

const likes = await docClient.send(likeCommand);
console.log(`  Total likes: ${likes.Items?.length || 0}`);

console.log('👥 Follows:');
const followCommand = new ScanCommand({
  TableName: 'ImageonApp',
  FilterExpression: 'SK = :sk',
  ExpressionAttributeValues: {
    ':sk': 'FOLLOW'
  }
});

const follows = await docClient.send(followCommand);
console.log(`  Total follows: ${follows.Items?.length || 0}`);
