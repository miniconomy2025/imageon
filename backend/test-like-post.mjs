#!/usr/bin/env node

/**
 * Test script for liking posts via the API
 *
 * Usage:
 *   node test-like-post.mjs
 *   node test-like-post.mjs alice post-001
 *   node test-like-post.mjs bob post-002
 */

const BASE_URL = "http://localhost:3000";

async function likePost(username, postId) {
  try {
    const response = await fetch(`${BASE_URL}/api/posts/${postId}/like`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": username,
      },
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`✅ Post liked successfully!`);
      console.log(`👤 User: ${username}`);
      console.log(`📄 Post: ${postId}`);
      console.log(`🔗 Like URI: ${result.like.likeUri}`);
      console.log(`❤️ Like ID: ${result.like.likeId}`);

      return result;
    } else {
      if (response.status === 409) {
        console.log(`⚠️ User ${username} already liked post ${postId}`);
      } else {
        console.error(`❌ Failed to like post:`, result);
      }
      return null;
    }
  } catch (error) {
    console.error(`❌ Error liking post:`, error.message);
    return null;
  }
}

async function testMultipleLikes() {
  console.log("🧪 Testing multiple users liking the same post...\n");

  const users = ["alice", "bob", "charlie"];
  const postId = "post-001";

  for (const user of users) {
    console.log(`\n👤 ${user} is liking ${postId}...`);
    await likePost(user, postId);
  }

  console.log(`\n🔄 Testing duplicate like (Alice likes again)...`);
  await likePost("alice", postId);
}

async function testGetOutbox(username) {
  try {
    console.log(`\n🔍 Checking ${username}'s outbox for like activities...`);
    const outboxResponse = await fetch(`${BASE_URL}/users/${username}/outbox`);
    const outboxData = await outboxResponse.json();

    if (outboxData.items) {
      const likeActivities = outboxData.items.filter(
        (item) => item.type === "Like"
      );
      console.log(
        `📦 ${username}'s outbox has ${likeActivities.length} like activities`
      );

      likeActivities.forEach((like, index) => {
        console.log(`  ${index + 1}. Liked: ${like.object}`);
      });
    }
  } catch (error) {
    console.error("Error checking outbox:", error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Run comprehensive test
    console.log(`🚀 Running comprehensive like test`);
    console.log(`📍 Server: ${BASE_URL}\n`);

    await testMultipleLikes();

    // Check outboxes
    await testGetOutbox("alice");
    await testGetOutbox("bob");
    await testGetOutbox("charlie");
  } else {
    // Single like test
    const username = args[0];
    const postId = args[1] || "post-001";

    console.log(`🚀 Liking post for user: ${username}`);
    console.log(`📍 Server: ${BASE_URL}`);
    console.log(`📄 Post ID: ${postId}\n`);

    const result = await likePost(username, postId);

    if (result) {
      await testGetOutbox(username);
    }
  }

  console.log(`\n🎯 Test complete! You can also check:`);
  console.log(`   • Home page: ${BASE_URL}/`);
  console.log(`   • Alice's outbox: ${BASE_URL}/users/alice/outbox`);
  console.log(`   • Bob's outbox: ${BASE_URL}/users/bob/outbox`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { likePost };
