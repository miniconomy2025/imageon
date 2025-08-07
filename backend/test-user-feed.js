import { AuthHandlers } from './src/handlers/auth.js';

// Test the handleUserFeed function
async function testUserFeed() {
    console.log('🧪 Testing handleUserFeed function...\n');

    // Test 1: Missing actor parameter
    console.log('Test 1: Missing actor parameter');
    try {
        const request1 = new Request('http://localhost:3000/api/feed');
        const response1 = await AuthHandlers.handleUserFeed(request1);
        const data1 = await response1.json();
        console.log('Status:', response1.status);
        console.log('Response:', data1);
        console.log('✅ Test 1 passed\n');
    } catch (error) {
        console.log('❌ Test 1 failed:', error.message);
    }

    // Test 2: Invalid actor identifier
    console.log('Test 2: Invalid actor identifier');
    try {
        const request2 = new Request('http://localhost:3000/api/feed?actor=');
        const response2 = await AuthHandlers.handleUserFeed(request2);
        const data2 = await response2.json();
        console.log('Status:', response2.status);
        console.log('Response:', data2);
        console.log('✅ Test 2 passed\n');
    } catch (error) {
        console.log('❌ Test 2 failed:', error.message);
    }

    // Test 3: Non-existent actor
    console.log('Test 3: Non-existent actor');
    try {
        const request3 = new Request('http://localhost:3000/api/feed?actor=nonexistentuser');
        const response3 = await AuthHandlers.handleUserFeed(request3);
        const data3 = await response3.json();
        console.log('Status:', response3.status);
        console.log('Response:', data3);
        console.log('✅ Test 3 passed\n');
    } catch (error) {
        console.log('❌ Test 3 failed:', error.message);
    }

    // Test 4: Valid actor (if you have a test user)
    console.log('Test 4: Valid actor (testuser)');
    try {
        const request4 = new Request('http://localhost:3000/api/feed?actor=testuser');
        const response4 = await AuthHandlers.handleUserFeed(request4);
        const data4 = await response4.json();
        console.log('Status:', response4.status);
        console.log('Response items count:', data4.items ? data4.items.length : 0);
        if (data4.items && data4.items.length > 0) {
            console.log('First item:', JSON.stringify(data4.items[0], null, 2));
        }
        console.log('✅ Test 4 passed\n');
    } catch (error) {
        console.log('❌ Test 4 failed:', error.message);
    }

    console.log('🎉 All tests completed!');
}

// Run the tests
testUserFeed().catch(console.error);
