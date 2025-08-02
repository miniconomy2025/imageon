#!/usr/bin/env node

const likeService = require("../services/likeService");

async function testLikeCreation() {
  try {
    console.log("🧪 Testing Like Creation and Management");
    console.log("=".repeat(50));

    // Test 1: Create a like
    console.log("\n1. Creating a test like...");
    const testLike = await likeService.createLike({
      post_id: "test-post-123",
      user_id: "test-user-456",
      username: "testuser",
    });
    console.log(
      "✅ Like created:",
      testLike.username,
      "liked post",
      testLike.post_id
    );

    // Test 2: Get like by post and user
    console.log("\n2. Retrieving like by post and user...");
    const retrievedLike = await likeService.getLikeByPostAndUser(
      "test-post-123",
      "test-user-456"
    );
    console.log(
      "✅ Like retrieved:",
      retrievedLike.username,
      "liked post",
      retrievedLike.post_id
    );

    // Test 3: Check if user liked post
    console.log("\n3. Checking if user liked post...");
    const hasLiked = await likeService.hasUserLikedPost(
      "test-user-456",
      "test-post-123"
    );
    console.log("✅ User has liked post:", hasLiked);

    // Test 4: Get likes by post ID
    console.log("\n4. Getting likes by post ID...");
    const postLikes = await likeService.getLikesByPostId("test-post-123");
    console.log("✅ Post likes count:", postLikes.count);

    // Test 5: Get likes by user ID
    console.log("\n5. Getting likes by user ID...");
    const userLikes = await likeService.getLikesByUserId("test-user-456");
    console.log("✅ User likes count:", userLikes.count);

    // Test 6: Get like count for post
    console.log("\n6. Getting like count for post...");
    const likeCount = await likeService.getLikeCountForPost("test-post-123");
    console.log("✅ Like count for post:", likeCount);

    // Test 7: Delete like by user and post
    console.log("\n7. Deleting like by user and post...");
    await likeService.deleteLikeByUserAndPost("test-user-456", "test-post-123");
    console.log("✅ Like deleted successfully");

    // Test 8: Verify like is deleted
    console.log("\n8. Verifying like is deleted...");
    const hasLikedAfterDelete = await likeService.hasUserLikedPost(
      "test-user-456",
      "test-post-123"
    );
    console.log("✅ User has liked post after delete:", hasLikedAfterDelete);

    console.log("\n🎉 All like tests completed successfully!");
    console.log("=".repeat(50));
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack trace:", error.stack);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testLikeCreation();
}

module.exports = { testLikeCreation };
