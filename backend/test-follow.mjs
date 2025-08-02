// Simple test to send a follow request to our federation server

const testActor = {
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Person",
  "id": "https://example.com/users/testfollower",
  "preferredUsername": "testfollower",
  "name": "Test Follower",
  "inbox": "https://example.com/users/testfollower/inbox"
};

const followActivity = {
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Follow",
  "id": "https://example.com/activities/follow-1",
  "actor": "https://example.com/users/testfollower",
  "object": "http://localhost:3000/users/me"
};

console.log("Sending follow request...");
console.log(JSON.stringify(followActivity, null, 2));

try {
  const response = await fetch("http://localhost:3000/users/me/inbox", {
    method: "POST",
    headers: {
      "Content-Type": "application/activity+json",
      "Accept": "application/activity+json"
    },
    body: JSON.stringify(followActivity)
  });

  console.log("Response status:", response.status);
  console.log("Response headers:", Object.fromEntries(response.headers.entries()));
  
  if (response.ok) {
    console.log("Follow request sent successfully!");
  } else {
    const errorText = await response.text();
    console.log("Error response:", errorText);
  }
} catch (error) {
  console.error("Error sending follow request:", error);
}
