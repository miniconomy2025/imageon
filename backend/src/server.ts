import "dotenv/config";
import { serve } from "@hono/node-server";
import { createFederation, Follow, Accept, Like, Undo, kvCache, Note } from "@fedify/fedify";
import { RedisKvStore } from "@fedify/redis";
import { config } from "./config/index.js";
import { createRedisInstance } from "./config/redis.js";
import { FederationHandlers } from "./handlers/federation.js";
import { WebHandlers } from "./handlers/web.js";
import { ActorModel } from "./models/Actor.js";
import { activityPub } from "./services/activitypub.js";
import { randomUUID } from "crypto";
import { db } from "./services/database.js";

const redis = createRedisInstance();
const kvStore = new RedisKvStore(redis);

// Define context data type to include KV store access
interface ContextData {
  kv: RedisKvStore;
}

const federation = createFederation<ContextData>({
  kv: kvStore,
  origin: `${config.federation.protocol}://${config.federation.domain}`,
});

federation
  .setActorDispatcher("/users/{identifier}", FederationHandlers.handleActorRequest)
  .setKeyPairsDispatcher(FederationHandlers.handleKeyPairsRequest);

federation
  .setOutboxDispatcher("/users/{identifier}/outbox", FederationHandlers.handleOutboxRequest);

federation
  .setObjectDispatcher(
    Note, "/users/{identifier}/notes/{noteId}", FederationHandlers.handleNoteRequest);

federation
  .setFollowersDispatcher("/users/{identifier}/followers", FederationHandlers.handleFollowersRequest)
  .authorize(FederationHandlers.handleFollowersAuthorization)
  .setFirstCursor(() => "0")
  .setLastCursor(async (ctx: any, identifier: string) => {
    const followers = await activityPub.getFollowers(identifier);
    const pageSize = 20;
    const lastPage = Math.max(0, Math.floor((followers.length - 1) / pageSize) * pageSize);
    return String(lastPage);
  })
  .setCounter(FederationHandlers.handleFollowersCountRequest);

federation
  .setFollowingDispatcher("/users/{identifier}/following", FederationHandlers.handleFollowingRequest);

federation
  .setInboxListeners("/users/{identifier}/inbox", "/inbox")
  .on(Follow, FederationHandlers.handleFollowActivity)

  .on(Accept, FederationHandlers.handleAcceptActivity)

  .on(Like, FederationHandlers.handleLikeActivity)

  .on(Undo, FederationHandlers.handleUndoActivity);

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
        const objectId = `${config.federation.protocol}://${config.federation.domain}/posts/${postId}`;
        const activityId = `${actorUri}/activities/${postId}`;
        await db.putItem({
          PK: `POST#${postId}`,
          SK: 'OBJECT',
          id: objectId,
          actor: actorUri,
          content,
          created_at: new Date().toISOString(),
        });
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
      // Determine full post URI.  Posts are stored under `/posts/{id}` and
      // persisted with a POST#<id> partition key (see the Create post handler).
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
          const postItem = await db.getItem(`POST#${postId}`, 'OBJECT');
          if (!postItem) {
            return new Response(
              JSON.stringify({ error: 'Post not found' }),
              { status: 404, headers: { 'Content-Type': 'application/json' } },
            );
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
          const postItem = await db.getItem(`POST#${postId}`, 'OBJECT');
          if (!postItem) {
            return new Response(
              JSON.stringify({ error: 'Post not found' }),
              { status: 404, headers: { 'Content-Type': 'application/json' } },
            );
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

    // User discovery endpoints
    if (url.pathname === "/api/users/discover" && request.method === "POST") {
      try {
        const body = await request.json();
        const { handle } = body || {};
        
        if (!handle) {
          return new Response(
            JSON.stringify({ error: "Missing required field: handle" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        
        console.log(`🔍 User discovery request for: ${handle}`);
        
        // Simple inline discovery for testing
        // Parse handle
        const handleParts = handle.replace(/^@/, '').split('@');
        if (handleParts.length !== 2) {
          return new Response(
            JSON.stringify({ error: "Invalid handle format" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        
        const [username, domain] = handleParts;
        console.log(`📝 Parsed handle: ${username}@${domain}`);
        
        // Check if local user
        if (domain === config.federation.domain) {
          console.log(`🏠 Local user check for: ${username}`);
          const localActor = await ActorModel.getActor(username);
          if (localActor) {
            const user = {
              id: `${config.federation.protocol}://${config.federation.domain}/users/${username}`,
              type: 'Person',
              preferredUsername: username,
              name: localActor.name || username,
              summary: localActor.summary || '',
              isLocal: true,
              domain: domain,
              handle: handle
            };
            return new Response(
              JSON.stringify({ success: true, user }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }
        }
        
        // For remote users, try WebFinger discovery
        console.log(`🌐 Remote user discovery for: ${username}@${domain}`);
        try {
          const webfingerUrl = `https://${domain}/.well-known/webfinger?resource=acct:${username}@${domain}`;
          console.log(`🔍 WebFinger URL: ${webfingerUrl}`);
          
          const webfingerResponse = await fetch(webfingerUrl, {
            headers: {
              'Accept': 'application/jrd+json, application/json',
              'User-Agent': `ImageOn/1.0 (+${config.federation.protocol}://${config.federation.domain})`
            },
            signal: AbortSignal.timeout(10000)
          });
          
          console.log(`📊 WebFinger response status: ${webfingerResponse.status}`);
          
          if (!webfingerResponse.ok) {
            console.log(`❌ WebFinger failed: ${webfingerResponse.status} ${webfingerResponse.statusText}`);
            return new Response(
              JSON.stringify({ error: "User not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } }
            );
          }
          
          const webfingerData = await webfingerResponse.json();
          console.log(`📊 WebFinger data:`, JSON.stringify(webfingerData, null, 2));
          
          // Find ActivityPub self link
          const selfLink = webfingerData.links?.find((link: any) => 
            link.rel === 'self' && 
            (link.type === 'application/activity+json' || 
             link.type === 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
          );
          
          if (!selfLink?.href) {
            console.log(`❌ No ActivityPub self link found`);
            return new Response(
              JSON.stringify({ error: "User not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } }
            );
          }
          
          console.log(`✅ Found actor URI: ${selfLink.href}`);
          
          // Fetch actor profile
          const actorResponse = await fetch(selfLink.href, {
            headers: {
              'Accept': 'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
              'User-Agent': `ImageOn/1.0 (+${config.federation.protocol}://${config.federation.domain})`
            },
            signal: AbortSignal.timeout(10000)
          });
          
          console.log(`📊 Actor response status: ${actorResponse.status}`);
          
          if (!actorResponse.ok) {
            console.log(`❌ Actor fetch failed: ${actorResponse.status}`);
            return new Response(
              JSON.stringify({ error: "User not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } }
            );
          }
          
          const actor = await actorResponse.json();
          console.log(`✅ Actor fetched: ${actor.preferredUsername || actor.name}`);
          
          const user = {
            id: actor.id,
            type: actor.type,
            preferredUsername: actor.preferredUsername || username,
            name: actor.name || actor.preferredUsername || username,
            summary: actor.summary || '',
            url: actor.url || actor.id,
            inbox: actor.inbox,
            outbox: actor.outbox,
            followers: actor.followers,
            following: actor.following,
            icon: actor.icon,
            isLocal: false,
            domain: domain,
            handle: handle,
            discoveredAt: new Date().toISOString()
          };
          
          return new Response(
            JSON.stringify({ success: true, user }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
          
        } catch (fetchError) {
          console.error(`❌ Discovery error:`, fetchError);
          return new Response(
            JSON.stringify({ error: "User not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }
        
      } catch (error) {
        console.error("Error in user discovery:", error);
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }
    
    // User search endpoint 
    //TODO: to be implemented
    if (url.pathname === "/api/users/search" && request.method === "GET") {
      try {
        const query = url.searchParams.get("q");
        const limitParam = url.searchParams.get("limit");
        const limit = limitParam ? parseInt(limitParam, 10) : 10;
        
        if (!query) {
          return new Response(
            JSON.stringify({ error: "Missing query parameter 'q'" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        
        if (limit < 1 || limit > 50) {
          return new Response(
            JSON.stringify({ error: "Limit must be between 1 and 50" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        
        // Simple search implementation - just return empty results for now
        const results: any[] = [];
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            results,
            query,
            count: results.length 
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
        
      } catch (error) {
        console.error("Error in user search:", error);
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
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
        if (targetId && followerId === targetId) {
          return new Response(
            JSON.stringify({ error: "Cannot follow yourself" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        try {
          const targetHost = new URL(targetUri).hostname;
          const localHost = config.federation.domain.split(':')[0];
          if (targetHost === localHost) {
            const targetExists = await ActorModel.exists(targetId);
            if (!targetExists) {
              return new Response(JSON.stringify({ error: "Target actor not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
              });
            }
          }
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid target URI" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
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
    
    // All other federation-related requests are handled by the Federation object
    try {
      console.log(`🌐 Delegating to federation.fetch for: ${url.pathname}`);
      const federationResponse = await federation.fetch(request, { contextData: { kv: kvStore } });
      console.log(`✅ Federation response status: ${federationResponse.status}`);
      return federationResponse;
    } catch (federationError) {
      console.error(`❌ CRITICAL: Federation fetch error for ${url.pathname}:`, federationError);
      if (federationError instanceof Error) {
        console.error(`❌ Federation error stack:`, federationError.stack);
        console.error(`❌ Federation error message:`, federationError.message);
      }
      
      // Return a more informative error response
      return new Response(
        JSON.stringify({ 
          error: 'Federation processing failed', 
          details: federationError instanceof Error ? federationError.message : String(federationError),
          path: url.pathname 
        }), 
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  },
  port: config.port
});

console.log(`🚀 ImageOn Federation Server started on port ${config.port}`);
console.log(`🌐 Server URL: ${config.federation.protocol}://${config.federation.domain}`);
console.log(`📊 Health check: ${config.federation.protocol}://${config.federation.domain}/health`);
console.log(`🎭 Actors: ${config.federation.protocol}://${config.federation.domain}/users/{identifier}`);
