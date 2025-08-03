import { userService } from "./services/userService.js";
import { postService } from "./services/postService.js";
import { likeService } from "./services/likeService.js";
import { followService } from "./services/followService.js";

export async function handleApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!path.startsWith("/api/")) {
    return null;
  }

  const segments = path.substring(1).split("/").filter(Boolean);
  if (segments.length < 2) {
    return new Response(JSON.stringify({ success: false, message: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const resource = segments[1];

  const getBody = async (): Promise<any> => {
    try {
      return await request.clone().json();
    } catch {
      return {};
    }
  };

  const searchParams = url.searchParams;

  try {
    // ---------------------------------------------------------------------
    // Users: /api/users
    // ---------------------------------------------------------------------
    if (resource === "users") {
      // /api/users (GET, POST)
      if (segments.length === 2) {
        if (request.method === "GET") {
          // Pagination support
          const limitParam = searchParams.get("limit");
          const lastKeyParam = searchParams.get("lastEvaluatedKey");
          const options: any = {};
          if (limitParam) {
            const limitNumber = parseInt(limitParam, 10);
            if (!isNaN(limitNumber)) {
              options.limit = limitNumber;
            }
          }
          if (lastKeyParam) {
            try {
              options.lastEvaluatedKey = JSON.parse(lastKeyParam);
            } catch {
              // ignore invalid JSON
            }
          }
          const result = await userService.getAllUsers(options);
          return new Response(JSON.stringify({
            success: true,
            data: {
              users: result.items,
              count: result.count,
              lastEvaluatedKey: result.lastEvaluatedKey,
            },
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (request.method === "POST") {
          const body: any = await getBody();
          const { username, email, display_name, bio } = body;
          if (!username || !email || !display_name) {
            return new Response(JSON.stringify({
              success: false,
              message: "Username, email, and display_name are required",
            }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          try {
            const user = await userService.createUser({ username, email, display_name, bio });
            return new Response(JSON.stringify({
              success: true,
              message: "User created successfully",
              data: user,
            }), {
              status: 201,
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            const status = msg.includes("already exists") ? 409 : 500;
            return new Response(JSON.stringify({
              success: false,
              message: msg || "Error creating user",
            }), {
              status,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
      }
      // /api/users/username/:username
      if (segments.length === 4 && segments[2] === "username" && request.method === "GET") {
        const username = segments[3];
        const user = await userService.getUserByUsername(username);
        if (!user) {
          return new Response(JSON.stringify({
            success: false,
            message: "User not found",
          }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({
          success: true,
          data: user,
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      // /api/users/:userId (GET, PUT, DELETE)
      if (segments.length === 3) {
        const userId = segments[2];
        if (request.method === "GET") {
          const user = await userService.getUserById(userId);
          if (!user) {
            return new Response(JSON.stringify({
              success: false,
              message: "User not found",
            }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({
            success: true,
            data: user,
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (request.method === "PUT") {
          const updates = await getBody();
          if (!updates || Object.keys(updates).length === 0) {
            return new Response(JSON.stringify({
              success: false,
              message: "No updates provided",
            }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          try {
            const updatedUser = await userService.updateUser(userId, updates);
            return new Response(JSON.stringify({
              success: true,
              message: "User updated successfully",
              data: updatedUser,
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            const status = msg.includes("not found") ? 404 : 500;
            return new Response(JSON.stringify({
              success: false,
              message: msg || "Error updating user",
            }), {
              status,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
        if (request.method === "DELETE") {
          try {
            await userService.deleteUser(userId);
            return new Response(JSON.stringify({
              success: true,
              message: "User deleted successfully",
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            const status = msg.includes("not found") ? 404 : 500;
            return new Response(JSON.stringify({
              success: false,
              message: msg || "Error deleting user",
            }), {
              status,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
      }
    }
    // ---------------------------------------------------------------------
    // Posts: /api/posts
    // ---------------------------------------------------------------------
    if (resource === "posts") {
      // /api/posts (GET, POST)
      if (segments.length === 2) {
        if (request.method === "GET") {
          const limitParam = searchParams.get("limit");
          const lastKeyParam = searchParams.get("lastEvaluatedKey");
          const options: any = {};
          if (limitParam) {
            const limitNumber = parseInt(limitParam, 10);
            if (!isNaN(limitNumber)) {
              options.limit = limitNumber;
            }
          }
          if (lastKeyParam) {
            try {
              options.lastEvaluatedKey = JSON.parse(lastKeyParam);
            } catch {
              // ignore
            }
          }
          const result = await postService.getAllPosts(options);
          return new Response(JSON.stringify({
            success: true,
            data: {
              posts: result.items,
              count: result.count,
              lastEvaluatedKey: result.lastEvaluatedKey,
            },
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (request.method === "POST") {
          const body: any = await getBody();
          const { user_id, username, content, media_url, media_type, tags, location } = body;
          if (!user_id || !username || !content) {
            return new Response(JSON.stringify({
              success: false,
              message: "User ID, username, and content are required",
            }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          try {
            const post = await postService.createPost({ user_id, username, content, media_url, media_type, tags, location });
            return new Response(JSON.stringify({
              success: true,
              message: "Post created successfully",
              data: post,
            }), {
              status: 201,
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return new Response(JSON.stringify({
              success: false,
              message: msg || "Error creating post",
            }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
      }
      // /api/posts/user/:userId
      if (segments.length === 4 && segments[2] === "user" && request.method === "GET") {
        const userId = segments[3];
        const limitParam = searchParams.get("limit");
        const lastKeyParam = searchParams.get("lastEvaluatedKey");
        const options: any = {};
        if (limitParam) {
          const limitNumber = parseInt(limitParam, 10);
          if (!isNaN(limitNumber)) {
            options.limit = limitNumber;
          }
        }
        if (lastKeyParam) {
          try {
            options.lastEvaluatedKey = JSON.parse(lastKeyParam);
          } catch {
            // ignore
          }
        }
        const result = await postService.getPostsByUserId(userId, options);
        return new Response(JSON.stringify({
          success: true,
          data: {
            posts: result.items,
            count: result.count,
            lastEvaluatedKey: result.lastEvaluatedKey,
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      // /api/posts/:postId/like (POST -> like, DELETE -> unlike)
      if (segments.length === 4 && segments[3] === "like") {
        const postId = segments[2];
        if (request.method === "POST" || request.method === "DELETE") {
          const body: any = await getBody();
          const { user_id } = body;
          if (!postId) {
            return new Response(JSON.stringify({
              success: false,
              message: "Post ID is required",
            }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          if (!user_id) {
            return new Response(JSON.stringify({
              success: false,
              message: "User ID is required",
            }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          try {
            let updatedPost;
            if (request.method === "POST") {
              updatedPost = await postService.likePost(postId, user_id);
            } else {
              updatedPost = await postService.unlikePost(postId, user_id);
            }
            return new Response(JSON.stringify({
              success: true,
              message: request.method === "POST" ? "Post liked successfully" : "Post unliked successfully",
              data: updatedPost,
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            const status = msg.includes("not found") ? 404 : 500;
            return new Response(JSON.stringify({
              success: false,
              message: msg || "Error updating like status",
            }), {
              status,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
      }
      // /api/posts/:postId (GET, PUT, DELETE)
      if (segments.length === 3) {
        const postId = segments[2];
        if (request.method === "GET") {
          const post = await postService.getPostById(postId);
          if (!post) {
            return new Response(JSON.stringify({
              success: false,
              message: "Post not found",
            }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({
            success: true,
            data: post,
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (request.method === "PUT") {
          const updates = await getBody();
          if (!updates || Object.keys(updates).length === 0) {
            return new Response(JSON.stringify({
              success: false,
              message: "No updates provided",
            }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          try {
            const updatedPost = await postService.updatePost(postId, updates);
            return new Response(JSON.stringify({
              success: true,
              message: "Post updated successfully",
              data: updatedPost,
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            const status = msg.includes("not found") ? 404 : 500;
            return new Response(JSON.stringify({
              success: false,
              message: msg || "Error updating post",
            }), {
              status,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
        if (request.method === "DELETE") {
          try {
            await postService.deletePost(postId);
            return new Response(JSON.stringify({
              success: true,
              message: "Post deleted successfully",
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            const status = msg.includes("not found") ? 404 : 500;
            return new Response(JSON.stringify({
              success: false,
              message: msg || "Error deleting post",
            }), {
              status,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
      }
    }
    // ---------------------------------------------------------------------
    // Likes: /api/likes
    // ---------------------------------------------------------------------
    if (resource === "likes") {
      // /api/likes (POST)
      if (segments.length === 2 && request.method === "POST") {
        const body: any = await getBody();
        const { post_id, user_id, username } = body;
        if (!post_id || !user_id || !username) {
          return new Response(JSON.stringify({
            success: false,
            message: "Post ID, user ID, and username are required",
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const like = await likeService.createLike({ post_id, user_id, username });
          return new Response(JSON.stringify({
            success: true,
            message: "Like created successfully",
            data: like,
          }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          const status = msg.includes("already") ? 409 : 500;
          return new Response(JSON.stringify({
            success: false,
            message: msg || "Error creating like",
          }), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      // /api/likes/post/:postId/user/:userId (GET, DELETE)
      if (segments.length === 6 && segments[2] === "post" && segments[4] === "user") {
        const postId = segments[3];
        const userId = segments[5];
        if (request.method === "GET") {
          const like = await likeService.getLikeByPostAndUser(postId, userId);
          if (!like) {
            return new Response(JSON.stringify({
              success: false,
              message: "Like not found",
            }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({
            success: true,
            data: like,
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (request.method === "DELETE") {
          try {
            await likeService.deleteLike(postId, userId);
            return new Response(JSON.stringify({
              success: true,
              message: "Like deleted successfully",
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return new Response(JSON.stringify({
              success: false,
              message: msg || "Error deleting like",
            }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
      }
      // /api/likes/user/:userId/post/:postId (DELETE)
      if (segments.length === 6 && segments[2] === "user" && segments[4] === "post" && request.method === "DELETE") {
        const userId = segments[3];
        const postId = segments[5];
        try {
          await likeService.deleteLikeByUserAndPost(userId, postId);
          return new Response(JSON.stringify({
            success: true,
            message: "Like deleted successfully",
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return new Response(JSON.stringify({
            success: false,
            message: msg || "Error deleting like",
          }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      // /api/likes/post/:postId (GET)
      if (segments.length === 4 && segments[2] === "post" && request.method === "GET") {
        const postId = segments[3];
        const limitParam = searchParams.get("limit");
        const lastKeyParam = searchParams.get("lastEvaluatedKey");
        const options: any = {};
        if (limitParam) {
          const limitNumber = parseInt(limitParam, 10);
          if (!isNaN(limitNumber)) {
            options.limit = limitNumber;
          }
        }
        if (lastKeyParam) {
          try {
            options.lastEvaluatedKey = JSON.parse(lastKeyParam);
          } catch {
            // ignore
          }
        }
        const result = await likeService.getLikesByPostId(postId, options);
        return new Response(JSON.stringify({
          success: true,
          data: {
            likes: result.items,
            count: result.count,
            lastEvaluatedKey: result.lastEvaluatedKey,
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      // /api/likes/user/:userId (GET)
      if (segments.length === 4 && segments[2] === "user" && request.method === "GET") {
        const userId = segments[3];
        const limitParam = searchParams.get("limit");
        const lastKeyParam = searchParams.get("lastEvaluatedKey");
        const options: any = {};
        if (limitParam) {
          const limitNumber = parseInt(limitParam, 10);
          if (!isNaN(limitNumber)) {
            options.limit = limitNumber;
          }
        }
        if (lastKeyParam) {
          try {
            options.lastEvaluatedKey = JSON.parse(lastKeyParam);
          } catch {
            // ignore
          }
        }
        const result = await likeService.getLikesByUserId(userId, options);
        return new Response(JSON.stringify({
          success: true,
          data: {
            likes: result.items,
            count: result.count,
            lastEvaluatedKey: result.lastEvaluatedKey,
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      // /api/likes/check/:userId/:postId (GET)
      if (segments.length === 5 && segments[2] === "check" && request.method === "GET") {
        const userId = segments[3];
        const postId = segments[4];
        const isLiked = await likeService.hasUserLikedPost(userId, postId);
        return new Response(JSON.stringify({
          success: true,
          data: {
            isLiked,
            userId,
            postId,
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      // /api/likes/count/:postId (GET)
      if (segments.length === 4 && segments[2] === "count" && request.method === "GET") {
        const postId = segments[3];
        const count = await likeService.getLikeCountForPost(postId);
        return new Response(JSON.stringify({
          success: true,
          data: {
            postId,
            count,
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    // ---------------------------------------------------------------------
    // Follows: /api/follows
    // ---------------------------------------------------------------------
    if (resource === "follows") {
      // /api/follows (POST)
      if (segments.length === 2 && request.method === "POST") {
        const body: any = await getBody();
        const { follower_id, followed_id, follower_username, followed_username } = body;
        if (!follower_id || !followed_id || !follower_username || !followed_username) {
          return new Response(JSON.stringify({
            success: false,
            message: "Follower ID, followed ID, and usernames are required",
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const follow = await followService.createFollow({ follower_id, followed_id, follower_username, followed_username });
          return new Response(JSON.stringify({
            success: true,
            message: "Follow relationship created successfully",
            data: follow,
          }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          const status = msg.includes("already") ? 409 : 500;
          return new Response(JSON.stringify({
            success: false,
            message: msg || "Error creating follow relationship",
          }), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      // /api/follows/follower/:followerId/followed/:followedId (GET, DELETE)
      if (segments.length === 6 && segments[2] === "follower" && segments[4] === "followed") {
        const followerId = segments[3];
        const followedId = segments[5];
        if (request.method === "GET") {
          const follow = await followService.getFollowByFollowerAndFollowed(followerId, followedId);
          if (!follow) {
            return new Response(JSON.stringify({
              success: false,
              message: "Follow relationship not found",
            }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({
            success: true,
            data: follow,
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (request.method === "DELETE") {
          try {
            await followService.deleteFollow(followerId, followedId);
            return new Response(JSON.stringify({
              success: true,
              message: "Follow relationship deleted successfully",
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return new Response(JSON.stringify({
              success: false,
              message: msg || "Error deleting follow relationship",
            }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
      }
      // /api/follows/following/:userId
      if (segments.length === 4 && segments[2] === "following" && request.method === "GET") {
        const userId = segments[3];
        const limitParam = searchParams.get("limit");
        const lastKeyParam = searchParams.get("lastEvaluatedKey");
        const options: any = {};
        if (limitParam) {
          const limitNumber = parseInt(limitParam, 10);
          if (!isNaN(limitNumber)) {
            options.limit = limitNumber;
          }
        }
        if (lastKeyParam) {
          try {
            options.lastEvaluatedKey = JSON.parse(lastKeyParam);
          } catch {
            // ignore
          }
        }
        const result = await followService.getFollowingByUserId(userId, options);
        return new Response(JSON.stringify({
          success: true,
          data: {
            follows: result.items,
            count: result.count,
            lastEvaluatedKey: result.lastEvaluatedKey,
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      // /api/follows/followers/:userId
      if (segments.length === 4 && segments[2] === "followers" && request.method === "GET") {
        const userId = segments[3];
        const limitParam = searchParams.get("limit");
        const lastKeyParam = searchParams.get("lastEvaluatedKey");
        const options: any = {};
        if (limitParam) {
          const limitNumber = parseInt(limitParam, 10);
          if (!isNaN(limitNumber)) {
            options.limit = limitNumber;
          }
        }
        if (lastKeyParam) {
          try {
            options.lastEvaluatedKey = JSON.parse(lastKeyParam);
          } catch {
            // ignore
          }
        }
        const result = await followService.getFollowersByUserId(userId, options);
        return new Response(JSON.stringify({
          success: true,
          data: {
            follows: result.items,
            count: result.count,
            lastEvaluatedKey: result.lastEvaluatedKey,
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      // /api/follows/check/:followerId/:followedId
      if (segments.length === 5 && segments[2] === "check" && request.method === "GET") {
        const followerId = segments[3];
        const followedId = segments[4];
        const isFollowing = await followService.isUserFollowing(followerId, followedId);
        return new Response(JSON.stringify({
          success: true,
          data: {
            isFollowing,
            followerId,
            followedId,
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      // /api/follows/following/count/:userId
      if (segments.length === 5 && segments[2] === "following" && segments[3] === "count" && request.method === "GET") {
        const userId = segments[4];
        const count = await followService.getFollowingCount(userId);
        return new Response(JSON.stringify({
          success: true,
          data: {
            userId,
            count,
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      // /api/follows/followers/count/:userId
      if (segments.length === 5 && segments[2] === "followers" && segments[3] === "count" && request.method === "GET") {
        const userId = segments[4];
        const count = await followService.getFollowersCount(userId);
        return new Response(JSON.stringify({
          success: true,
          data: {
            userId,
            count,
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      // /api/follows/mutual/:userId
      if (segments.length === 4 && segments[2] === "mutual" && request.method === "GET") {
        const userId = segments[3];
        const limitParam = searchParams.get("limit");
        const options: any = {};
        if (limitParam) {
          const limitNumber = parseInt(limitParam, 10);
          if (!isNaN(limitNumber)) {
            options.limit = limitNumber;
          }
        }
        const result = await followService.getMutualFollows(userId, options);
        return new Response(JSON.stringify({
          success: true,
          data: {
            follows: result.items,
            count: result.count,
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // If no route matched under /api, return 404
    return new Response(JSON.stringify({
      success: false,
      message: "API route not found",
    }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({
      success: false,
      message: msg || "Internal server error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}