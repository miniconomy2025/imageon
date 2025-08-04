import "dotenv/config";
import { serve } from "@hono/node-server";
import { createFederation, Follow, Accept, Like, Undo } from "@fedify/fedify";
import { RedisKvStore } from "@fedify/redis";
import { config } from "./config/index.js";
import { createRedisInstance } from "./config/redis.js";
import { FederationHandlers } from "./handlers/federation.js";
import { WebHandlers } from "./handlers/web.js";
import { ActorModel } from "./models/Actor.js";
// Import ActivityPub service for managing followers, posts and likes
import { activityPub } from "./services/activitypub.js";
// Import randomUUID for generating unique IDs for activities and posts
import { randomUUID } from "crypto";

// Create Redis instance
const redis = createRedisInstance();

// Create federation instance with Redis KV store
const federation = createFederation<void>({
  kv: new RedisKvStore(redis),
});

// Configure federation dispatchers
federation
  .setActorDispatcher("/users/{identifier}", FederationHandlers.handleActorRequest)
  .setKeyPairsDispatcher(FederationHandlers.handleKeyPairsRequest);

// Configure outbox dispatcher separately
federation.setOutboxDispatcher("/users/{identifier}/outbox", FederationHandlers.handleOutboxRequest);

// Configure inbox listeners
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
            },
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
            },
          );
        }
        const [, identifier, domain] = match;
        // Ensure the domain matches our configured domain
        const expectedDomain = config.federation.domain;
        if (domain !== expectedDomain) {
          // For other domains we cannot serve WebFinger
          return new Response(
            JSON.stringify({ error: "Requested resource not served by this domain" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        // Look up the actor
        const actor = await ActorModel.getActor(identifier);
        if (!actor) {
          return new Response(
            JSON.stringify({ error: "Actor not found" }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          );
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
          },
        );
      }
    }

    // Followers collection endpoint (ActivityPub OrderedCollection)
    const followersMatch = /^\/users\/([^/]+)\/followers$/.exec(url.pathname);
    if (followersMatch && request.method === "GET") {
      const identifier = followersMatch[1];
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
        return new Response(JSON.stringify({ error: "Internal server error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Following collection endpoint (ActivityPub OrderedCollection)
    const followingMatch = /^\/users\/([^/]+)\/following$/.exec(url.pathname);
    if (followingMatch && request.method === "GET") {
      const identifier = followingMatch[1];
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
        return new Response(JSON.stringify({ error: "Internal server error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Create post endpoint
    if (url.pathname === "/posts" && request.method === "POST") {
      try {
        const body = await request.json();
        const { actor, content } = body || {};
        if (!actor || !content) {
          return new Response(
            JSON.stringify({ error: "Missing required fields: actor and content" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        // Actor can be a username or a full URI. Extract identifier if necessary.
        let identifier: string;
        if (actor.startsWith("http://") || actor.startsWith("https://")) {
          try {
            const actorUrl = new URL(actor);
            const parts = actorUrl.pathname.split("/");
            const usersIndex = parts.indexOf("users");
            identifier = usersIndex !== -1 && parts[usersIndex + 1] ? parts[usersIndex + 1] : "";
          } catch {
            identifier = "";
          }
        } else {
          identifier = actor;
        }
        if (!identifier) {
          return new Response(
            JSON.stringify({ error: "Invalid actor identifier" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
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
        // Generate unique IDs for the activity and the post object
        const postId = randomUUID();
        const objectId = `${actorUri}/posts/${postId}`;
        const activityId = `${actorUri}/activities/${postId}`;
        // Save the Create activity
        await activityPub.saveActivity(activityId, "Create", actorUri, objectId, { content });
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
          },
        );
      } catch (error) {
        console.error("Error creating post:", error);
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // Like and unlike endpoints for posts
    const likeMatch = /^\/posts\/([^/]+)\/like$/.exec(url.pathname);
    if (likeMatch) {
      const postId = likeMatch[1];
      // Determine full post URI
      const postUri = `${config.federation.protocol}://${config.federation.domain}/posts/${postId}`;
      if (request.method === "POST") {
        try {
          const body = await request.json();
          const { actor } = body || {};
          if (!actor) {
            return new Response(
              JSON.stringify({ error: "Missing required field: actor" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }
          // Resolve actor identifier
          let identifier: string;
          if (actor.startsWith("http://") || actor.startsWith("https://")) {
            try {
              const actorUrl = new URL(actor);
              const parts = actorUrl.pathname.split("/");
              const usersIndex = parts.indexOf("users");
              identifier = usersIndex !== -1 && parts[usersIndex + 1] ? parts[usersIndex + 1] : "";
            } catch {
              identifier = "";
            }
          } else {
            identifier = actor;
          }
          if (!identifier) {
            return new Response(
              JSON.stringify({ error: "Invalid actor identifier" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
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
          const likeId = randomUUID();
          const activityId = `${actorUri}/activities/${likeId}`;
          // Save Like activity
          await activityPub.saveActivity(activityId, "Like", actorUri, postUri);
          return new Response(
            JSON.stringify({ success: true, activityId, actor: actorUri, object: postUri }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        } catch (error) {
          console.error("Error processing Like activity:", error);
          return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      }
      if (request.method === "DELETE") {
        try {
          const body = await request.json();
          const { actor } = body || {};
          if (!actor) {
            return new Response(
              JSON.stringify({ error: "Missing required field: actor" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }
          // Resolve actor identifier
          let identifier: string;
          if (actor.startsWith("http://") || actor.startsWith("https://")) {
            try {
              const actorUrl = new URL(actor);
              const parts = actorUrl.pathname.split("/");
              const usersIndex = parts.indexOf("users");
              identifier = usersIndex !== -1 && parts[usersIndex + 1] ? parts[usersIndex + 1] : "";
            } catch {
              identifier = "";
            }
          } else {
            identifier = actor;
          }
          if (!identifier) {
            return new Response(
              JSON.stringify({ error: "Invalid actor identifier" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
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
          const undoId = randomUUID();
          const activityId = `${actorUri}/activities/${undoId}`;
          // Record Undo activity for unlike
          await activityPub.saveActivity(activityId, "Undo", actorUri, postUri);
          return new Response(
            JSON.stringify({ success: true, activityId, actor: actorUri, object: postUri }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (error) {
          console.error("Error processing Undo Like activity:", error);
          return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      }
    }

    // Follow and unfollow endpoints
    if (url.pathname === "/follow" && (request.method === "POST" || request.method === "DELETE")) {
      try {
        const body = await request.json();
        const { actor, target } = body || {};
        if (!actor || !target) {
          return new Response(
            JSON.stringify({ error: "Missing required fields: actor and target" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
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
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        const followerExists = await ActorModel.exists(followerId);
        if (!followerExists) {
          return new Response(JSON.stringify({ error: "Actor not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        const followerUri = `${config.federation.protocol}://${config.federation.domain}/users/${followerId}`;
        const followId = randomUUID();
        const activityId = `${followerUri}/activities/${followId}`;
        if (request.method === "POST") {
          // Save follower relationship and activity
          await activityPub.saveFollower(activityId, followerUri, targetUri);
          await activityPub.saveActivity(activityId, "Follow", followerUri, targetUri);
          return new Response(
            JSON.stringify({ success: true, activityId, follower: followerUri, target: targetUri }),
            { status: 201, headers: { "Content-Type": "application/json" } },
          );
        } else {
          // DELETE - unfollow
          await activityPub.removeFollower(followerUri, targetUri);
          await activityPub.saveActivity(activityId, "Undo", followerUri, targetUri);
          return new Response(
            JSON.stringify({ success: true, activityId, follower: followerUri, target: targetUri }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
      } catch (error) {
        console.error("Error processing follow/unfollow:", error);
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    }
    
    // Handle outbox requests manually
    const outboxRegex = /^\/users\/([^/]+)\/outbox$/;
    const outboxMatch = outboxRegex.exec(url.pathname);
    if (outboxMatch) {
      const identifier = outboxMatch[1];
      try {
        const outboxData = await FederationHandlers.handleOutboxRequest(null, identifier);
        if (outboxData) {
          return new Response(JSON.stringify(outboxData), {
            status: 200,
            headers: {
              'Content-Type': 'application/activity+json',
              'Access-Control-Allow-Origin': '*',
            }
          });
        } else {
          return new Response(JSON.stringify({ error: 'Actor not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (error) {
        console.error('Error handling outbox request:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // All other federation-related requests are handled by the Federation object
    return await federation.fetch(request, { contextData: undefined });
  },
  port: config.port
});

console.log(`🚀 ImageOn Federation Server started on port ${config.port}`);
console.log(`🌐 Server URL: ${config.federation.protocol}://${config.federation.domain}`);
console.log(`📊 Health check: ${config.federation.protocol}://${config.federation.domain}/health`);
console.log(`🎭 Actors: ${config.federation.protocol}://${config.federation.domain}/users/{identifier}`);
