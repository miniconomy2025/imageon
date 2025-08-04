#!/usr/bin/env node

/**
 * Comprehensive test for like functionality
 * Tests both local likes (via API) and federated likes (via ActivityPub)
 */

const BASE_URL = "http://localhost:3000";

async function testLocalLike(username, postId) {
  console.log(`\n🧪 Testing local like: ${username} likes ${postId}`);

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
      console.log(`✅ Success: ${username} liked ${postId}`);
      console.log(`   Like URI: ${result.like.likeUri}`);
      return true;
    } else {
      console.log(`❌ Failed: ${result.error} (${response.status})`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function checkActorOutbox(username) {
  console.log(`\n📦 Checking ${username}'s outbox...`);

  try {
    const response = await fetch(`${BASE_URL}/users/${username}/outbox`);
    const data = await response.json();

    if (data.items) {
      const likes = data.items.filter((item) => item.type === "Like");
      console.log(`   Found ${likes.length} like activities`);

      likes.forEach((like, index) => {
        console.log(`   ${index + 1}. ${like.actor} liked ${like.object}`);
      });

      return likes.length;
    }

    return 0;
  } catch (error) {
    console.error(`❌ Error checking outbox: ${error.message}`);
    return 0;
  }
}

async function testDuplicateLike(username, postId) {
  console.log(`\n🔄 Testing duplicate like: ${username} likes ${postId} again`);

  try {
    const response = await fetch(`${BASE_URL}/api/posts/${postId}/like`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": username,
      },
    });

    const result = await response.json();

    if (response.status === 409) {
      console.log(`✅ Correctly prevented duplicate like: ${result.error}`);
      return true;
    } else {
      console.log(
        `❌ Should have prevented duplicate like, got: ${response.status}`
      );
      return false;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function testNonExistentPost(username) {
  console.log(`\n❌ Testing like on non-existent post`);

  try {
    const response = await fetch(`${BASE_URL}/api/posts/fake-post-999/like`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-ID": username,
      },
    });

    const result = await response.json();

    if (response.status === 400 && result.error.includes("not found")) {
      console.log(`✅ Correctly rejected non-existent post: ${result.error}`);
      return true;
    } else {
      console.log(
        `❌ Should have rejected non-existent post, got: ${response.status}`
      );
      return false;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function testUnauthorizedLike(postId) {
  console.log(`\n🔒 Testing unauthorized like (no X-User-ID header)`);

  try {
    const response = await fetch(`${BASE_URL}/api/posts/${postId}/like`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // No X-User-ID header
      },
    });

    const result = await response.json();

    if (response.status === 401) {
      console.log(
        `✅ Correctly rejected unauthorized request: ${result.error}`
      );
      return true;
    } else {
      console.log(
        `❌ Should have rejected unauthorized request, got: ${response.status}`
      );
      return false;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log(`🚀 Like Activity Comprehensive Test`);
  console.log(`📍 Server: ${BASE_URL}\n`);

  let passed = 0;
  let total = 0;

  // Test 1: Alice likes post-001
  total++;
  if (await testLocalLike("alice", "post-001")) passed++;

  // Test 2: Bob likes the same post
  total++;
  if (await testLocalLike("bob", "post-001")) passed++;

  // Test 3: Charlie likes a different post
  total++;
  if (await testLocalLike("charlie", "post-002")) passed++;

  // Test 4: Check outboxes
  await checkActorOutbox("alice");
  await checkActorOutbox("bob");
  await checkActorOutbox("charlie");

  // Test 5: Duplicate like (should fail)
  total++;
  if (await testDuplicateLike("alice", "post-001")) passed++;

  // Test 6: Non-existent post (should fail)
  total++;
  if (await testNonExistentPost("alice")) passed++;

  // Test 7: Unauthorized request (should fail)
  total++;
  if (await testUnauthorizedLike("post-001")) passed++;

  // Summary
  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log(
      `🎉 All tests passed! Your like functionality is working perfectly!`
    );
  } else {
    console.log(`⚠️ Some tests failed. Check the output above for details.`);
  }

  console.log(`\n🔗 You can also check:`);
  console.log(`   • Home page: ${BASE_URL}/`);
  console.log(`   • Actor profiles: ${BASE_URL}/users/alice`);
  console.log(`   • Outboxes: ${BASE_URL}/users/alice/outbox`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { testLocalLike, checkActorOutbox };
