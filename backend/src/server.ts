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
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { S3Service }     from "./services/s3Service.js";

import { db } from "./services/database.js";
import { requireAuth } from "./middleware/auth.js";

const redis = createRedisInstance();

const s3 = new S3Service();

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
      try {
        
        const contentType = request.headers.get("content-type") || "";
        let actor: string, content: string;
        let mediaUrl: string | undefined;
        let mediaType: string | undefined; 

        if (contentType.startsWith("multipart/form-data")) {
          
          const form = await request.formData();
          actor = form.get("actor")?.toString()   || "";
          content = form.get("content")?.toString() || "";
          const file = form.get("media") as File | null;

          if (file) {
            // Generate a unique ID for the post using the imported randomUUID function.
            const postId = randomUUID();
            const key = `posts/${actor}/${postId}/${file.name}`;
            // Convert the browser ReadableStream into a Node.js Readable. This is necessary because
            // the AWS SDK expects a Node stream when running in a server environment.
            const nodeStream = Readable.fromWeb(file.stream() as any);
            mediaUrl = await s3.uploadMedia(key, nodeStream, file.type);
            mediaType = file.type;
          }
        } else {
          const json = await request.json();
          actor   = json.actor;
          content = json.content;
        }

        if (!actor || !content) {
          return new Response(
            JSON.stringify({
              error: "Missing required fields: actor and content",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        let identifier: string;
        if (actor.startsWith("http://") || actor.startsWith("https://")) {
          try {
            const actorUrl = new URL(actor);
            const parts = actorUrl.pathname.split("/");
            const usersIndex = parts.indexOf("users");
            identifier =
              usersIndex !== -1 && parts[usersIndex + 1]
                ? parts[usersIndex + 1]
                : "";
          } catch {
            identifier = "";
          }
        } else {
          identifier = actor;
        }
        if (!identifier) {
          return new Response(
            JSON.stringify({ error: "Invalid actor identifier" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        const exists = await ActorModel.exists(identifier);
        if (!exists) {
          return new Response(JSON.stringify({ error: "Actor not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        const actorUri = `${config.federation.protocol}://${config.federation.domain}/users/${identifier}`;
        const postId = randomUUID();
        const objectId = `${config.federation.protocol}://${config.federation.domain}/posts/${postId}`;
        const activityId = `${actorUri}/activities/${postId}`;

        const item: Record<string, any> = {
          PK: `POST#${postId}`,
          SK: "OBJECT",
          id: objectId,
          actor: actorUri,
          content,
          created_at: new Date().toISOString(),
        };
        if (mediaUrl) {
          item.media_url = mediaUrl;
        }
        await db.putItem(item);

        const extra = { content } as any;
        if (mediaUrl) {
          extra.attachment = [{
            type: "Document",
            mediaType: mediaType,
            url: mediaUrl
          }];
        }
        await activityPub.saveActivity(activityId, "Create", actorUri, objectId, extra);
        
        return new Response(
          JSON.stringify({
            success: true,
            activityId,
            objectId,
            actor: actorUri,
            content,
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        console.error("Error creating post:", error);
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
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
      // Determine full post URI.  Posts are stored under `/posts/{id}` and
      // persisted with a POST#<id> partition key (see the Create post handler).
      const postUri = `${config.federation.protocol}://${config.federation.domain}/posts/${postId}`;
      if (request.method === "POST") {
        try {
          const body = await request.json().catch(() => null);
          const actor = body && typeof body === 'object' ? (body as any).actor : undefined;
          if (!actor) {
            return new Response(
              JSON.stringify({ error: "Missing required field: actor" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          // Resolve actor identifier
          let identifier: string;
          if (actor.startsWith("http://") || actor.startsWith("https://")) {
            try {
              const actorUrl = new URL(actor);
              const parts = actorUrl.pathname.split("/");
              const usersIndex = parts.indexOf("users");
              identifier =
                usersIndex !== -1 && parts[usersIndex + 1]
                  ? parts[usersIndex + 1]
                  : "";
            } catch {
              identifier = "";
            }
          } else {
            identifier = actor;
          }
          if (!identifier) {
            return new Response(
              JSON.stringify({ error: "Invalid actor identifier" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          const exists = await ActorModel.exists(identifier);
          if (!exists) {
            return new Response(JSON.stringify({ error: "Actor not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }
          const postItem = await db.getItem(`POST#${postId}`, "OBJECT");
          if (!postItem) {
            return new Response(JSON.stringify({ error: "Post not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }
          const actorUri = `${config.federation.protocol}://${config.federation.domain}/users/${identifier}`;
          const likeId = randomUUID();
          const activityId = `${actorUri}/activities/${likeId}`;
          // Save Like activity
          await activityPub.saveActivity(activityId, "Like", actorUri, postUri);
          return new Response(
            JSON.stringify({
              success: true,
              activityId,
              actor: actorUri,
              object: postUri,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          );
        } catch (error) {
          console.error("Error processing Like activity:", error);
          return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      }
      if (request.method === "DELETE") {
        try {
          const body = await request.json().catch(() => null);
          const actor = body && typeof body === 'object' ? (body as any).actor : undefined;
          if (!actor) {
            return new Response(
              JSON.stringify({ error: "Missing required field: actor" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          // Resolve actor identifier
          let identifier: string;
          if (actor.startsWith("http://") || actor.startsWith("https://")) {
            try {
              const actorUrl = new URL(actor);
              const parts = actorUrl.pathname.split("/");
              const usersIndex = parts.indexOf("users");
              identifier =
                usersIndex !== -1 && parts[usersIndex + 1]
                  ? parts[usersIndex + 1]
                  : "";
            } catch {
              identifier = "";
            }
          } else {
            identifier = actor;
          }
          if (!identifier) {
            return new Response(
              JSON.stringify({ error: "Invalid actor identifier" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          const exists = await ActorModel.exists(identifier);
          if (!exists) {
            return new Response(JSON.stringify({ error: "Actor not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }
          const postItem = await db.getItem(`POST#${postId}`, "OBJECT");
          if (!postItem) {
            return new Response(JSON.stringify({ error: "Post not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }
          const actorUri = `${config.federation.protocol}://${config.federation.domain}/users/${identifier}`;
          const undoId = randomUUID();
          const activityId = `${actorUri}/activities/${undoId}`;
          // Record Undo activity for unlike
          await activityPub.saveActivity(activityId, "Undo", actorUri, postUri);
          return new Response(
            JSON.stringify({
              success: true,
              activityId,
              actor: actorUri,
              object: postUri,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch (error) {
          console.error("Error processing Undo Like activity:", error);
          return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
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
      // Determine parent post URI
      const parentPostUri = `${config.federation.protocol}://${config.federation.domain}/posts/${parentPostId}`;
      try {
        // Safely parse request body as JSON
        const body = await request.json().catch(() => null);
        const actorParam = body && typeof body === 'object' ? (body as any).actor : undefined;
        const content = body && typeof body === 'object' ? (body as any).content : undefined;
        if (!actorParam || !content) {
          return new Response(
            JSON.stringify({ error: "Missing required fields: actor and content" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        // Resolve actor identifier
        let identifier: string;
        if (actorParam.startsWith("http://") || actorParam.startsWith("https://")) {
          try {
            const actorUrl = new URL(actorParam);
            const parts = actorUrl.pathname.split("/");
            const usersIndex = parts.indexOf("users");
            identifier = usersIndex !== -1 && parts[usersIndex + 1] ? parts[usersIndex + 1] : "";
          } catch {
            identifier = "";
          }
        } else {
          identifier = actorParam;
        }
        if (!identifier) {
          return new Response(
            JSON.stringify({ error: "Invalid actor identifier" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        // Check actor exists
        const actorExists = await ActorModel.exists(identifier);
        if (!actorExists) {
          return new Response(JSON.stringify({ error: "Actor not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        // Ensure parent post exists
        const postItem = await db.getItem(`POST#${parentPostId}`, "OBJECT");
        if (!postItem) {
          return new Response(
            JSON.stringify({ error: "Post not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }
        const actorUri = `${config.federation.protocol}://${config.federation.domain}/users/${identifier}`;
        // Create comment object and activity
        const commentId = randomUUID();
        const commentObjectId = `${config.federation.protocol}://${config.federation.domain}/comments/${commentId}`;
        const activityId = `${actorUri}/activities/${commentId}`;
        // Save comment object in database
        const commentItem: Record<string, any> = {
          PK: `COMMENT#${commentId}`,
          SK: "OBJECT",
          id: commentObjectId,
          actor: actorUri,
          content,
          inReplyTo: parentPostUri,
          created_at: new Date().toISOString(),
        };
        await db.putItem(commentItem);
        // Save Create activity with additional data including inReplyTo
        const additionalData: Record<string, any> = { content, inReplyTo: parentPostUri };
        await activityPub.saveActivity(activityId, "Create", actorUri, commentObjectId, additionalData);
        return new Response(
          JSON.stringify({
            success: true,
            activityId,
            objectId: commentObjectId,
            actor: actorUri,
            content,
            inReplyTo: parentPostUri,
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        console.error("Error creating comment:", error);
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // User feed endpoint - returns posts from followed actors and self
    if (url.pathname === "/api/feed" && request.method === "GET") {
      try {
        // Extract actor parameter
        const actorParam = url.searchParams.get("actor") || "";
        if (!actorParam) {
          return new Response(
            JSON.stringify({ error: "Missing required query parameter: actor" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        // Resolve actor identifier
        let identifier: string;
        if (actorParam.startsWith("http://") || actorParam.startsWith("https://")) {
          try {
            const urlObj = new URL(actorParam);
            const parts = urlObj.pathname.split("/");
            const usersIndex = parts.indexOf("users");
            identifier = usersIndex !== -1 && parts[usersIndex + 1] ? parts[usersIndex + 1] : "";
          } catch {
            identifier = "";
          }
        } else {
          identifier = actorParam;
        }
        if (!identifier) {
          return new Response(
            JSON.stringify({ error: "Invalid actor identifier" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        // Verify actor exists
        const exists = await ActorModel.exists(identifier);
        if (!exists) {
          return new Response(JSON.stringify({ error: "Actor not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        // Get list of actors this user follows (URIs)
        const followingUris = await activityPub.getFollowing(identifier);
        // Include the user's own actor URI
        const selfUri = `${config.federation.protocol}://${config.federation.domain}/users/${identifier}`;
        const actorUris = [selfUri, ...followingUris];
        const items: any[] = [];
        // Helper to extract identifier from URI
        const extractIdentifier = (uri: string): string | null => {
          try {
            const urlObj = new URL(uri);
            const parts = urlObj.pathname.split("/");
            const usersIndex = parts.indexOf("users");
            if (usersIndex !== -1 && parts[usersIndex + 1]) {
              return parts[usersIndex + 1];
            }
            return null;
          } catch {
            return null;
          }
        };
        // Fetch activities for each actor and accumulate Create activities
        for (const uri of actorUris) {
          const id = uri.startsWith("http://") || uri.startsWith("https://") ? extractIdentifier(uri) : uri;
          if (!id) continue;
          const activities = await activityPub.getActorActivities(id) as any[];
          for (const act of activities as any[]) {
            const activity: any = act as any;
            if (activity.type === "Create") {
              // Each Create activity should include actor, object, published and possibly additionalData
              const entry: any = {
                actor: activity.actor,
                object: activity.object,
                published: activity.published,
              };
              if (activity.additionalData && typeof activity.additionalData === "object") {
                if ("content" in activity.additionalData) {
                  entry.content = (activity.additionalData as any).content;
                }
                if ("attachment" in activity.additionalData) {
                  entry.attachment = (activity.additionalData as any).attachment;
                }
                if ("inReplyTo" in activity.additionalData) {
                  entry.inReplyTo = (activity.additionalData as any).inReplyTo;
                }
              }
              items.push(entry);
            }
          }
        }
        // Sort by published date descending
        items.sort((a, b) => {
          const timeA = new Date(a.published).getTime();
          const timeB = new Date(b.published).getTime();
          return timeB - timeA;
        });
        return new Response(
          JSON.stringify({ items }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      } catch (error) {
        console.error("Error generating feed:", error);
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // Follow and unfollow endpoints
    if (url.pathname === "/api/follow" && (request.method === "POST" || request.method === "DELETE")) {
      try {
        const body = await request.json().catch(() => null);
        const actor = body && typeof body === 'object' ? (body as any).actor : undefined;
        const target = body && typeof body === 'object' ? (body as any).target : undefined;
        if (!actor || !target) {
          return new Response(
            JSON.stringify({
              error: "Missing required fields: actor and target",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        // Resolve follower identifier
        let followerId: string;
        if (actor.startsWith("http://") || actor.startsWith("https://")) {
          try {
            const u = new URL(actor);
            const parts = u.pathname.split("/");
            const idx = parts.indexOf("users");
            followerId = idx !== -1 && parts[idx + 1] ? parts[idx + 1] : "";
          } catch {
            followerId = "";
          }
        } else {
          followerId = actor;
        }
        // Resolve target identifier or leave full URI
        let targetId: string;
        let targetUri: string;
        if (target.startsWith("http://") || target.startsWith("https://")) {
          targetUri = target;
          try {
            const tu = new URL(target);
            const parts = tu.pathname.split("/");
            const idx = parts.indexOf("users");
            targetId = idx !== -1 && parts[idx + 1] ? parts[idx + 1] : "";
          } catch {
            targetId = "";
          }
        } else {
          targetId = target;
          targetUri = `${config.federation.protocol}://${config.federation.domain}/users/${target}`;
        }
        if (!followerId) {
          return new Response(
            JSON.stringify({ error: "Invalid actor identifier" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        const followerExists = await ActorModel.exists(followerId);
        if (!followerExists) {
          return new Response(JSON.stringify({ error: "Actor not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (targetId && followerId === targetId) {
          return new Response(
            JSON.stringify({ error: "Cannot follow yourself" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        try {
          const targetHost = new URL(targetUri).hostname;
          const localHost = config.federation.domain.split(":")[0];
          if (targetHost === localHost) {
            const targetExists = await ActorModel.exists(targetId);
            if (!targetExists) {
              return new Response(
                JSON.stringify({ error: "Target actor not found" }),
                {
                  status: 404,
                  headers: { "Content-Type": "application/json" },
                }
              );
            }
          }
        } catch {
          return new Response(JSON.stringify({ error: "Invalid target URI" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const followerUri = `${config.federation.protocol}://${config.federation.domain}/users/${followerId}`;
        const followId = randomUUID();
        const activityId = `${followerUri}/activities/${followId}`;
        if (request.method === "POST") {
          // Save follower relationship and activity
          await activityPub.saveFollower(activityId, followerUri, targetUri);
          await activityPub.saveActivity(
            activityId,
            "Follow",
            followerUri,
            targetUri
          );
          return new Response(
            JSON.stringify({
              success: true,
              activityId,
              follower: followerUri,
              target: targetUri,
            }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          );
        } else {
          // DELETE - unfollow
          await activityPub.removeFollower(followerUri, targetUri);
          await activityPub.saveActivity(
            activityId,
            "Undo",
            followerUri,
            targetUri
          );
          return new Response(
            JSON.stringify({
              success: true,
              activityId,
              follower: followerUri,
              target: targetUri,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
      } catch (error) {
        console.error("Error processing follow/unfollow:", error);
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
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
