import { auth, db } from "../config/firebase.js";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth.js";
import { config } from "../config/index.js";
import { ActorModel } from "../models/Actor.js";

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

      // Check if user exists in Firestore
      const userDoc = await db.collection("users").doc(decodedToken.uid).get();

      if (!userDoc.exists) {
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

      const userData = userDoc.data();

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            uid: decodedToken.uid,
            email: decodedToken.email,
            displayName: userData?.displayName,
            username: userData?.username,
            photoURL: userData?.photoURL || decodedToken.picture,
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
      const { displayName, username } = body;

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
      const usernameQuery = await db
        .collection("users")
        .where("username", "==", username)
        .get();

      if (!usernameQuery.empty) {
        return new Response(
          JSON.stringify({ error: "Username already taken" }),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Create user document in Firestore
      const userData = {
        uid: request.user.uid,
        email: request.user.email,
        displayName,
        username,
        photoURL: request.user.photoURL,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.collection("users").doc(request.user.uid).set(userData);

      // Create ActivityPub actor
      const actorData = {
        id: `${config.federation.protocol}://${config.federation.domain}/users/${username}`,
        type: "Person",
        preferredUsername: username,
        name: displayName,
        summary: "",
        inbox: `${config.federation.protocol}://${config.federation.domain}/users/${username}/inbox`,
        outbox: `${config.federation.protocol}://${config.federation.domain}/users/${username}/outbox`,
        followers: `${config.federation.protocol}://${config.federation.domain}/users/${username}/followers`,
        following: `${config.federation.protocol}://${config.federation.domain}/users/${username}/following`,
        publicKey: {
          id: `${config.federation.protocol}://${config.federation.domain}/users/${username}#main-key`,
          owner: `${config.federation.protocol}://${config.federation.domain}/users/${username}`,
          publicKeyPem: "", // You'll need to generate this
        },
      };

      await ActorModel.createActor(username, actorData);

      return new Response(
        JSON.stringify({
          success: true,
          user: userData,
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

      const userDoc = await db.collection("users").doc(request.user.uid).get();

      if (!userDoc.exists) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const userData = userDoc.data();

      return new Response(
        JSON.stringify({
          success: true,
          user: userData,
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
      const { displayName, photoURL } = body;

      const updateData: any = {
        updatedAt: new Date().toISOString(),
      };

      if (displayName) updateData.displayName = displayName;
      if (photoURL) updateData.photoURL = photoURL;

      await db.collection("users").doc(request.user.uid).update(updateData);

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

      const usernameQuery = await db
        .collection("users")
        .where("username", "==", username)
        .get();

      const isAvailable = usernameQuery.empty;

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
}
