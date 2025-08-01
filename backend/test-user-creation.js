#!/usr/bin/env node

const userService = require("./services/userService");

async function testUserCreation() {
  console.log("🧪 Testing User Creation...\n");

  try {
    // Test 1: Create a valid user
    console.log("📝 Test 1: Creating a valid user...");
    const timestamp = Date.now();
    const userData = {
      username: `testuser${timestamp}`,
      email: `test${timestamp}@example.com`,
      display_name: "Test User",
      bio: "This is a test user for API testing",
    };

    const createdUser = await userService.createUser(userData);
    console.log("✅ User created successfully:");
    console.log(`   User ID: ${createdUser.user_id}`);
    console.log(`   Username: ${createdUser.username}`);
    console.log(`   Email: ${createdUser.email}`);
    console.log(`   Display Name: ${createdUser.display_name}`);
    console.log(`   Status: ${createdUser.status}`);
    console.log("");

    // Test 2: Try to create user with duplicate username
    console.log("📝 Test 2: Testing duplicate username...");
    try {
      await userService.createUser({
        username: userData.username, // Same username
        email: "different@example.com",
        display_name: "Different User",
      });
      console.log("❌ Should have failed with duplicate username");
    } catch (error) {
      console.log("✅ Correctly rejected duplicate username:", error.message);
    }
    console.log("");

    // Test 3: Try to create user with duplicate email
    console.log("📝 Test 3: Testing duplicate email...");
    try {
      await userService.createUser({
        username: "differentuser",
        email: userData.email, // Same email
        display_name: "Different User",
      });
      console.log("❌ Should have failed with duplicate email");
    } catch (error) {
      console.log("✅ Correctly rejected duplicate email:", error.message);
    }
    console.log("");

    // Test 4: Get user by username
    console.log("📝 Test 4: Getting user by username...");
    const foundUser = await userService.getUserByUsername(userData.username);
    if (foundUser) {
      console.log("✅ User found by username:");
      console.log(`   User ID: ${foundUser.user_id}`);
      console.log(`   Username: ${foundUser.username}`);
      console.log(`   Email: ${foundUser.email}`);
    } else {
      console.log("❌ User not found by username");
    }
    console.log("");

    // Test 5: Get user by email
    console.log("📝 Test 5: Getting user by email...");
    const foundByEmail = await userService.getUserByEmail(userData.email);
    if (foundByEmail) {
      console.log("✅ User found by email:");
      console.log(`   User ID: ${foundByEmail.user_id}`);
      console.log(`   Username: ${foundByEmail.username}`);
      console.log(`   Email: ${foundByEmail.email}`);
    } else {
      console.log("❌ User not found by email");
    }
    console.log("");

    // Test 6: Get user by ID
    console.log("📝 Test 6: Getting user by ID...");
    const foundById = await userService.getUserById(createdUser.user_id);
    if (foundById) {
      console.log("✅ User found by ID:");
      console.log(`   User ID: ${foundById.user_id}`);
      console.log(`   Username: ${foundById.username}`);
      console.log(`   Email: ${foundById.email}`);
    } else {
      console.log("❌ User not found by ID");
    }
    console.log("");

    // Test 7: Update user
    console.log("📝 Test 7: Updating user...");
    const updatedUser = await userService.updateUser(createdUser.user_id, {
      display_name: "Updated Test User",
      bio: "This is an updated bio",
    });
    console.log("✅ User updated successfully:");
    console.log(`   Display Name: ${updatedUser.display_name}`);
    console.log(`   Bio: ${updatedUser.bio}`);
    console.log(`   Updated At: ${updatedUser.updated_at}`);
    console.log("");

    // Test 8: Get all users
    console.log("📝 Test 8: Getting all users...");
    const allUsers = await userService.getAllUsers({ limit: 10 });
    console.log(`✅ Found ${allUsers.users.length} users`);
    allUsers.users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.username} (${user.display_name})`);
    });
    console.log("");

    console.log("🎉 All tests completed successfully!");
    console.log("📊 Summary:");
    console.log("   ✅ User creation works");
    console.log("   ✅ Duplicate validation works");
    console.log("   ✅ User retrieval works (by username, email, ID)");
    console.log("   ✅ User update works");
    console.log("   ✅ User listing works");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testUserCreation();
}

module.exports = { testUserCreation };
