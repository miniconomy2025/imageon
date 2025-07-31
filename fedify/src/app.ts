import express from "express";
import { integrateFederation } from "@fedify/express";
import { getLogger } from "@logtape/logtape";
import federation, { postsService } from "./federation.ts";
import { redisClient } from "./config/database.js";

const logger = getLogger("imageON");

export const app = express();

app.set("trust proxy", true);

// Parse JSON bodies
app.use(express.json());

// Add CORS headers for federation
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Accept");
  next();
});

// Initialize Redis connection
redisClient.connect().catch(console.error);

// Use a simpler federation integration approach
app.use((req, res, next) => {
  // Handle ActivityPub requests
  if (
    req.headers.accept &&
    req.headers.accept.includes("application/activity+json")
  ) {
    // Let Fedify handle ActivityPub requests
    return integrateFederation(federation, (req) => undefined)(req, res, next);
  }
  // For regular web requests, continue to normal routes
  next();
});

// Get the base URL for the application
const getBaseUrl = () => {
  if (process.env.NODE_ENV === "production") {
    return (
      process.env.RENDER_EXTERNAL_URL ||
      `https://${process.env.RENDER_SERVICE_NAME}.onrender.com`
    );
  }
  return `http://localhost:${process.env.PORT || 8001}`;
};

// ActivityPub user profile endpoint
app.get("/users/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const baseUrl = getBaseUrl();

    // Get user's posts to count them
    const userPosts = await postsService.getPostsByUsername(username);

    // Create ActivityPub Person object
    const person = {
      "@context": [
        "https://www.w3.org/ns/activitystreams",
        "https://w3id.org/security/v1",
      ],
      id: `${baseUrl}/users/${username}`,
      type: "Person",
      preferredUsername: username,
      name: username,
      summary: `A user on ${baseUrl}`,
      inbox: `${baseUrl}/users/${username}/inbox`,
      outbox: `${baseUrl}/users/${username}/outbox`,
      followers: `${baseUrl}/users/${username}/followers`,
      following: `${baseUrl}/users/${username}/following`,
      publicKey: {
        id: `${baseUrl}/users/${username}#main-key`,
        owner: `${baseUrl}/users/${username}`,
        publicKeyPem:
          "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----\n",
      },
      attachment: [
        {
          type: "PropertyValue",
          name: "Posts",
          value: `${userPosts.length} posts`,
        },
      ],
      endpoints: {
        sharedInbox: `${baseUrl}/inbox`,
      },
    };

    res.setHeader("Content-Type", "application/activity+json");
    res.json(person);
  } catch (error) {
    logger.error(`Error getting user profile: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Basic ActivityPub endpoints for federation
app.get("/.well-known/webfinger", (req, res) => {
  const resource = req.query.resource;
  if (!resource || !resource.toString().startsWith("acct:")) {
    return res.status(400).json({ error: "Invalid resource parameter" });
  }

  const username = resource.toString().replace("acct:", "").split("@")[0];
  const baseUrl = getBaseUrl();

  res.setHeader("Content-Type", "application/jrd+json");
  res.json({
    subject: resource,
    links: [
      {
        rel: "self",
        type: "application/activity+json",
        href: `${baseUrl}/users/${username}`,
      },
    ],
  });
});

app.get("/.well-known/nodeinfo", (req, res) => {
  const baseUrl = getBaseUrl();
  res.json({
    links: [
      {
        rel: "http://nodeinfo.diaspora.software/ns/schema/2.0",
        href: `${baseUrl}/nodeinfo/2.0`,
      },
    ],
  });
});

app.get("/nodeinfo/2.0", async (req, res) => {
  try {
    const allPosts = await postsService.getAllPosts();
    const baseUrl = getBaseUrl();

    res.json({
      version: "2.0",
      software: {
        name: "fedify-social-network",
        version: "1.0.0",
      },
      protocols: ["activitypub"],
      services: {
        inbound: [],
        outbound: [],
      },
      usage: {
        users: {
          total: 1,
        },
        localPosts: allPosts.length,
      },
      openRegistrations: false,
      metadata: {
        nodeName: "Fedify Social Network",
        nodeDescription: "A federated social network built with Fedify",
        maintainer: {
          name: "Fedify Social Network",
          email: "admin@example.com",
        },
        themeColor: "#007bff",
      },
    });
  } catch (error) {
    logger.error(`Error getting nodeinfo: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/", (req, res) => {
  const baseUrl = getBaseUrl();
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Fedify Social Network</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f5f5f5;
            }
            .container {
                background: white;
                border-radius: 12px;
                padding: 30px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 {
                color: #333;
                text-align: center;
                margin-bottom: 30px;
            }
            .post-form {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            .form-group {
                margin-bottom: 15px;
            }
            label {
                display: block;
                margin-bottom: 5px;
                font-weight: 600;
                color: #555;
            }
            input, textarea {
                width: 100%;
                padding: 12px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 16px;
                box-sizing: border-box;
            }
            textarea {
                resize: vertical;
                min-height: 100px;
            }
            button {
                background: #007bff;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-size: 16px;
                cursor: pointer;
                transition: background 0.2s;
            }
            button:hover {
                background: #0056b3;
            }
            .posts {
                margin-top: 30px;
            }
            .post {
                background: white;
                border: 1px solid #e9ecef;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 15px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .post-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            .username {
                font-weight: 600;
                color: #007bff;
            }
            .timestamp {
                color: #6c757d;
                font-size: 14px;
            }
            .content {
                color: #333;
                line-height: 1.6;
                white-space: pre-wrap;
            }
            .refresh-btn {
                background: #28a745;
                margin-left: 10px;
            }
            .refresh-btn:hover {
                background: #218838;
            }
            .federation-info {
                background: #e3f2fd;
                border: 1px solid #2196f3;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 20px;
            }
            .federation-info h3 {
                color: #1976d2;
                margin-top: 0;
            }
            .database-info {
                background: #f3e5f5;
                border: 1px solid #9c27b0;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 20px;
            }
            .database-info h3 {
                color: #7b1fa2;
                margin-top: 0;
            }
            .deployment-info {
                background: #e8f5e8;
                border: 1px solid #4caf50;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 20px;
            }
            .deployment-info h3 {
                color: #2e7d32;
                margin-top: 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🐦 Fedify Social Network</h1>
            
            <div class="federation-info">
                <h3>🌐 Federation Enabled</h3>
                <p>This server is now federated with the ActivityPub network! Other servers like Mastodon can discover and interact with users on this platform.</p>
                <p><strong>Example user profile:</strong> <a href="${baseUrl}/users/tshepobbd" target="_blank">@tshepobbd</a></p>
            </div>
            
            <div class="database-info">
                <h3>💾 Database Integration</h3>
                <p>Posts are now stored in DynamoDB with Redis caching for fast performance!</p>
                <p><strong>Features:</strong> Persistent storage, intelligent caching, and scalable architecture.</p>
            </div>
            
            <div class="deployment-info">
                <h3>🚀 Production Ready</h3>
                <p>This application is deployed on Render.com and ready for federation!</p>
                <p><strong>Server URL:</strong> <a href="${baseUrl}" target="_blank">${baseUrl}</a></p>
            </div>
            
            <div class="post-form">
                <h3>Create a Post</h3>
                <form id="postForm">
                    <div class="form-group">
                        <label for="username">Username:</label>
                        <input type="text" id="username" name="username" required placeholder="Enter your username">
                    </div>
                    <div class="form-group">
                        <label for="content">Post Content:</label>
                        <textarea id="content" name="content" required placeholder="What's on your mind?"></textarea>
                    </div>
                    <button type="submit">Post</button>
                </form>
            </div>
            
            <div class="posts">
                <h3>Recent Posts</h3>
                <button onclick="loadPosts()" class="refresh-btn">Refresh Posts</button>
                <div id="postsList"></div>
            </div>
        </div>

        <script>
            // Load posts on page load
            loadPosts();

            // Handle form submission
            document.getElementById('postForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const username = document.getElementById('username').value;
                const content = document.getElementById('content').value;
                
                try {
                    const response = await fetch('/api/posts', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ username, content }),
                    });
                    
                    if (response.ok) {
                        document.getElementById('content').value = '';
                        loadPosts();
                        alert('Post created successfully!');
                    } else {
                        const error = await response.json();
                        alert('Error: ' + error.error);
                    }
                } catch (error) {
                    alert('Error creating post: ' + error.message);
                }
            });

            // Load and display posts
            async function loadPosts() {
                try {
                    const response = await fetch('/api/posts');
                    const posts = await response.json();
                    
                    const postsList = document.getElementById('postsList');
                    postsList.innerHTML = '';
                    
                    if (posts.length === 0) {
                        postsList.innerHTML = '<p>No posts yet. Be the first to post!</p>';
                        return;
                    }
                    
                    posts.forEach(post => {
                        const postElement = document.createElement('div');
                        postElement.className = 'post';
                        
                        const timestamp = new Date(post.createdAt).toLocaleString();
                        
                        postElement.innerHTML = \`
                            <div class="post-header">
                                <span class="username">@\${post.username}</span>
                                <span class="timestamp">\${timestamp}</span>
                            </div>
                            <div class="content">\${post.content}</div>
                        \`;
                        
                        postsList.appendChild(postElement);
                    });
                } catch (error) {
                    console.error('Error loading posts:', error);
                    document.getElementById('postsList').innerHTML = '<p>Error loading posts.</p>';
                }
            }
        </script>
    </body>
    </html>
  `);
});

// API endpoint to create a post
app.post("/api/posts", async (req, res) => {
  try {
    const { username, content } = req.body;

    if (!username || !content) {
      return res
        .status(400)
        .json({ error: "Username and content are required" });
    }

    if (typeof content !== "string" || content.trim().length === 0) {
      return res
        .status(400)
        .json({ error: "Content must be a non-empty string" });
    }

    const postId = Date.now().toString();
    const baseUrl = getBaseUrl();
    const post = {
      id: postId,
      username,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      attributedTo: `${baseUrl}/users/${username}`,
    };

    await postsService.createPost(post);

    res.status(201).json({
      id: postId,
      username,
      content: post.content,
      createdAt: post.createdAt,
    });
  } catch (error) {
    logger.error(`Error creating post: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API endpoint to get all posts
app.get("/api/posts", async (req, res) => {
  try {
    const allPosts = await postsService.getAllPosts();
    res.json(allPosts);
  } catch (error) {
    logger.error(`Error getting all posts: ${error}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API endpoint to get posts by a specific user
app.get("/api/users/:username/posts", async (req, res) => {
  try {
    const { username } = req.params;
    const userPosts = await postsService.getPostsByUsername(username);
    res.json(userPosts);
  } catch (error) {
    logger.error(
      `Error getting posts for user ${req.params.username}: ${error}`
    );
    res.status(500).json({ error: "Internal server error" });
  }
});

export default app;
