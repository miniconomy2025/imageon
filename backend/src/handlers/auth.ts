import { auth } from "../config/firebase.js";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth.js";
import { config } from "../config/index.js";
import { ActorModel } from "../models/Actor.js";
import { db } from "../services/database.js";
import { getFirestore } from "firebase-admin/firestore";

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

      // Get user mapping from Firestore to get username
      const userMappingDoc = await firestore
        .collection("users")
        .doc(decodedToken.uid)
        .get();

      if (!userMappingDoc.exists) {
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

      const userMapping = userMappingDoc.data();

      if (!userMapping?.username) {
        return new Response(
          JSON.stringify({
            error: "Invalid user mapping",
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

      // Check if user exists in DynamoDB using ACTOR#username pattern
      const userData = await db.getItem(
        `ACTOR#${userMapping.username}`,
        "PROFILE"
      );

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
        PK: `ACTOR#${username}`,
        SK: "PROFILE",
        GSI1PK: `ACTOR#${username}`,
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

      const userData = await db.getItem(
        `ACTOR#${userMapping.username}`,
        "PROFILE"
      );

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

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (displayName) updateData.display_name = displayName;
      if (photoURL) updateData.profile_image_url = photoURL;
      if (bio !== undefined) updateData.bio = bio;

      const updateItem = {
        PK: `ACTOR#${userMapping.username}`,
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

  // Get user by ID (username)
  static async handleGetUserById(request: Request): Promise<Response> {
    try {
      const { searchParams } = new URL(request.url);
      const username = searchParams.get("userId");

      if (!username) {
        return new Response(
          JSON.stringify({ error: "Username parameter required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Get user from DynamoDB using ACTOR#username pattern
      const userData = await db.getItem(`ACTOR#${username}`, "PROFILE");

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
      const userData = await db.getItem(
        `ACTOR#${userMapping.username}`,
        "PROFILE"
      );

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
}
