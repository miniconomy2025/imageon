import dotenv from 'dotenv';
dotenv.config();
import { serve } from "@hono/node-server";
import { createFederation, Follow, Accept, Like, Undo, Note, Activity } from "@fedify/fedify";
import { RedisKvStore } from "@fedify/redis";
import { config } from "./config/index.js";
import { createRedisInstance } from "./config/redis.js";
import { FederationHandlers } from "./handlers/federation.js";
import { WebHandlers } from "./handlers/web.js";
import { AuthHandlers } from "./handlers/auth.js";
import { ActorModel } from "./models/Actor.js";
import { activityPub } from "./services/activitypub.js";

import { requireAuth } from "./middleware/auth.js";

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
  .setActorDispatcher(
    "/users/{identifier}",
    FederationHandlers.handleActorRequest
  )
  .setKeyPairsDispatcher(FederationHandlers.handleKeyPairsRequest);

federation
  .setOutboxDispatcher("/users/{identifier}/outbox", FederationHandlers.handleOutboxRequest);

federation
  .setObjectDispatcher(
    Note, "/users/{identifier}/posts/{noteId}", FederationHandlers.handleNoteRequest
  );

federation
  .setObjectDispatcher(
    Activity, "/users/{identifier}/activities/{activityId}", FederationHandlers.handleActivityRequest
  )


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

    // Add CORS headers for all requests including ActivityPub protocol support
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, User-Agent, Date, Digest, Signature, Host",
      "Access-Control-Expose-Headers": "Content-Type, Location, Date, ETag, Last-Modified",
    };

    // Helper function to add CORS headers to any response
    const addCorsHeaders = (response: Response): Response => {
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
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
      return addCorsHeaders(await WebHandlers.handleHealthCheck());
    }

    // Home page
    if (url.pathname === "/") {
      return addCorsHeaders(await WebHandlers.handleHomePage(url));
    }

    // WebFinger actor discovery endpoint
    // Responds with JRD (JSON Resource Descriptor) object describing the actor
    if (url.pathname === "/.well-known/webfinger") {
      try {
        const resource = url.searchParams.get("resource");
        if (!resource) {
          return addCorsHeaders(new Response(
            JSON.stringify({ error: "Missing 'resource' query parameter" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          ));
        }

        // Expect resource in the form acct:username@domain
        const match = resource.match(/^acct:([^@]+)@(.+)$/);
        if (!match) {
          return addCorsHeaders(new Response(
            JSON.stringify({ error: "Invalid resource format" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          ));
        }
        const [, identifier, domain] = match;
        // Ensure the domain matches our configured domain
        const expectedDomain = config.federation.domain;
        if (domain !== expectedDomain) {
          // For other domains we cannot serve WebFinger
          return addCorsHeaders(new Response(
            JSON.stringify({
              error: "Requested resource not served by this domain",
            }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            }
          ));
        }
        // Look up the actor
        const actor = await ActorModel.getActor(identifier);
        if (!actor) {
          return addCorsHeaders(new Response(JSON.stringify({ error: "Actor not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }));
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
        return addCorsHeaders(new Response(JSON.stringify(jrd), {
          status: 200,
          headers: { "Content-Type": "application/jrd+json" },
        }));
      } catch (error) {
        console.error("Error processing WebFinger request:", error);
        return addCorsHeaders(new Response(
          JSON.stringify({ error: "Internal server error" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        ));
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
          return addCorsHeaders(new Response(JSON.stringify({ error: "Actor not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }));
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
        return addCorsHeaders(new Response(JSON.stringify(collection), {
          status: 200,
          headers: { "Content-Type": "application/activity+json" },
        }));
      } catch (error) {
        console.error("Error fetching followers list:", error);
        return addCorsHeaders(new Response(
          JSON.stringify({ error: "Internal server error" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        ));
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
          return addCorsHeaders(new Response(JSON.stringify({ error: "Actor not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }));
        }
        const followingUris = await activityPub.getFollowing(identifier);
        const collection = {
          "@context": "https://www.w3.org/ns/activitystreams",
          id: `${config.federation.protocol}://${config.federation.domain}/users/${identifier}/following`,
          type: "OrderedCollection",
          totalItems: followingUris.length,
          orderedItems: followingUris,
        };
        return addCorsHeaders(new Response(JSON.stringify(collection), {
          status: 200,
          headers: { "Content-Type": "application/activity+json" },
        }));
      } catch (error) {
        console.error("Error fetching following list:", error);
        return addCorsHeaders(new Response(
          JSON.stringify({ error: "Internal server error" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        ));
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

    // User discovery endpoints
    if (url.pathname === "/api/users/discover" && request.method === "POST") {
      try {
        const body = await request.json();
        const { handle } = body || {};
        
        if (!handle) {
          return addCorsHeaders(new Response(
            JSON.stringify({ error: "Missing required field: handle" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          ));
        }
        
        console.log(`🔍 User discovery request for: ${handle}`);
        
        // Simple inline discovery for testing
        // Parse handle
        const handleParts = handle.replace(/^@/, '').split('@');
        if (handleParts.length !== 2) {
          return addCorsHeaders(new Response(
            JSON.stringify({ error: "Invalid handle format" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          ));
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
              icon: localActor.icon,
              isLocal: true,
              domain: domain,
              handle: handle
            };
            return addCorsHeaders(new Response(
              JSON.stringify({ success: true, user }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            ));
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
            return addCorsHeaders(new Response(
              JSON.stringify({ error: "User not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } }
            ));
          }
          
          const webfingerData = await webfingerResponse.json();          
          // Find ActivityPub self link
          const selfLink = webfingerData.links?.find((link: any) => 
            link.rel === 'self' && 
            (link.type === 'application/activity+json' || 
             link.type === 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
          );
          
          if (!selfLink?.href) {
            console.log(`❌ No ActivityPub self link found`);
            return addCorsHeaders(new Response(
              JSON.stringify({ error: "User not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } }
            ));
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
            return addCorsHeaders(new Response(
              JSON.stringify({ error: "User not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } }
            ));
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
          
          return addCorsHeaders(new Response(
            JSON.stringify({ success: true, user }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ));
          
        } catch (fetchError) {
          console.error(`❌ Discovery error:`, fetchError);
          return addCorsHeaders(new Response(
            JSON.stringify({ error: "User not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          ));
        }

      } catch (error) {
        console.error("Error in user discovery:", error);
        return addCorsHeaders(new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ));
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
          return addCorsHeaders(new Response(
            JSON.stringify({ error: "Missing query parameter 'q'" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          ));
        }
        
        if (limit < 1 || limit > 50) {
          return addCorsHeaders(new Response(
            JSON.stringify({ error: "Limit must be between 1 and 50" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          ));
        }
        
        // Simple search implementation - just return empty results for now
        const results: any[] = [];
        
        return addCorsHeaders(new Response(
          JSON.stringify({ 
            success: true, 
            results,
            query,
            count: results.length 
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ));
        
      } catch (error) {
        console.error("Error in user search:", error);
        return addCorsHeaders(new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ));
      }
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

    if (url.pathname === "/api/outbox" && request.method === "POST") {
      try {
        const body = await request.json();
        const { outboxUrl } = body;
        
        if (!outboxUrl || typeof outboxUrl !== 'string') {
          return addCorsHeaders(new Response(
            JSON.stringify({ error: "Missing or invalid outboxUrl" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          ));
        }

        // Validate URL to prevent SSRF attacks
        try {
          const parsedUrl = new URL(outboxUrl);
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new Error('Invalid protocol');
          }
        } catch {
          return addCorsHeaders(new Response(
            JSON.stringify({ error: "Invalid URL format" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          ));
        }

        // Fetch the outbox data
        console.log(`🔄 Proxying outbox request to: ${outboxUrl}`);
        const outboxResponse = await fetch(outboxUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/activity+json, application/ld+json',
            'User-Agent': 'ImageOn/1.0 ActivityPub Client'
          }
        });

        if (!outboxResponse.ok) {
          return addCorsHeaders(new Response(
            JSON.stringify({ 
              error: "Failed to fetch outbox", 
              status: outboxResponse.status,
              statusText: outboxResponse.statusText 
            }),
            { status: outboxResponse.status, headers: { "Content-Type": "application/json" } }
          ));
        }

        const outboxData = await outboxResponse.json();

        // If there's a paginated first page, fetch that too
        if (outboxData.first && typeof outboxData.first === 'string') {
          try {
            console.log(`🔄 Fetching first page: ${outboxData.first}`);
            const firstPageResponse = await fetch(outboxData.first, {
              method: 'GET',
              headers: {
                'Accept': 'application/activity+json, application/ld+json',
                'User-Agent': 'ImageOn/1.0 ActivityPub Client'
              }
            });

            if (firstPageResponse.ok) {
              const firstPageData = await firstPageResponse.json();
              // Return the first page data which contains the actual posts
              return addCorsHeaders(new Response(
                JSON.stringify(firstPageData),
                { status: 200, headers: { "Content-Type": "application/json" } }
              ));
            }
          } catch (error) {
            console.warn(`⚠️ Failed to fetch first page: ${error}`);
            // Fall back to returning the outbox collection itself
          }
        }

        return addCorsHeaders(new Response(
          JSON.stringify(outboxData),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ));

      } catch (error) {
        console.error("Error in outbox proxy:", error);
        return addCorsHeaders(new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        ));
      }
    }

    // All other federation-related requests are handled by the Federation object
    try {
      console.log(`🌐 Delegating to federation.fetch for: ${url.pathname}`);
      const federationResponse = await federation.fetch(request, {
        contextData: {kv: kvStore },
      });
      console.log(
        `✅ Federation response status: ${federationResponse.status}`
      );
      return addCorsHeaders(federationResponse);
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
      return addCorsHeaders(new Response(
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
      ));
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
