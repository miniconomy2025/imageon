import "dotenv/config";
import { serve } from "@hono/node-server";
import { createFederation, Follow, Accept, Like, Undo } from "@fedify/fedify";
import { RedisKvStore } from "@fedify/redis";
import { config } from "./config/index.js";
import { createRedisInstance } from "./config/redis.js";
import { FederationHandlers } from "./handlers/federation.js";
import { WebHandlers } from "./handlers/web.js";
import { ActorModel } from "./models/Actor.js";

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
