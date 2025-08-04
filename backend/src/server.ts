import "dotenv/config";
import { serve } from "@hono/node-server";
import { createFederation, Follow, Like } from "@fedify/fedify";
import { RedisKvStore } from "@fedify/redis";
import { config } from "./config/index.js";
import { createRedisInstance } from "./config/redis.js";
import { FederationHandlers } from "./handlers/federation.js";
import { WebHandlers } from "./handlers/web.js";
import { activityPub } from "./services/activitypub.js";

// Create Redis instance
const redis = createRedisInstance();

// Create federation instance with Redis KV store
const federation = createFederation<void>({
  kv: new RedisKvStore(redis),
});

// Configure federation dispatchers
federation
  .setActorDispatcher(
    "/users/{identifier}",
    FederationHandlers.handleActorRequest
  )
  .setKeyPairsDispatcher(FederationHandlers.handleKeyPairsRequest);

// Configure outbox dispatcher separately
federation.setOutboxDispatcher(
  "/users/{identifier}/outbox",
  FederationHandlers.handleOutboxRequest
);

// Configure inbox listeners
federation
  .setInboxListeners("/users/{identifier}/inbox", "/inbox")
  .on(Follow, FederationHandlers.handleFollowActivity)
  .on(Like, FederationHandlers.handleLikeActivity);

// Main server
serve({
  fetch: async (request: Request) => {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/health") {
      return await WebHandlers.handleHealthCheck();
    }

    // Home page
    if (url.pathname === "/") {
      return await WebHandlers.handleHomePage(url);
    }

    // Handle outbox requests manually
    const outboxRegex = /^\/users\/([^/]+)\/outbox$/;
    const outboxMatch = outboxRegex.exec(url.pathname);
    if (outboxMatch) {
      const identifier = outboxMatch[1];
      try {
        const outboxData = await FederationHandlers.handleOutboxRequest(
          null,
          identifier
        );
        if (outboxData) {
          return new Response(JSON.stringify(outboxData), {
            status: 200,
            headers: {
              "Content-Type": "application/activity+json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } else {
          return new Response(JSON.stringify({ error: "Actor not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch (error) {
        console.error("Error handling outbox request:", error);
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Post creation API endpoint
    if (request.method === "POST" && url.pathname === "/api/posts") {
      const userHeader = request.headers.get("X-User-ID"); // Simple auth for now
      if (!userHeader) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      try {
        const body = await request.json();
        const { content, mediaUrls, hashtags, mentions, visibility } = body;

        if (!content || content.trim().length === 0) {
          return new Response(
            JSON.stringify({ error: "Content is required" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        const result = await activityPub.createPost(userHeader, content, {
          mediaUrls,
          hashtags,
          mentions,
          visibility: visibility || "public",
        });

        if (result) {
          return new Response(
            JSON.stringify({
              success: true,
              post: result,
            }),
            {
              status: 201,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        } else {
          return new Response(
            JSON.stringify({ error: "Failed to create post" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      } catch (error) {
        console.error("Error creating post:", error);
        return new Response(JSON.stringify({ error: "Invalid request" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Like a post endpoint
    // if (
    //   request.method === "POST" &&
    //   url.pathname.match(/^\/api\/posts\/[^\/]+\/like$/)
    // ) {
    //   const userHeader = request.headers.get("X-User-ID");
    //   if (!userHeader) {
    //     return new Response(
    //       JSON.stringify({ error: "Authentication required" }),
    //       {
    //         status: 401,
    //         headers: { "Content-Type": "application/json" },
    //       }
    //     );
    //   }

    //   // Extract post ID from URL
    //   const postIdMatch = url.pathname.match(/^\/api\/posts\/([^\/]+)\/like$/);
    //   const postId = postIdMatch?.[1];

    //   if (!postId) {
    //     return new Response(JSON.stringify({ error: "Invalid post ID" }), {
    //       status: 400,
    //       headers: { "Content-Type": "application/json" },
    //     });
    //   }

    //   try {
    //     const result = await activityPub.createLike(userHeader, postId);

    //     if (result.success) {
    //       return new Response(
    //         JSON.stringify({
    //           success: true,
    //           like: result,
    //         }),
    //         {
    //           status: 201,
    //           headers: {
    //             "Content-Type": "application/json",
    //             "Access-Control-Allow-Origin": "*",
    //           },
    //         }
    //       );
    //     } else if (result.existing) {
    //       return new Response(JSON.stringify({ error: result.error }), {
    //         status: 409, // Conflict - already liked
    //         headers: { "Content-Type": "application/json" },
    //       });
    //     } else {
    //       return new Response(JSON.stringify({ error: result.error }), {
    //         status: 400,
    //         headers: { "Content-Type": "application/json" },
    //       });
    //     }
    //   } catch (error) {
    //     console.error("Error liking post:", error);
    //     return new Response(
    //       JSON.stringify({ error: "Internal server error" }),
    //       {
    //         status: 500,
    //         headers: { "Content-Type": "application/json" },
    //       }
    //     );
    //   }
    // }

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-User-ID",
        },
      });
    }

    // All other federation-related requests are handled by the Federation object
    return await federation.fetch(request, { contextData: undefined });
  },
  port: config.port,
});

console.log(`🚀 ImageOn Federation Server started on port ${config.port}`);
console.log(
  `🌐 Server URL: ${config.federation.protocol}://${config.federation.domain}`
);
console.log(
  `📊 Health check: ${config.federation.protocol}://${config.federation.domain}/health`
);
console.log(
  `🎭 Actors: ${config.federation.protocol}://${config.federation.domain}/users/{identifier}`
);
console.log(
  `📝 Create posts: POST ${config.federation.protocol}://${config.federation.domain}/api/posts`
);
console.log(
  `❤️ Like posts: POST ${config.federation.protocol}://${config.federation.domain}/api/posts/{postId}/like`
);
