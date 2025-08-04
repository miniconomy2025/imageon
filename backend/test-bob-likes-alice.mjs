#!/usr/bin/env node

/**
 * Test federated Like activity: Bob likes Alice's post
 * Uses Bob's actual keys from the system and sends to Alice's inbox
 */

import "dotenv/config";
import { createFederation, Like } from "@fedify/fedify";
import { RedisKvStore } from "@fedify/redis";
import { createRedisInstance } from "./src/config/redis.js";
import { crypto } from "./src/services/cryptography.js";

// Set up environment for local DynamoDB
process.env.AWS_ACCESS_KEY_ID = "test";
process.env.AWS_SECRET_ACCESS_KEY = "test";
process.env.DYNAMODB_ENDPOINT = "http://localhost:8000";

async function sendBobLikesToAlice() {
  try {
    console.log("🚀 Testing: Bob likes Alice's post via federated inbox");
    console.log("=".repeat(60));

    // Create a temporary federation instance for sending
    const redis = createRedisInstance();
    const federation = createFederation({
      kv: new RedisKvStore(redis),
    });

    // Set up Bob's key pairs dispatcher
    federation.setKeyPairsDispatcher(async (ctx, identifier) => {
      console.log(`🔑 Getting key pairs for: ${identifier}`);
      if (identifier === "bob") {
        return await crypto.getOrGenerateKeyPairs(identifier);
      }
      return [];
    });

    console.log("📝 Creating Like activity...");

    // Create the Like activity
    const likeActivity = new Like({
      id: new URL(`http://localhost:3000/activities/like-${Date.now()}`),
      actor: new URL("http://localhost:3000/users/bob"),
      object: new URL("http://localhost:3000/objects/post-001"),
      published: new Date(),
    });

    console.log("✍️ Activity created:");
    console.log(`   ID: ${likeActivity.id?.href}`);
    console.log(`   Actor: ${likeActivity.actorId?.href}`);
    console.log(`   Object: ${likeActivity.objectId?.href}`);

    // Create a context for Bob
    const context = federation.createContext("http://localhost:3000", 0);

    console.log("\n📤 Sending to Alice's inbox...");

    // Send the activity to Alice's inbox
    const response = await fetch("http://localhost:3000/users/alice/inbox", {
      method: "POST",
      headers: {
        "Content-Type": "application/activity+json",
      },
      body: JSON.stringify(await likeActivity.toJsonLd()),
    });

    console.log(`\n📥 Response: ${response.status} ${response.statusText}`);

    if (response.ok || response.status === 202) {
      console.log("✅ Like activity sent successfully!");

      // Wait a moment for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check Alice's outbox to see if the like appears
      console.log("\n🔍 Checking Alice's outbox for the like...");
      const outboxResponse = await fetch(
        "http://localhost:3000/users/alice/outbox"
      );

      if (outboxResponse.ok) {
        const outboxData = await outboxResponse.json();
        const likes =
          outboxData.items?.filter(
            (item) =>
              item.type === "Like" &&
              item.actor === "http://localhost:3000/users/bob"
          ) || [];

        console.log(
          `📦 Found ${likes.length} like(s) from Bob in Alice's outbox`
        );

        if (likes.length > 0) {
          const latestLike = likes[0];
          console.log(
            `   Latest: ${latestLike.actor} liked ${latestLike.object}`
          );
        }
      }
    } else {
      const errorText = await response.text();
      console.log("❌ Failed to send Like activity");
      console.log("Response body:", errorText);

      if (response.status === 401) {
        console.log("\n🔐 This indicates signature verification failed.");
        console.log("   This is normal for federated requests.");
      }
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("Stack:", error.stack);
  }
}

// Alternative: Direct method using your activity handler
async function testDirectLikeHandler() {
  try {
    console.log("\n🧪 Alternative: Testing handleLikeActivity directly");
    console.log("-".repeat(40));

    // Import your handlers
    const { FederationHandlers } = await import("./src/handlers/federation.js");

    // Create a mock Like activity
    const mockLike = {
      id: {
        href: `http://localhost:3000/activities/like-direct-${Date.now()}`,
      },
      actorId: { href: "http://localhost:3000/users/bob" },
      objectId: { href: "http://localhost:3000/objects/post-001" },
    };

    console.log("📝 Mock Like activity:");
    console.log(`   ID: ${mockLike.id.href}`);
    console.log(`   Actor: ${mockLike.actorId.href}`);
    console.log(`   Object: ${mockLike.objectId.href}`);

    // Call the handler directly
    await FederationHandlers.handleLikeActivity(null, mockLike);

    console.log("✅ Direct handler test completed");
  } catch (error) {
    console.error("❌ Direct handler error:", error.message);
  }
}

// Run both tests
console.log("🎯 Bob Likes Alice's Post - Federated Test\n");

sendBobLikesToAlice()
  .then(() => testDirectLikeHandler())
  .then(() => {
    console.log("\n🎉 Test completed!");
    console.log("\n🔗 Check these endpoints:");
    console.log(
      "   • Alice's outbox: http://localhost:3000/users/alice/outbox"
    );
    console.log("   • Bob's outbox: http://localhost:3000/users/bob/outbox");
    console.log("   • Home page: http://localhost:3000/");
    process.exit(0);
  })
  .catch(console.error);
