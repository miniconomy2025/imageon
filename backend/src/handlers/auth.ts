import { auth } from "../config/firebase.js";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth.js";
import { config } from "../config/index.js";
import { ActorModel } from "../models/Actor.js";
import { db } from "../services/database.js";
import { getFirestore } from "firebase-admin/firestore";

// Additional imports to support post, like, comment, feed and follow operations
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { S3Service } from "../services/s3Service.js";
import { activityPub } from "../services/activitypub.js";

const firestore = getFirestore();

export class AuthHandlers {
  // Verify Firebase token and get user data
  static async handleVerifyToken(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { idToken } = body;

      if (!idToken) {
        return new Response(JSON.stringify({ error: "Missing idToken" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const decodedToken = await auth.verifyIdToken(idToken);

      // Check if user exists in DynamoDB
      const userData = await db.getItem(`USER#${decodedToken.uid}`, "PROFILE");

      if (!userData) {
        return new Response(
          JSON.stringify({
            error: "User not found",
            needsProfile: true,
            uid: decodedToken.uid,
            email: decodedToken.email,
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            uid: decodedToken.uid,
            email: decodedToken.email,
            displayName: userData?.display_name,
            username: userData?.username,
            photoURL: userData?.profile_image_url || decodedToken.picture,
            needsProfile: false,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error verifying token:", error);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Complete user profile after Google sign-in
  static async handleCompleteProfile(
    request: AuthenticatedRequest
  ): Promise<Response> {
    try {
      const body = await request.json();
      const { displayName, username, summary } = body;

      if (!request.user) {
        return new Response(
          JSON.stringify({ error: "User not authenticated" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (!displayName || !username) {
        return new Response(
          JSON.stringify({ error: "Missing displayName or username" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Check if username is already taken
      const usernameQuery = await db.queryItemsByGSI1(`USERNAME#${username}`, {
        sortKeyExpression: "SK = :sk",
        attributeValues: { ":sk": "PROFILE" },
      });

      if (usernameQuery.length > 0) {
        return new Response(
          JSON.stringify({ error: "Username already taken" }),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Create user document in DynamoDB
      const userData = {
        PK: `USER#${request.user.uid}`,
        SK: "PROFILE",
        GSI1PK: `USER#${request.user.uid}`,
        GSI1SK: "PROFILE",
        GSI2PK: `USERNAME#${username}`,
        GSI2SK: "PROFILE",
        uid: request.user.uid,
        email: request.user.email,
        username,
        display_name: displayName,
        bio: summary || "",
        profile_image_url: request.user.photoURL,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        is_verified: false,
        is_private: false,
        status: "active",
        actor_type: "Person",
        preferred_username: username,
        domain: config.federation.domain,
      };

      await db.putItem(userData);

      // Store user mapping in Firestore for quick lookups
      const userMapping = {
        username,
        actorId: `ACTOR#${username}`,
        firebaseUserId: request.user.uid,
        email: request.user.email,
        createdAt: new Date().toISOString(),
      };

      await firestore
        .collection("users")
        .doc(request.user.uid)
        .set(userMapping);

      // Create ActivityPub actor
      const actorData = {
        id: `${config.federation.protocol}://${config.federation.domain}/users/${username}`,
        type: "Person",
        preferredUsername: username,
        name: displayName,
        summary: summary || "",
        inbox: `${config.federation.protocol}://${config.federation.domain}/users/${username}/inbox`,
        outbox: `${config.federation.protocol}://${config.federation.domain}/users/${username}/outbox`,
        followers: `${config.federation.protocol}://${config.federation.domain}/users/${username}/followers`,
        following: `${config.federation.protocol}://${config.federation.domain}/users/${username}/following`,
        url: `${config.federation.protocol}://${config.federation.domain}/users/${username}`,
        published: new Date().toISOString(),
        followers_count: 0,
        following_count: 0,
        publicKey: {
          id: `${config.federation.protocol}://${config.federation.domain}/users/${username}#main-key`,
          owner: `${config.federation.protocol}://${config.federation.domain}/users/${username}`,
          publicKeyPem: "", // You'll need to generate this
        },
      };

      await ActorModel.createActor(actorData);

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            uid: userData.uid,
            email: userData.email,
            displayName: userData.display_name,
            username: userData.username,
            photoURL: userData.profile_image_url,
            bio: userData.bio,
            needsProfile: false,
          },
          actor: actorData,
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error completing profile:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Get current user profile
  static async handleGetProfile(
    request: AuthenticatedRequest
  ): Promise<Response> {
    try {
      if (!request.user) {
        return new Response(
          JSON.stringify({ error: "User not authenticated" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const userData = await db.getItem(`USER#${request.user.uid}`, "PROFILE");

      if (!userData) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            uid: userData.uid,
            email: userData.email,
            displayName: userData.display_name,
            username: userData.username,
            photoURL: userData.profile_image_url,
            bio: userData.bio,
            needsProfile: false,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error getting profile:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Update user profile
  static async handleUpdateProfile(
    request: AuthenticatedRequest
  ): Promise<Response> {
    try {
      if (!request.user) {
        return new Response(
          JSON.stringify({ error: "User not authenticated" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const body = await request.json();
      const { displayName, photoURL, bio } = body;

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (displayName) updateData.display_name = displayName;
      if (photoURL) updateData.profile_image_url = photoURL;
      if (bio !== undefined) updateData.bio = bio;

      const updateItem = {
        PK: `USER#${request.user.uid}`,
        SK: "PROFILE",
        ...updateData,
      };
      await db.putItem(updateItem);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Profile updated successfully",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error updating profile:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Check username availability
  static async handleCheckUsername(request: Request): Promise<Response> {
    try {
      const { searchParams } = new URL(request.url);
      const username = searchParams.get("username");

      if (!username) {
        return new Response(
          JSON.stringify({ error: "Username parameter required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const usernameQuery = await db.queryItemsByGSI1(`USERNAME#${username}`, {
        sortKeyExpression: "SK = :sk",
        attributeValues: { ":sk": "PROFILE" },
      });

      const isAvailable = usernameQuery.length === 0;

      return new Response(
        JSON.stringify({
          success: true,
          username,
          isAvailable,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error checking username:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Get user posts
  static async handleGetUserPosts(
    request: AuthenticatedRequest
  ): Promise<Response> {
    try {
      if (!request.user) {
        return new Response(
          JSON.stringify({ error: "User not authenticated" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Get user mapping from Firestore to get username
      const userMappingDoc = await firestore
        .collection("users")
        .doc(request.user.uid)
        .get();

      if (!userMappingDoc.exists) {
        return new Response(
          JSON.stringify({ error: "User mapping not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const userMapping = userMappingDoc.data();

      if (!userMapping?.username) {
        return new Response(JSON.stringify({ error: "Invalid user mapping" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const actorId = `ACTOR#${userMapping.username}`;

      // Get posts from DynamoDB
      const posts = await db.queryItemsByGSI1(actorId, {
        sortKeyExpression: "begins_with(SK, :sk)",
        attributeValues: { ":sk": "POST#" },
      });

      return new Response(
        JSON.stringify({
          success: true,
          posts: posts.map((post) => ({
            id: post.post_id,
            content: post.content,
            createdAt: post.created_at,
            likesCount: post.likes_count || 0,
            authorUsername: post.author_username,
          })),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error getting user posts:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Get user followers
  static async handleGetFollowers(
    request: AuthenticatedRequest
  ): Promise<Response> {
    try {
      if (!request.user) {
        return new Response(
          JSON.stringify({ error: "User not authenticated" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Get user mapping from Firestore to get username
      const userMappingDoc = await firestore
        .collection("users")
        .doc(request.user.uid)
        .get();

      if (!userMappingDoc.exists) {
        return new Response(
          JSON.stringify({ error: "User mapping not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const userMapping = userMappingDoc.data();

      if (!userMapping?.username) {
        return new Response(JSON.stringify({ error: "Invalid user mapping" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get followers from DynamoDB
      const followers = await db.queryItems(
        `FOLLOWER#${userMapping.username}`,
        {
          sortKeyExpression: "begins_with(SK, :sk)",
          attributeValues: { ":sk": "ACTOR#" },
        }
      );

      return new Response(
        JSON.stringify({
          success: true,
          followers: followers.map((follower) => ({
            username: follower.SK?.replace("ACTOR#", "") || "",
            displayName: follower.follower_display_name,
            createdAt: follower.created_at,
          })),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error getting followers:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Get user following
  static async handleGetFollowing(
    request: AuthenticatedRequest
  ): Promise<Response> {
    try {
      if (!request.user) {
        return new Response(
          JSON.stringify({ error: "User not authenticated" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Get user mapping from Firestore to get username
      const userMappingDoc = await firestore
        .collection("users")
        .doc(request.user.uid)
        .get();

      if (!userMappingDoc.exists) {
        return new Response(
          JSON.stringify({ error: "User mapping not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const userMapping = userMappingDoc.data();

      if (!userMapping?.username) {
        return new Response(JSON.stringify({ error: "Invalid user mapping" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get following from DynamoDB
      const following = await db.queryItems(
        `FOLLOWER#${userMapping.username}`,
        {
          sortKeyExpression: "begins_with(SK, :sk)",
          attributeValues: { ":sk": "ACTOR#" },
        }
      );

      return new Response(
        JSON.stringify({
          success: true,
          following: following.map((follow) => ({
            username: follow.SK?.replace("ACTOR#", "") || "",
            displayName: follow.following_display_name,
            createdAt: follow.created_at,
          })),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error getting following:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Get user by ID
  static async handleGetUserById(request: Request): Promise<Response> {
    try {
      const { searchParams } = new URL(request.url);
      const userId = searchParams.get("userId");

      if (!userId) {
        return new Response(
          JSON.stringify({ error: "User ID parameter required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Get user from DynamoDB
      const userData = await db.getItem(`USER#${userId}`, "PROFILE");

      if (!userData) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            uid: userData.uid,
            email: userData.email,
            displayName: userData.display_name,
            username: userData.username,
            photoURL: userData.profile_image_url,
            bio: userData.bio,
            followersCount: userData.followers_count,
            followingCount: userData.following_count,
            postsCount: userData.posts_count,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error getting user by ID:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Get logged in user (full profile from DynamoDB)
  static async handleGetLoggedInUser(
    request: AuthenticatedRequest
  ): Promise<Response> {
    try {
      if (!request.user) {
        return new Response(
          JSON.stringify({ error: "User not authenticated" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Get user mapping from Firestore to get username
      const userMappingDoc = await firestore
        .collection("users")
        .doc(request.user.uid)
        .get();

      if (!userMappingDoc.exists) {
        return new Response(
          JSON.stringify({ error: "User mapping not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const userMapping = userMappingDoc.data();

      if (!userMapping?.username) {
        return new Response(JSON.stringify({ error: "Invalid user mapping" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get full user profile from DynamoDB
      const userData = await db.getItem(`USER#${request.user.uid}`, "PROFILE");

      if (!userData) {
        return new Response(
          JSON.stringify({ error: "User profile not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            uid: userData.uid,
            email: userData.email,
            displayName: userData.display_name,
            username: userData.username,
            photoURL: userData.profile_image_url,
            bio: userData.bio,
            followersCount: userData.followers_count,
            followingCount: userData.following_count,
            postsCount: userData.posts_count,
            actorId: userMapping.actorId,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error getting logged in user:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  /**
   * Create a new post. Supports both JSON and multipart/form-data requests.
   * The actor is always derived from the authenticated user and never taken from client input.
   * Optionally accepts a media file which will be uploaded to S3.
   */
  static async handleCreatePost(request: Request): Promise<Response> {
    try {
      const contentType = request.headers.get("content-type") || "";
      let content: string | undefined;
      let mediaUrl: string | undefined;
      let mediaType: string | undefined;
      let actorParam: string | undefined;
      let file: File | null | undefined;

      // Parse incoming body depending on content type
      if (contentType.startsWith("multipart/form-data")) {
        const form = await request.formData();
        // Content is required
        content = form.get("content")?.toString() || "";
        actorParam = form.get("actor")?.toString() || undefined;
        file = form.get("media") as File | null;
      } else {
        const json = await request.json().catch(() => ({}));
        content = (json as any).content;
        actorParam = (json as any).actor;
      }

      // Ensure content is provided
      if (!content || typeof content !== "string" || content.trim() === "") {
        return new Response(
          JSON.stringify({ error: "Missing required field: content" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Determine the actor identifier from the authenticated user
      const authReq = request as unknown as AuthenticatedRequest;
      let identifier: string | undefined;
      if (authReq.user) {
        // Fetch username mapping from Firestore
        const userMappingDoc = await firestore
          .collection("users")
          .doc(authReq.user.uid)
          .get();
        if (!userMappingDoc.exists) {
          return new Response(
            JSON.stringify({ error: "User mapping not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }
        const userMapping = userMappingDoc.data();
        if (!userMapping || !userMapping.username) {
          return new Response(
            JSON.stringify({ error: "Invalid user mapping" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        identifier = userMapping.username as string;
      } else {
        // If unauthenticated, fall back to actorParam for federated actors
        if (!actorParam || typeof actorParam !== "string") {
          return new Response(
            JSON.stringify({ error: "Missing required field: actor" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        // Resolve identifier from actorParam (URI or bare username)
        if (actorParam.startsWith("http://") || actorParam.startsWith("https://")) {
          try {
            const actorUrl = new URL(actorParam);
            const parts = actorUrl.pathname.split("/");
            const usersIndex = parts.indexOf("users");
            identifier = usersIndex !== -1 && parts[usersIndex + 1]
              ? parts[usersIndex + 1]
              : undefined;
          } catch {
            identifier = undefined;
          }
        } else {
          identifier = actorParam;
        }
      }

      if (!identifier) {
        return new Response(
          JSON.stringify({ error: "Invalid actor identifier" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Ensure the actor exists
      const exists = await ActorModel.exists(identifier);
      if (!exists) {
        return new Response(
          JSON.stringify({ error: "Actor not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      // If a media file was provided, upload it using the derived identifier
      if (file) {
        const postIdForMedia = randomUUID();
        const key = `posts/${identifier}/${postIdForMedia}/${file.name}`;
        const nodeStream = Readable.fromWeb(file.stream() as any);
        const s3 = new S3Service();
        mediaUrl = await s3.uploadMedia(key, nodeStream, file.type);
        mediaType = file.type;
      }

      // Build ActivityPub URIs
      const actorUri = `${config.federation.protocol}://${config.federation.domain}/users/${identifier}`;
      const postId = randomUUID();
      const objectId = `${config.federation.protocol}://${config.federation.domain}/posts/${postId}`;
      const activityId = `${actorUri}/activities/${postId}`;
      // Persist post object
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
      // Prepare additional data for the activity
      const extra: any = { content };
      if (mediaUrl) {
        extra.attachment = [
          {
            type: "Document",
            mediaType: mediaType,
            url: mediaUrl,
          },
        ];
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
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error creating post:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  /**
   * Handle liking a post. Expects JSON body with actor field. Returns a Like activity.
   */
  static async handleLikePost(request: Request, postId: string): Promise<Response> {
    try {
      const postUri = `${config.federation.protocol}://${config.federation.domain}/posts/${postId}`;
      // Parse request body for potential federated actor
      const body = await request.json().catch(() => null);
      const actorParam = body && typeof body === "object" ? (body as any).actor : undefined;

      // Determine identifier: prefer authenticated user, otherwise use actorParam
      const authReq = request as unknown as AuthenticatedRequest;
      let identifier: string | undefined;
      if (authReq.user) {
        // Local user: derive username from Firestore mapping
        const userMappingDoc = await firestore
          .collection("users")
          .doc(authReq.user.uid)
          .get();
        if (!userMappingDoc.exists) {
          return new Response(
            JSON.stringify({ error: "User mapping not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }
        const userMapping = userMappingDoc.data();
        if (!userMapping || !userMapping.username) {
          return new Response(
            JSON.stringify({ error: "Invalid user mapping" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        identifier = userMapping.username as string;
      } else {
        // Federated request: actorParam must be provided
        if (!actorParam) {
          return new Response(
            JSON.stringify({ error: "Missing required field: actor" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        // Resolve identifier from actorParam
        if (typeof actorParam === "string" && (actorParam.startsWith("http://") || actorParam.startsWith("https://"))) {
          try {
            const actorUrl = new URL(actorParam);
            const parts = actorUrl.pathname.split("/");
            const usersIndex = parts.indexOf("users");
            identifier = usersIndex !== -1 && parts[usersIndex + 1] ? parts[usersIndex + 1] : undefined;
          } catch {
            identifier = undefined;
          }
        } else {
          identifier = actorParam as any;
        }
      }
      if (!identifier) {
        return new Response(
          JSON.stringify({ error: "Invalid actor identifier" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      // Verify actor exists
      const exists = await ActorModel.exists(identifier);
      if (!exists) {
        return new Response(
          JSON.stringify({ error: "Actor not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      // Ensure the target post exists
      const postItem = await db.getItem(`POST#${postId}`, "OBJECT");
      if (!postItem) {
        return new Response(
          JSON.stringify({ error: "Post not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      const actorUri = `${config.federation.protocol}://${config.federation.domain}/users/${identifier}`;
      const likeId = randomUUID();
      const activityId = `${actorUri}/activities/${likeId}`;
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

  /**
   * Handle unliking a post. Expects JSON body with actor field. Returns an Undo activity.
   */
  static async handleUnlikePost(request: Request, postId: string): Promise<Response> {
    try {
      const postUri = `${config.federation.protocol}://${config.federation.domain}/posts/${postId}`;
      const body = await request.json().catch(() => null);
      const actorParam = body && typeof body === "object" ? (body as any).actor : undefined;

      // Determine identifier: prefer authenticated user, otherwise use actorParam
      const authReq = request as unknown as AuthenticatedRequest;
      let identifier: string | undefined;
      if (authReq.user) {
        const userMappingDoc = await firestore
          .collection("users")
          .doc(authReq.user.uid)
          .get();
        if (!userMappingDoc.exists) {
          return new Response(
            JSON.stringify({ error: "User mapping not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }
        const userMapping = userMappingDoc.data();
        if (!userMapping || !userMapping.username) {
          return new Response(
            JSON.stringify({ error: "Invalid user mapping" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        identifier = userMapping.username as string;
      } else {
        if (!actorParam) {
          return new Response(
            JSON.stringify({ error: "Missing required field: actor" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        if (typeof actorParam === "string" && (actorParam.startsWith("http://") || actorParam.startsWith("https://"))) {
          try {
            const actorUrl = new URL(actorParam);
            const parts = actorUrl.pathname.split("/");
            const usersIndex = parts.indexOf("users");
            identifier = usersIndex !== -1 && parts[usersIndex + 1] ? parts[usersIndex + 1] : undefined;
          } catch {
            identifier = undefined;
          }
        } else {
          identifier = actorParam as any;
        }
      }
      if (!identifier) {
        return new Response(
          JSON.stringify({ error: "Invalid actor identifier" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      const exists = await ActorModel.exists(identifier);
      if (!exists) {
        return new Response(
          JSON.stringify({ error: "Actor not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      const postItem = await db.getItem(`POST#${postId}`, "OBJECT");
      if (!postItem) {
        return new Response(
          JSON.stringify({ error: "Post not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      const actorUri = `${config.federation.protocol}://${config.federation.domain}/users/${identifier}`;
      const undoId = randomUUID();
      const activityId = `${actorUri}/activities/${undoId}`;
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

  /**
   * Create a comment on an existing post. Expects JSON body with actor and content.
   * Returns a Create activity for the comment.
   */
  static async handleCreateComment(request: Request, parentPostId: string): Promise<Response> {
    // Determine parent post URI
    const parentPostUri = `${config.federation.protocol}://${config.federation.domain}/posts/${parentPostId}`;
    try {
      const body = await request.json().catch(() => null);
      const actorParam = body && typeof body === "object" ? (body as any).actor : undefined;
      const content = body && typeof body === "object" ? (body as any).content : undefined;
      // Validate content
      if (!content) {
        return new Response(
          JSON.stringify({ error: "Missing required field: content" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      // Determine identifier: prefer authenticated user, otherwise use actorParam
      const authReq = request as unknown as AuthenticatedRequest;
      let identifier: string | undefined;
      if (authReq.user) {
        const userMappingDoc = await firestore
          .collection("users")
          .doc(authReq.user.uid)
          .get();
        if (!userMappingDoc.exists) {
          return new Response(
            JSON.stringify({ error: "User mapping not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }
        const userMapping = userMappingDoc.data();
        if (!userMapping || !userMapping.username) {
          return new Response(
            JSON.stringify({ error: "Invalid user mapping" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        identifier = userMapping.username as string;
      } else {
        if (!actorParam) {
          return new Response(
            JSON.stringify({ error: "Missing required field: actor" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        if (typeof actorParam === "string" && (actorParam.startsWith("http://") || actorParam.startsWith("https://"))) {
          try {
            const actorUrl = new URL(actorParam);
            const parts = actorUrl.pathname.split("/");
            const usersIndex = parts.indexOf("users");
            identifier = usersIndex !== -1 && parts[usersIndex + 1] ? parts[usersIndex + 1] : undefined;
          } catch {
            identifier = undefined;
          }
        } else {
          identifier = actorParam as any;
        }
      }
      if (!identifier) {
        return new Response(
          JSON.stringify({ error: "Invalid actor identifier" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      // Check actor exists
      const actorExists = await ActorModel.exists(identifier);
      if (!actorExists) {
        return new Response(
          JSON.stringify({ error: "Actor not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      // Ensure parent post exists
      const postItem = await db.getItem(`POST#${parentPostId}`, "OBJECT");
      if (!postItem) {
        return new Response(
          JSON.stringify({ error: "Post not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      const actorUri = `${config.federation.protocol}://${config.federation.domain}/users/${identifier}`;
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
      // Additional data includes content and inReplyTo
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
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error creating comment:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  /**
   * Generate a feed for a user. Returns a list of Create activities (posts and comments)
   * from the user and actors they follow, ordered by published date descending.
   */
  static async handleUserFeed(request: Request): Promise<Response> {
    try {
      const urlObj = new URL(request.url);
      const actorParam = urlObj.searchParams.get("actor") || "";
      if (!actorParam) {
        return new Response(
          JSON.stringify({ error: "Missing required query parameter: actor" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      // Resolve actor identifier
      let identifier: string;
      if (actorParam.startsWith("http://") || actorParam.startsWith("https://")) {
        try {
          const uri = new URL(actorParam);
          const parts = uri.pathname.split("/");
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
          { status: 400, headers: { "Content-Type": "application/json" } }
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
      // Get URIs of actors this user follows
      const followingUris = await activityPub.getFollowing(identifier);
      const selfUri = `${config.federation.protocol}://${config.federation.domain}/users/${identifier}`;
      const actorUris = [selfUri, ...followingUris];
      const items: any[] = [];
      // Helper to extract identifier from URI
      const extractIdentifier = (uri: string): string | null => {
        try {
          const u = new URL(uri);
          const parts = u.pathname.split("/");
          const usersIndex = parts.indexOf("users");
          if (usersIndex !== -1 && parts[usersIndex + 1]) {
            return parts[usersIndex + 1];
          }
          return null;
        } catch {
          return null;
        }
      };
      // Fetch Create activities from each actor
      for (const uri of actorUris) {
        const id = uri.startsWith("http://") || uri.startsWith("https://") ? extractIdentifier(uri) : uri;
        if (!id) continue;
        const activities = (await activityPub.getActorActivities(id)) as any[];
        for (const act of activities) {
          const activity: any = act as any;
          if (activity.type === "Create") {
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
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error generating feed:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  /**
   * Follow or unfollow another actor. Expects JSON body with actor and target fields.
   * When the request method is POST, a new follower relationship is created and a Follow
   * activity is recorded. When DELETE, the follower relationship is removed and an Undo activity
   * is recorded.
   */
  static async handleFollowUnfollow(request: Request): Promise<Response> {
    try {
      const body = await request.json().catch(() => null);
      const actorParam = body && typeof body === "object" ? (body as any).actor : undefined;
      const targetParam = body && typeof body === "object" ? (body as any).target : undefined;

      // Determine follower identifier: prefer authenticated user
      const authReq = request as unknown as AuthenticatedRequest;
      let followerId: string | undefined;
      if (authReq.user) {
        const userMappingDoc = await firestore
          .collection("users")
          .doc(authReq.user.uid)
          .get();
        if (!userMappingDoc.exists) {
          return new Response(
            JSON.stringify({ error: "User mapping not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }
        const userMapping = userMappingDoc.data();
        if (!userMapping || !userMapping.username) {
          return new Response(
            JSON.stringify({ error: "Invalid user mapping" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        followerId = userMapping.username as string;
      } else {
        // Federated request: actorParam must be provided
        if (!actorParam) {
          return new Response(
            JSON.stringify({ error: "Missing required field: actor" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        if (typeof actorParam === "string" && (actorParam.startsWith("http://") || actorParam.startsWith("https://"))) {
          try {
            const u = new URL(actorParam);
            const parts = u.pathname.split("/");
            const idx = parts.indexOf("users");
            followerId = idx !== -1 && parts[idx + 1] ? parts[idx + 1] : undefined;
          } catch {
            followerId = undefined;
          }
        } else {
          followerId = actorParam as any;
        }
      }
      const target = targetParam;
      if (!followerId || !target) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: actor and target" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      // Resolve target identifier and target URI. If target is a full URI, use it; otherwise construct local URI.
      let targetId: string | undefined;
      let targetUri: string;
      if (typeof target === "string" && (target.startsWith("http://") || target.startsWith("https://"))) {
        targetUri = target;
        try {
          const tu = new URL(target);
          const parts = tu.pathname.split("/");
          const idx = parts.indexOf("users");
          targetId = idx !== -1 && parts[idx + 1] ? parts[idx + 1] : undefined;
        } catch {
          targetId = undefined;
        }
      } else {
        targetId = target as any;
        targetUri = `${config.federation.protocol}://${config.federation.domain}/users/${target}`;
      }
      if (!followerId) {
        return new Response(
          JSON.stringify({ error: "Invalid actor identifier" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      // Verify follower exists
      const followerExists = await ActorModel.exists(followerId);
      if (!followerExists) {
        return new Response(
          JSON.stringify({ error: "Actor not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      if (targetId && followerId === targetId) {
        return new Response(
          JSON.stringify({ error: "Cannot follow yourself" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      // If target is local, ensure it exists
      try {
        const targetHost = new URL(targetUri).hostname;
        const localHost = config.federation.domain.split(":" )[0];
        if (targetHost === localHost && targetId) {
          const targetExists = await ActorModel.exists(targetId);
          if (!targetExists) {
            return new Response(
              JSON.stringify({ error: "Target actor not found" }),
              { status: 404, headers: { "Content-Type": "application/json" } }
            );
          }
        }
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid target URI" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      const followerUri = `${config.federation.protocol}://${config.federation.domain}/users/${followerId}`;
      const followId = randomUUID();
      const activityId = `${followerUri}/activities/${followId}`;
      if (request.method === "POST") {
        await activityPub.saveFollower(activityId, followerUri, targetUri);
        await activityPub.saveActivity(activityId, "Follow", followerUri, targetUri);
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
        await activityPub.saveActivity(activityId, "Undo", followerUri, targetUri);
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
}
