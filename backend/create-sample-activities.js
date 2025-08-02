import "dotenv/config";
import { activityPub } from './src/services/activitypub.ts';

async function createSampleActivities() {
  const actors = ['alice', 'bob', 'charlie'];
  
  for (const actor of actors) {
    // Create a sample "Create" activity (like posting a note)
    const noteId = `http://localhost:3000/notes/${actor}-note-1`;
    const activityId = `http://localhost:3000/activities/${actor}-create-1`;
    
    await activityPub.saveActivity(
      activityId,
      'Create',
      `http://localhost:3000/users/${actor}`,
      noteId,
      {
        object: {
          id: noteId,
          type: 'Note',
          content: `Hello, this is a test post from ${actor}!`,
          attributedTo: `http://localhost:3000/users/${actor}`,
          published: new Date().toISOString(),
        }
      }
    );
    
    // Create a sample "Follow" activity
    const followActivityId = `http://localhost:3000/activities/${actor}-follow-1`;
    const targetActor = actors[(actors.indexOf(actor) + 1) % actors.length]; // Follow next actor in array
    
    await activityPub.saveActivity(
      followActivityId,
      'Follow',
      `http://localhost:3000/users/${actor}`,
      `http://localhost:3000/users/${targetActor}`,
      {
        object: `http://localhost:3000/users/${targetActor}`
      }
    );
    
    console.log(`✅ Created sample activities for ${actor}`);
  }
  
  console.log('\n🎯 Test the outbox endpoints:');
  console.log('- http://localhost:3000/users/alice/outbox');
  console.log('- http://localhost:3000/users/bob/outbox');  
  console.log('- http://localhost:3000/users/charlie/outbox');
}

// Set environment variables for local DynamoDB
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';
process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';

createSampleActivities();
