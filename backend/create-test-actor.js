import { db } from "./src/services/database.ts";
import { config } from "./src/config/index.ts";

async function createTestActor() {
  const actors = [
    {
      identifier: "alice",
      name: "Alice Test User",
      summary: "A test user for the ImageOn federation server",
    },
    {
      identifier: "bob",
      name: "Bob Test User",
      summary: "Another test user for federation testing",
    },
    {
      identifier: "charlie",
      name: "Charlie Test User",
      summary: "Third test user for comprehensive testing",
    },
    {
      identifier: "bernardbbdtest",
      name: "Charlie Test User",
      summary: "Third test user for comprehensive testing",
    },
  ];

  for (const actor of actors) {
    const { identifier, name, summary } = actor;
    const baseUrl = `${config.federation.protocol}://${config.federation.domain}`;

    const actorData = {
      PK: `ACTOR#${identifier}`,
      SK: "PROFILE",
      GSI1PK: "LOCAL_ACTORS",
      GSI1SK: identifier,
      GSI2PK: "LOCAL_ACTORS",
      GSI2SK: new Date().toISOString(),

      // Actor profile data
      id: `${baseUrl}/users/${identifier}`,
      type: "Person",
      preferredUsername: identifier,
      name: name,
      summary: summary,
      inbox: `${baseUrl}/users/${identifier}/inbox`,
      outbox: `${baseUrl}/users/${identifier}/outbox`,
      followers: `${baseUrl}/users/${identifier}/followers`,
      following: `${baseUrl}/users/${identifier}/following`,
      url: `${baseUrl}/users/${identifier}`,
      published: new Date().toISOString(),
      followers_count: 0,
      following_count: 0,
    };

    try {
      const success = await db.putItem(actorData);
      if (success) {
        console.log(`✅ Test actor '${identifier}' created successfully!`);
      } else {
        console.error(`❌ Failed to create test actor '${identifier}'`);
      }
    } catch (error) {
      console.error(`❌ Error creating test actor '${identifier}':`, error);
    }
  }

  console.log(`\n🎭 Test URLs:`);
  console.log(`- http://localhost:3000/users/alice`);
  console.log(`- http://localhost:3000/users/bob`);
  console.log(`- http://localhost:3000/users/charlie`);
}

createTestActor();
