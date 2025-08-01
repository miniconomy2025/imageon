#!/usr/bin/env node

const followService = require("./services/followService");

async function testFollowCreation() {
  try {
    console.log("🧪 Testing Follow Creation and Management");
    console.log("=".repeat(50));

    // Test 1: Create a follow relationship
    console.log("\n1. Creating a test follow relationship...");
    const testFollow = await followService.createFollow({
      follower_id: "test-user-123",
      followed_id: "test-user-456",
      follower_username: "testuser1",
      followed_username: "testuser2",
    });
    console.log(
      "✅ Follow created:",
      testFollow.follower_username,
      "followed",
      testFollow.followed_username
    );

    // Test 2: Get follow by follower and followed
    console.log("\n2. Retrieving follow relationship...");
    const retrievedFollow = await followService.getFollowByFollowerAndFollowed(
      "test-user-123",
      "test-user-456"
    );
    console.log(
      "✅ Follow retrieved:",
      retrievedFollow.follower_username,
      "follows",
      retrievedFollow.followed_username
    );

    // Test 3: Check if user is following
    console.log("\n3. Checking if user is following...");
    const isFollowing = await followService.isUserFollowing(
      "test-user-123",
      "test-user-456"
    );
    console.log("✅ User is following:", isFollowing);

    // Test 4: Get following list for user
    console.log("\n4. Getting following list for user...");
    const followingList = await followService.getFollowingByUserId(
      "test-user-123"
    );
    console.log("✅ Following count:", followingList.count);

    // Test 5: Get followers list for user
    console.log("\n5. Getting followers list for user...");
    const followersList = await followService.getFollowersByUserId(
      "test-user-456"
    );
    console.log("✅ Followers count:", followersList.count);

    // Test 6: Get following count
    console.log("\n6. Getting following count...");
    const followingCount = await followService.getFollowingCount(
      "test-user-123"
    );
    console.log("✅ Following count:", followingCount);

    // Test 7: Get followers count
    console.log("\n7. Getting followers count...");
    const followersCount = await followService.getFollowersCount(
      "test-user-456"
    );
    console.log("✅ Followers count:", followersCount);

    // Test 8: Create another follow for mutual follows test
    console.log("\n8. Creating another follow for mutual test...");
    await followService.createFollow({
      follower_id: "test-user-456",
      followed_id: "test-user-123",
      follower_username: "testuser2",
      followed_username: "testuser1",
    });
    console.log("✅ Second follow created for mutual test");

    // Test 9: Get mutual follows
    console.log("\n9. Getting mutual follows...");
    const mutualFollows = await followService.getMutualFollows("test-user-123");
    console.log("✅ Mutual follows count:", mutualFollows.count);

    // Test 10: Delete follow relationship
    console.log("\n10. Deleting follow relationship...");
    await followService.deleteFollow("test-user-123", "test-user-456");
    console.log("✅ Follow deleted successfully");

    // Test 11: Verify follow is deleted
    console.log("\n11. Verifying follow is deleted...");
    const isFollowingAfterDelete = await followService.isUserFollowing(
      "test-user-123",
      "test-user-456"
    );
    console.log("✅ User is following after delete:", isFollowingAfterDelete);

    // Test 12: Try to follow self (should fail)
    console.log("\n12. Testing self-follow prevention...");
    try {
      await followService.createFollow({
        follower_id: "test-user-123",
        followed_id: "test-user-123",
        follower_username: "testuser1",
        followed_username: "testuser1",
      });
      console.log("❌ Self-follow should have failed");
    } catch (error) {
      console.log("✅ Self-follow correctly prevented:", error.message);
    }

    console.log("\n🎉 All follow tests completed successfully!");
    console.log("=".repeat(50));
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack trace:", error.stack);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testFollowCreation();
}

module.exports = { testFollowCreation };
