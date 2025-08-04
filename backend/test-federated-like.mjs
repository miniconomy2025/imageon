#!/usr/bin/env node

/**
 * Test script to send a properly signed ActivityPub Like activity
 * This simulates what a real ActivityPub server would send
 */

import crypto from "crypto";

const BASE_URL = "http://localhost:3000";

// Generate a simple key pair for testing
function generateKeyPair() {
  return crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
}

// Create HTTP signature
function createSignature(privateKey, method, path, host, date, body) {
  const bodyHash = crypto.createHash("sha256").update(body).digest("base64");

  // Build the signature string
  const signatureString = [
    `(request-target): ${method.toLowerCase()} ${path}`,
    `host: ${host}`,
    `date: ${date}`,
    `digest: SHA-256=${bodyHash}`,
  ].join("\n");

  // Sign it
  const signature = crypto.sign(
    "sha256",
    Buffer.from(signatureString),
    privateKey
  );
  return signature.toString("base64");
}

async function sendSignedLikeActivity() {
  try {
    console.log("🔑 Generating test key pair...");
    const { publicKey, privateKey } = generateKeyPair();

    // Create the activity
    const activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: "https://test-server.com/activities/like-" + Date.now(),
      type: "Like",
      actor: "https://test-server.com/users/test-user",
      object: "http://localhost:3000/objects/post-001",
      published: new Date().toISOString(),
    };

    const body = JSON.stringify(activity);
    const date = new Date().toUTCString();
    const host = "localhost:3000";
    const path = "/users/alice/inbox";

    console.log("📝 Creating HTTP signature...");
    const signature = createSignature(
      privateKey,
      "POST",
      path,
      host,
      date,
      body
    );

    // Prepare headers with signature
    const keyId = "https://test-server.com/users/test-user#main-key";
    const signatureHeader = [
      `keyId="${keyId}"`,
      'algorithm="rsa-sha256"',
      'headers="(request-target) host date digest"',
      `signature="${signature}"`,
    ].join(",");

    const bodyHash = crypto.createHash("sha256").update(body).digest("base64");

    const headers = {
      "Content-Type": "application/activity+json",
      Accept: "application/activity+json",
      Date: date,
      Host: host,
      Digest: `SHA-256=${bodyHash}`,
      Signature: signatureHeader,
    };

    console.log("🚀 Sending signed Like activity...");
    console.log("Target:", `${BASE_URL}${path}`);
    console.log("Activity ID:", activity.id);
    console.log("Actor:", activity.actor);
    console.log("Object:", activity.object);

    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: headers,
      body: body,
    });

    console.log(`\n📥 Response: ${response.status} ${response.statusText}`);

    if (response.ok) {
      console.log("✅ Like activity sent successfully!");

      // Check Alice's outbox to see if it worked
      console.log("\n🔍 Checking Alice's outbox...");
      const outboxResponse = await fetch(`${BASE_URL}/users/alice/outbox`);
      const outboxData = await outboxResponse.json();

      if (outboxData.items) {
        const likes = outboxData.items.filter((item) => item.type === "Like");
        console.log(
          `📦 Alice's outbox now has ${likes.length} like activities`
        );

        // Show the latest like
        const latestLike = likes[0];
        if (latestLike) {
          console.log(
            `   Latest: ${latestLike.actor} liked ${latestLike.object}`
          );
        }
      }
    } else {
      const errorText = await response.text();
      console.log("❌ Failed to send activity");
      console.log("Error:", errorText);

      if (response.status === 401) {
        console.log("\n💡 Note: This is expected if the server requires");
        console.log("    key verification from known servers.");
        console.log("    Real ActivityPub servers exchange keys first.");
      }
    }
  } catch (error) {
    console.error("❌ Error sending activity:", error.message);
  }
}

// Run the test
console.log("🧪 Testing Federated Like Activity with HTTP Signatures");
console.log("=".repeat(60));
sendSignedLikeActivity();
