#!/usr/bin/env node

const postService = require("../services/postService");

async function testPostCreation() {
  try {
    console.log("🧪 Testing Post Creation and Management");
    console.log("=".repeat(50));

    // Test 1: Create a post
    console.log("\n1. Creating a test post...");
    const testPost = await postService.createPost({
      user_id: "test-user-123",
      username: "testuser",
      content: "This is my first test post! Hello world! 🌍",
      media_url: "https://example.com/image.jpg",
      media_type: "image",
      tags: ["test", "hello", "world"],
      location: "San Francisco, CA",
    });
    console.log("✅ Post created:", testPost.post_id);

    // Test 2: Get post by ID
    console.log("\n2. Retrieving post by ID...");
    const retrievedPost = await postService.getPostById(testPost.post_id);
    console.log("✅ Post retrieved:", retrievedPost.content);

    // Test 3: Update post
    console.log("\n3. Updating post content...");
    const updatedPost = await postService.updatePost(testPost.post_id, {
      content: "This is my updated test post! Hello updated world! 🌍✨",
      tags: ["test", "hello", "world", "updated"],
    });
    console.log("✅ Post updated:", updatedPost.content);

    // Test 4: Like post
    console.log("\n4. Liking the post...");
    const likedPost = await postService.likePost(testPost.post_id, "user-456");
    console.log("✅ Post liked. Likes count:", likedPost.likes_count);

    // Test 5: Unlike post
    console.log("\n5. Unliking the post...");
    const unlikedPost = await postService.unlikePost(
      testPost.post_id,
      "user-456"
    );
    console.log("✅ Post unliked. Likes count:", unlikedPost.likes_count);

    // Test 6: Get posts by user ID
    console.log("\n6. Getting posts by user ID...");
    const userPosts = await postService.getPostsByUserId("test-user-123");
    console.log("✅ User posts count:", userPosts.count);

    // Test 7: Get all posts
    console.log("\n7. Getting all posts...");
    const allPosts = await postService.getAllPosts();
    console.log("✅ Total posts count:", allPosts.count);

    // Test 8: Delete post
    console.log("\n8. Deleting the test post...");
    await postService.deletePost(testPost.post_id);
    console.log("✅ Post deleted successfully");

    console.log("\n🎉 All post tests completed successfully!");
    console.log("=".repeat(50));
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack trace:", error.stack);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testPostCreation();
}

module.exports = { testPostCreation };
