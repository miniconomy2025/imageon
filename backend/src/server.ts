import "dotenv/config";
import { serve } from "@hono/node-server";
import { createFederation, Follow, Accept, Like, Undo } from "@fedify/fedify";
import { RedisKvStore } from "@fedify/redis";
import { config } from "./config/index.js";
import { createRedisInstance } from "./config/redis.js";
import { FederationHandlers } from "./handlers/federation.js";
import { WebHandlers } from "./handlers/web.js";
import { AuthHandlers } from "./handlers/auth.js";
import { ActorModel } from "./models/Actor.js";
import { activityPub } from "./services/activitypub.js";

import { db } from "./services/database.js";
import { requireAuth } from "./middleware/auth.js";

const redis = createRedisInstance();

const federation = createFederation<void>({
  kv: new RedisKvStore(redis),
  origin: `${config.federation.protocol}://${config.federation.domain}`,
});

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

federation
  .setInboxListeners("/users/{identifier}/inbox", "/inbox")
  .on(Follow, FederationHandlers.handleFollowActivity)
  // Handle Accept activities from remote servers
  .on(Accept, FederationHandlers.handleAcceptActivity)
  // Handle Like activities from remote servers
  .on(Like, FederationHandlers.handleLikeActivity)
  // Handle Undo activities (e.g. unfollow) from remote servers
  .on(Undo, FederationHandlers.handleUndoActivity);

// Main server
serve({
  fetch: async (request: Request) => {
    const url = new URL(request.url);

    // Add CORS headers for all requests
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Auth endpoints
    if (url.pathname === "/auth/verify" && request.method === "POST") {
      const response = await AuthHandlers.handleVerifyToken(request);
      // Add CORS headers to the response
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    if (
      url.pathname === "/auth/complete-profile" &&
      request.method === "POST"
    ) {
      const response = await requireAuth(AuthHandlers.handleCompleteProfile)(
        request
      );
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    if (url.pathname === "/auth/profile" && request.method === "GET") {
      const response = await requireAuth(AuthHandlers.handleGetProfile)(
        request
      );
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    if (url.pathname === "/auth/profile" && request.method === "PUT") {
      const response = await requireAuth(AuthHandlers.handleUpdateProfile)(
        request
      );
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    if (url.pathname === "/auth/check-username" && request.method === "GET") {
      const response = await AuthHandlers.handleCheckUsername(request);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // New user routes
    if (url.pathname === "/auth/user/posts" && request.method === "GET") {
      const response = await requireAuth(AuthHandlers.handleGetUserPosts)(
        request
      );
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    if (url.pathname === "/auth/user/followers" && request.method === "GET") {
      const response = await requireAuth(AuthHandlers.handleGetFollowers)(
        request
      );
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    if (url.pathname === "/auth/user/following" && request.method === "GET") {
      const response = await requireAuth(AuthHandlers.handleGetFollowing)(
        request
      );
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    if (url.pathname === "/auth/user/logged-in" && request.method === "GET") {
      const response = await requireAuth(AuthHandlers.handleGetLoggedInUser)(
        request
      );
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    if (url.pathname === "/auth/user/by-id" && request.method === "GET") {
      const response = await AuthHandlers.handleGetUserById(request);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Health check endpoint
    if (url.pathname === "/health") {
      return await WebHandlers.handleHealthCheck();
    }

    // Home page
    if (url.pathname === "/") {
      return await WebHandlers.handleHomePage(url);
    }

    // WebFinger actor discovery endpoint
    // Responds with JRD (JSON Resource Descriptor) object describing the actor
    if (url.pathname === "/.well-known/webfinger") {
      try {
        const resource = url.searchParams.get("resource");
        if (!resource) {
          return new Response(
            JSON.stringify({ error: "Missing 'resource' query parameter" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        // Expect resource in the form acct:username@domain
        const match = resource.match(/^acct:([^@]+)@(.+)$/);
        if (!match) {
          return new Response(
            JSON.stringify({ error: "Invalid resource format" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        const [, identifier, domain] = match;
        // Ensure the domain matches our configured domain
        const expectedDomain = config.federation.domain;
        if (domain !== expectedDomain) {
          // For other domains we cannot serve WebFinger
          return new Response(
            JSON.stringify({
              error: "Requested resource not served by this domain",
            }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        // Look up the actor
        const actor = await ActorModel.getActor(identifier);
        if (!actor) {
          return new Response(JSON.stringify({ error: "Actor not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        const actorUrl = `${config.federation.protocol}://${config.federation.domain}/users/${identifier}`;
        const jrd = {
          subject: resource,
          aliases: [actorUrl],
          links: [
            {
              rel: "self",
              type: "application/activity+json",
              href: actorUrl,
            },
            {
              rel: "http://webfinger.net/rel/profile-page",
              type: "text/html",
              href: actorUrl,
            },
          ],
        };
        return new Response(JSON.stringify(jrd), {
          status: 200,
          headers: { "Content-Type": "application/jrd+json" },
        });
      } catch (error) {
        console.error("Error processing WebFinger request:", error);
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Followers collection endpoint (ActivityPub OrderedCollection, API only)
    const followersParts = url.pathname.split("/");
    if (
      followersParts.length === 5 &&
      followersParts[1] === "api" &&
      followersParts[2] === "users" &&
      followersParts[4] === "followers" &&
      request.method === "GET"
    ) {
      const identifier = followersParts[3];
      try {
        // Verify that the actor exists
        const exists = await ActorModel.exists(identifier);
        if (!exists) {
          return new Response(JSON.stringify({ error: "Actor not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        // Get list of follower URIs
        const followerUris = await activityPub.getFollowers(identifier);
        const collection = {
          "@context": "https://www.w3.org/ns/activitystreams",
          id: `${config.federation.protocol}://${config.federation.domain}/users/${identifier}/followers`,
          type: "OrderedCollection",
          totalItems: followerUris.length,
          orderedItems: followerUris,
        };
        return new Response(JSON.stringify(collection), {
          status: 200,
          headers: { "Content-Type": "application/activity+json" },
        });
      } catch (error) {
        console.error("Error fetching followers list:", error);
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Following collection endpoint (ActivityPub OrderedCollection, API only)
    const followingParts = url.pathname.split("/");
    if (
      followingParts.length === 5 &&
      followingParts[1] === "api" &&
      followingParts[2] === "users" &&
      followingParts[4] === "following" &&
      request.method === "GET"
    ) {
      const identifier = followingParts[3];
      try {
        const exists = await ActorModel.exists(identifier);
        if (!exists) {
          return new Response(JSON.stringify({ error: "Actor not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        const followingUris = await activityPub.getFollowing(identifier);
        const collection = {
          "@context": "https://www.w3.org/ns/activitystreams",
          id: `${config.federation.protocol}://${config.federation.domain}/users/${identifier}/following`,
          type: "OrderedCollection",
          totalItems: followingUris.length,
          orderedItems: followingUris,
        };
        return new Response(JSON.stringify(collection), {
          status: 200,
          headers: { "Content-Type": "application/activity+json" },
        });
      } catch (error) {
        console.error("Error fetching following list:", error);
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Create post endpoint
    if (url.pathname === "/api/posts" && request.method === "POST") {
      // Protect the create post endpoint behind authentication
      const response = await requireAuth((r: any) => AuthHandlers.handleCreatePost(r))(request);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value as any);
      });
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Like and unlike endpoints for posts (API only)
    const likeParts = url.pathname.split("/");
    if (
      likeParts.length === 5 &&
      likeParts[1] === "api" &&
      likeParts[2] === "posts" &&
      likeParts[4] === "like"
    ) {
      const postId = likeParts[3];
      if (request.method === "POST") {
        // Authenticate like request
        const response = await requireAuth((r: any) => AuthHandlers.handleLikePost(r, postId))(request);
        const responseHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          responseHeaders.set(key, value as any);
        });
        return new Response(response.body, {
          status: response.status,
          headers: responseHeaders,
        });
      }
      if (request.method === "DELETE") {
        // Authenticate unlike request
        const response = await requireAuth((r: any) => AuthHandlers.handleUnlikePost(r, postId))(request);
        const responseHeaders = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
          responseHeaders.set(key, value as any);
        });
        return new Response(response.body, {
          status: response.status,
          headers: responseHeaders,
        });
      }
    }

    // Create comment endpoint (API only)
    const commentParts = url.pathname.split("/");
    if (
      commentParts.length === 5 &&
      commentParts[1] === "api" &&
      commentParts[2] === "posts" &&
      commentParts[4] === "comment" &&
      request.method === "POST"
    ) {
      const parentPostId = commentParts[3];
      // Authenticate comment creation
      const response = await requireAuth((r: any) => AuthHandlers.handleCreateComment(r, parentPostId))(request);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value as any);
      });
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // User feed endpoint - returns posts from followed actors and self
    if (url.pathname === "/api/feed" && request.method === "GET") {
      // Authenticate feed retrieval
      const response = await requireAuth((r: any) => AuthHandlers.handleUserFeed(r))(request);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value as any);
      });
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Follow and unfollow endpoints
    if (url.pathname === "/api/follow" && (request.method === "POST" || request.method === "DELETE")) {
      // Authenticate follow and unfollow actions
      const response = await requireAuth((r: any) => AuthHandlers.handleFollowUnfollow(r))(request);
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value as any);
      });
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }
    
    // Handle outbox requests manually (API only)
    const outboxParts = url.pathname.split("/");
    if (
      outboxParts.length === 5 &&
      outboxParts[1] === "api" &&
      outboxParts[2] === "users" &&
      outboxParts[4] === "outbox"
    ) {
      const identifier = outboxParts[3];
      try {
        const cursor = url.searchParams.get("cursor");
        const outboxData = await FederationHandlers.handleOutboxRequest(
          null,
          identifier,
          cursor
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

    // All other federation-related requests are handled by the Federation object
    try {
      console.log(`🌐 Delegating to federation.fetch for: ${url.pathname}`);
      const federationResponse = await federation.fetch(request, {
        contextData: undefined,
      });
      console.log(
        `✅ Federation response status: ${federationResponse.status}`
      );
      return federationResponse;
    } catch (federationError) {
      console.error(
        `❌ CRITICAL: Federation fetch error for ${url.pathname}:`,
        federationError
      );
      if (federationError instanceof Error) {
        console.error(`❌ Federation error stack:`, federationError.stack);
        console.error(`❌ Federation error message:`, federationError.message);
      }

      // Return a more informative error response
      return new Response(
        JSON.stringify({
          error: "Federation processing failed",
          details:
            federationError instanceof Error
              ? federationError.message
              : String(federationError),
          path: url.pathname,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
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
