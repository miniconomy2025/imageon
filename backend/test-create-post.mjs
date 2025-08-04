#!/usr/bin/env node

/**
 * Test script for creating posts via the API
 *
 * Usage:
 *   node test-create-post.mjs
 *   node test-create-post.mjs alice "Custom post content"
 */

const BASE_URL = "http://localhost:3000";

async function createPost(username, content, options = {}) {
  try {
    const response = await fetch(`${BASE_URL}/api/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": username,
      },
      body: JSON.stringify({
        content,
        ...options,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`✅ Post created successfully!`);
      console.log(`📝 Content: "${content}"`);
      console.log(`👤 Author: ${username}`);
      console.log(`🔗 Post URI: ${result.post.postUri}`);
      console.log(`📤 Activity URI: ${result.post.activityUri}`);

      // Test the outbox to see the new post
      console.log(`\n🔍 Testing outbox...`);
      const outboxResponse = await fetch(
        `${BASE_URL}/users/${username}/outbox`
      );
      const outboxData = await outboxResponse.json();
      console.log(`📦 Outbox has ${outboxData.items?.length || 0} items`);

      if (outboxData.items?.length > 0) {
        const latestPost = outboxData.items[0];
        console.log(
          `📄 Latest post: "${latestPost.object || "Unknown content"}"`
        );
      }

      return result;
    } else {
      console.error(`❌ Failed to create post:`, result);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error creating post:`, error.message);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const username = args[0] || "alice";
  const content =
    args[1] ||
    "Hey there welcome to my imageon! 🎉 This is my first post on this federated social network.";

  console.log(`🚀 Creating post for user: ${username}`);
  console.log(`📍 Server: ${BASE_URL}`);
  console.log(`\n📝 Post content: "${content}"\n`);

  const result = await createPost(username, content, {
    visibility: "public",
    hashtags: ["#welcome", "#imageon", "#activitypub"],
    mentions: [],
  });

  if (result) {
    console.log(`\n🎯 Success! You can view the post at:`);
    console.log(`   • Actor profile: ${BASE_URL}/users/${username}`);
    console.log(`   • Outbox: ${BASE_URL}/users/${username}/outbox`);
    console.log(`   • Home page: ${BASE_URL}/`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { createPost };
