import { auth } from '../config/firebase.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { config } from '../config/index.js';
import { ActorModel } from '../models/Actor.js';
import { db } from '../services/database.js';
import { getFirestore } from 'firebase-admin/firestore';
import { crypto } from '../services/cryptography.js';

// Additional imports to support post, like, comment, feed and follow operations
import { randomUUID } from 'crypto';
import { S3Service } from '../services/s3Service.js';
import { activityPub } from '../services/activitypub.js';

const firestore = getFirestore();

export class AuthHandlers {
    // Verify Firebase token and get user data
    static async handleVerifyToken(request: Request): Promise<Response> {
        try {
            const body = await request.json();
            const { idToken } = body;

            if (!idToken) {
                return new Response(JSON.stringify({ error: 'Missing idToken' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const decodedToken = await auth.verifyIdToken(idToken);

            // Get user mapping from Firestore to check if user exists
            const userMappingDoc = await firestore.collection('users').doc(decodedToken.uid).get();
            console.log('User mapping document:', userMappingDoc.data());

            const user = userMappingDoc.data();

            if (!user) {
                return new Response(
                    JSON.stringify({
                        error: 'User not found',
                        needsProfile: true,
                        uid: decodedToken.uid,
                        email: decodedToken.email
                    }),
                    {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            }

            const actorPK = user.actorId || `ACTOR#${user.username}`;

            const actor = await db.getItem(actorPK, 'PROFILE');

            if (!actor?.id) {
                return new Response(
                    JSON.stringify({
                        error: 'Actor not found',
                        needsProfile: true,
                        uid: decodedToken.uid,
                        email: decodedToken.email
                    }),
                    {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            }

            console.log('Decoded token:', decodedToken);
            if (!userMappingDoc.exists) {
                return new Response(
                    JSON.stringify({
                        error: 'User not found',
                        needsProfile: true,
                        uid: decodedToken.uid,
                        email: decodedToken.email,
                        url: actor.id
                    }),
                    {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            }

            const userMapping = userMappingDoc.data();
            const username = userMapping?.username;

            if (!username) {
                return new Response(
                    JSON.stringify({
                        error: 'User mapping incomplete',
                        needsProfile: true,
                        uid: decodedToken.uid,
                        email: decodedToken.email
                    }),
                    {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            }

            // Get actor data from DynamoDB
            const actorData = await db.getItem(`ACTOR#${username}`, 'PROFILE');

            if (!actorData) {
                return new Response(
                    JSON.stringify({
                        error: 'Actor not found',
                        needsProfile: true,
                        uid: decodedToken.uid,
                        email: decodedToken.email
                    }),
                    {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    user: {
                        uid: decodedToken.uid,
                        email: decodedToken.email,
                        displayName: actorData.name,
                        username: username,
                        photoURL: actorData.icon?.url || decodedToken.picture,
                        needsProfile: false
                    }
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        } catch (error) {
            console.error('Error verifying token:', error);
            return new Response(JSON.stringify({ error: 'Invalid token' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // Complete user profile after Google sign-in
    static async handleCompleteProfile(request: AuthenticatedRequest): Promise<Response> {
        try {
            const body = await request.json();
            const { displayName, username, summary } = body;

            if (!request.user) {
                return new Response(JSON.stringify({ error: 'User not authenticated' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            if (!displayName || !username) {
                return new Response(JSON.stringify({ error: 'Missing displayName or username' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Check if username is already taken
            const usernameQuery = await db.queryItems(`ACTOR#${username}`, {
                sortKeyExpression: 'SK = :sk',
                attributeValues: { ':sk': 'PROFILE' }
            });

            if (usernameQuery.length > 0) {
                return new Response(JSON.stringify({ error: 'Username already taken' }), {
                    status: 409,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Store user mapping in Firestore for quick lookups
            const userMapping = {
                username,
                actorId: `ACTOR#${username}`,
                firebaseUserId: request.user.uid,
                email: request.user.email,
                createdAt: new Date().toISOString()
            };

            await firestore.collection('users').doc(request.user.uid).set(userMapping);

            // Generate PEM public key for ActivityPub
            const publicKeyPem = await crypto.generatePemPublicKey(username);

            // Generate private key JWK for database storage
            const privateKeyJwk = await crypto.generatePrivateKeyJwk(username);

            // Create ActivityPub actor
            const actorData = {
                id: `${config.federation.protocol}://${config.federation.domain}/users/${username}`,
                type: 'Person',
                preferredUsername: username,
                name: displayName,
                summary: summary || '',
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
                    publicKeyPem: publicKeyPem
                },
                // Add email and icon from Google account
                email: request.user.email,
                username: username,
                icon: request.user.photoURL
                    ? {
                          type: 'Image',
                          url: request.user.photoURL
                      }
                    : undefined,
                // Add private key JWK for database storage
                privateKeyJwk: privateKeyJwk
            };

            await ActorModel.createActor(actorData);

            return new Response(
                JSON.stringify({
                    success: true,
                    user: {
                        uid: request.user.uid,
                        email: request.user.email,
                        displayName: displayName,
                        username: username,
                        photoURL: request.user.photoURL,
                        bio: summary || '',
                        needsProfile: false
                    },
                    actor: actorData
                }),
                {
                    status: 201,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        } catch (error) {
            console.error('Error completing profile:', error);
            return new Response(JSON.stringify({ error: 'Internal server error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // Get current user profile
    static async handleGetProfile(request: AuthenticatedRequest): Promise<Response> {
        try {
            if (!request.user) {
                return new Response(JSON.stringify({ error: 'User not authenticated' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const userData = await db.getItem(`USER#${request.user.uid}`, 'PROFILE');

            if (!userData) {
                return new Response(JSON.stringify({ error: 'User not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
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
                        needsProfile: false
                    }
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        } catch (error) {
            console.error('Error getting profile:', error);
            return new Response(JSON.stringify({ error: 'Internal server error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // Update user profile
    static async handleUpdateProfile(request: AuthenticatedRequest): Promise<Response> {
        try {
            if (!request.user) {
                return new Response(JSON.stringify({ error: 'User not authenticated' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const body = await request.json();
            const { displayName, photoURL, bio } = body;

            const updateData: any = {
                updated_at: new Date().toISOString()
            };

            if (displayName) updateData.display_name = displayName;
            if (photoURL) updateData.profile_image_url = photoURL;
            if (bio !== undefined) updateData.bio = bio;

            const updateItem = {
                PK: `USER#${request.user.uid}`,
                SK: 'PROFILE',
                ...updateData
            };
            await db.putItem(updateItem);

            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'Profile updated successfully'
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        } catch (error) {
            console.error('Error updating profile:', error);
            return new Response(JSON.stringify({ error: 'Internal server error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // Check username availability
    static async handleCheckUsername(request: Request): Promise<Response> {
        try {
            const { searchParams } = new URL(request.url);
            const username = searchParams.get('username');

            if (!username) {
                return new Response(JSON.stringify({ error: 'Username parameter required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const usernameQuery = await db.queryItems(`ACTOR#${username}`, {
                sortKeyExpression: 'SK = :sk',
                attributeValues: { ':sk': 'PROFILE' }
            });

            const isAvailable = usernameQuery.length === 0;

            return new Response(
                JSON.stringify({
                    success: true,
                    username,
                    isAvailable
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        } catch (error) {
            console.error('Error checking username:', error);
            return new Response(JSON.stringify({ error: 'Internal server error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // Get user posts
    static async handleGetUserPosts(request: AuthenticatedRequest): Promise<Response> {
        try {
            if (!request.user) {
                return new Response(JSON.stringify({ error: 'User not authenticated' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Get user mapping from Firestore to get username
            const userMappingDoc = await firestore.collection('users').doc(request.user.uid).get();

            if (!userMappingDoc.exists) {
                return new Response(JSON.stringify({ error: 'User mapping not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const userMapping = userMappingDoc.data();

            if (!userMapping?.username) {
                return new Response(JSON.stringify({ error: 'Invalid user mapping' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const userId = `USER#${request.user.uid}`;

            const posts = await db.queryItemsByGSI1(userId, {
                sortKeyExpression: 'begins_with(GSI1SK, :sk)',
                attributeValues: { ':sk': 'POST#' }
            });

            return new Response(
                JSON.stringify({
                    success: true,
                    posts: posts.map(post => ({
                        id: post.post_id || post.PK?.replace('POST#', ''),
                        content: post.content,
                        createdAt: post.created_at,
                        likesCount: post.likes_count || 0,
                        authorUsername: post.author_username || userMapping.username,
                        authorId: post.author_id
                    }))
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        } catch (error) {
            console.error('Error getting user posts:', error);
            return new Response(JSON.stringify({ error: 'Internal server error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // Get user followers
    static async handleGetFollowers(request: AuthenticatedRequest): Promise<Response> {
        try {
            if (!request.user) {
                return new Response(JSON.stringify({ error: 'User not authenticated' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Get user mapping from Firestore to get username
            const userMappingDoc = await firestore.collection('users').doc(request.user.uid).get();

            if (!userMappingDoc.exists) {
                return new Response(JSON.stringify({ error: 'User mapping not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const userMapping = userMappingDoc.data();

            if (!userMapping?.username) {
                return new Response(JSON.stringify({ error: 'Invalid user mapping' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Get followers from DynamoDB
            const followers = await db.queryItems(`FOLLOWER#${userMapping.username}`, {
                sortKeyExpression: 'begins_with(SK, :sk)',
                attributeValues: { ':sk': 'ACTOR#' }
            });

            return new Response(
                JSON.stringify({
                    success: true,
                    followers: followers.map((follower: any) => ({
                        username: follower.SK?.replace('ACTOR#', '') || '',
                        displayName: follower.follower_display_name,
                        createdAt: follower.created_at,
                        url: follower.follower_id
                    }))
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        } catch (error) {
            console.error('Error getting followers:', error);
            return new Response(JSON.stringify({ error: 'Internal server error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // Get user following
    static async handleGetFollowing(request: AuthenticatedRequest): Promise<Response> {
        try {
            if (!request.user) {
                return new Response(JSON.stringify({ error: 'User not authenticated' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Get user mapping from Firestore to get username
            const userMappingDoc = await firestore.collection('users').doc(request.user.uid).get();

            if (!userMappingDoc.exists) {
                return new Response(JSON.stringify({ error: 'User mapping not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const userMapping = userMappingDoc.data();

            if (!userMapping?.username) {
                return new Response(JSON.stringify({ error: 'Invalid user mapping' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const followingItems = await db.queryItemsByGSI2(`ACTOR#${userMapping.username}`, {
                sortKeyExpression: 'GSI2SK = :sk',
                attributeValues: { ':sk': 'FOLLOWING' }
            });

            const following = await Promise.all(
                followingItems.map(async (item: any) => {
                    const followUri: string | undefined = item.following_id;
                    let username = '';
                    let displayName: string | undefined = undefined;

                    if (followUri) {
                        try {
                            const url = new URL(followUri);

                            const parts = url.pathname.split('/');
                            const usersIndex = parts.indexOf('users');
                            if (usersIndex !== -1 && parts[usersIndex + 1]) {
                                username = parts[usersIndex + 1];
                            }

                            const localHost = config.federation.domain.split(':')[0];
                            if (url.hostname === localHost && username) {
                                try {
                                    const actor = await ActorModel.getActor(username);
                                    displayName = actor?.name;
                                } catch {
                                    // Ignore resolution errors; leave displayName undefined
                                }
                            }
                        } catch {
                            username = '';
                        }
                    }

                    return {
                        username,
                        displayName,
                        createdAt: item.created_at,
                        url: followUri
                    };
                })
            );

            return new Response(
                JSON.stringify({
                    success: true,
                    following
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        } catch (error) {
            console.error('Error getting following:', error);
            return new Response(JSON.stringify({ error: 'Internal server error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // Get user by ID
    static async handleGetUserById(request: Request): Promise<Response> {
        try {
            const { searchParams } = new URL(request.url);
            const userId = searchParams.get('userId');

            if (!userId) {
                return new Response(JSON.stringify({ error: 'User ID parameter required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Get user from DynamoDB
            const userData = await db.getItem(`ACTOR#${userId}`, 'PROFILE');

            if (!userData) {
                return new Response(JSON.stringify({ error: 'User not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    user: {
                        uid: userData.uid,
                        email: userData.email,
                        url: userData.id,
                        displayName: userData.display_name,
                        username: userData.username,
                        photoURL: userData.profile_image_url,
                        bio: userData.bio,
                        followersCount: userData.followers_count,
                        followingCount: userData.following_count,
                        postsCount: userData.posts_count
                    }
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        } catch (error) {
            console.error('Error getting user by ID:', error);
            return new Response(JSON.stringify({ error: 'Internal server error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // Get logged in user (full profile from DynamoDB)
    static async handleGetLoggedInUser(request: AuthenticatedRequest): Promise<Response> {
        try {
            if (!request.user) {
                return new Response(JSON.stringify({ error: 'User not authenticated' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Get user mapping from Firestore to get username
            const userMappingDoc = await firestore.collection('users').doc(request.user.uid).get();

            if (!userMappingDoc.exists) {
                return new Response(JSON.stringify({ error: 'User mapping not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const userMapping = userMappingDoc.data();

            if (!userMapping?.username) {
                return new Response(JSON.stringify({ error: 'Invalid user mapping' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Get full user profile from DynamoDB
            const userData = await db.getItem(`ACTOR#${request.user.uid}`, 'PROFILE');

            if (!userData) {
                return new Response(JSON.stringify({ error: 'User profile not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    user: {
                        uid: userData.uid,
                        email: userData.email,
                        displayName: userData.display_name,
                        url:  userData.id,
                        username: userData.username,
                        photoURL: userData.profile_image_url,
                        bio: userData.bio,
                        followersCount: userData.followers_count,
                        followingCount: userData.following_count,
                        postsCount: userData.posts_count,
                        actorId: userMapping.actorId
                    }
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        } catch (error) {
            console.error('Error getting logged in user:', error);
            return new Response(JSON.stringify({ error: 'Internal server error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    /**
     * Create a new post. Supports both JSON and multipart/form-data requests.
     * Accepts actor and content fields and optionally a media file. If media is provided
     * it is uploaded to S3 and stored in the post object and activity.
     */
    static async handleCreatePost(request: AuthenticatedRequest): Promise<Response> {
        try {
            const contentType = request.headers.get('content-type') || '';
            let actor: string;
            let content: string;
            let mediaUrl: string | undefined;
            let mediaType: string | undefined;
            // Handle multipart form-data for media uploads
            if (contentType.startsWith('multipart/form-data')) {
                const form = await request.formData();
                actor = form.get('actor')?.toString() || '';
                content = form.get('content')?.toString() || '';
                const file = form.get('media') as File | null;
                if (file) {
                    // Each upload uses a unique post ID for the storage path
                    const postId = randomUUID();
                    const key = `posts/${actor}/${postId}/${file.name}`;
                    const arrayBuffer = await file.arrayBuffer();
                    const s3 = new S3Service();
                    mediaUrl = await s3.uploadMedia(key, new Uint8Array(arrayBuffer) as any, file.type);
                    mediaType = file.type;
                }
            } else {
                // Expect JSON body for non-file uploads
                const json = await request.json();
                actor = json.actor;
                content = json.content;
            }
            // Validate required fields
            if (!actor || !content) {
                return new Response(JSON.stringify({ error: 'Missing required fields: actor and content' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            // Resolve actor identifier. Accept both full ActivityPub URI and bare identifier.
            let identifier: string;
            if (actor.startsWith('http://') || actor.startsWith('https://')) {
                try {
                    const actorUrl = new URL(actor);
                    const parts = actorUrl.pathname.split('/');
                    const usersIndex = parts.indexOf('users');
                    identifier = usersIndex !== -1 && parts[usersIndex + 1] ? parts[usersIndex + 1] : '';
                } catch {
                    identifier = '';
                }
            } else {
                identifier = actor;
            }
            if (!identifier) {
                return new Response(JSON.stringify({ error: 'Invalid actor identifier' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            // Ensure the actor exists
            const exists = await ActorModel.exists(identifier);
            if (!exists) {
                return new Response(JSON.stringify({ error: 'Actor not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            // Build ActivityPub URIs
            const actorUri = `${config.federation.protocol}://${config.federation.domain}/users/${identifier}`;
            const postId = randomUUID();
            const objectId = `${config.federation.protocol}://${config.federation.domain}/users/${identifier}/posts/${postId}`;
            const activityId = `${actorUri}/activities/${postId}`;

            const timestamp = new Date().toISOString();

            // Persist ActivityPub post object (for federation)
            const activityPubItem: Record<string, any> = {
                PK: `POST#${postId}`,
                SK: 'OBJECT',
                id: objectId,
                actor: actorUri,
                content,
                created_at: timestamp
            };
            if (mediaUrl) {
                activityPubItem.media_url = mediaUrl;
            }
            await db.putItem(activityPubItem);

            // ALSO persist social media post entry (for user queries)
            // This follows the schema: GSI1PK = USER#userId, GSI1SK = POST#timestamp#postId
            const socialMediaPost: Record<string, any> = {
                PK: `POST#${postId}`,
                SK: 'METADATA',
                GSI1PK: `USER#${request.user?.uid}`, // Use Firebase UID as user ID
                GSI1SK: `POST#${timestamp}#${postId}`,
                GSI2PK: `TIMELINE#${timestamp.split('T')[0]}`, // Date for timeline queries
                GSI2SK: `${timestamp}#${postId}`,
                post_id: postId,
                author_id: request.user?.uid,
                author_username: identifier,
                content,
                content_type: mediaType ? 'image' : 'text',
                created_at: timestamp,
                updated_at: timestamp,
                likes_count: 0,
                comments_count: 0,
                shares_count: 0,
                engagement_score: 0,
                visibility: 'public',
                is_deleted: false,
                hashtags: [],
                mentions: []
            };
            if (mediaUrl) {
                socialMediaPost.media_urls = [mediaUrl];
            }
            await db.putItem(socialMediaPost);

            // Prepare additional data for the activity
            const extra: any = { content };
            if (mediaUrl) {
                extra.attachment = [
                    {
                        type: 'Document',
                        mediaType: mediaType,
                        url: mediaUrl
                    }
                ];
            }
            await activityPub.saveActivity(activityId, 'Create', actorUri, objectId, extra);

            return new Response(
                JSON.stringify({
                    success: true,
                    activityId,
                    objectId,
                    actor: actorUri,
                    content,
                    postId
                }),
                { status: 201, headers: { 'Content-Type': 'application/json' } }
            );
        } catch (error) {
            console.error('Error creating post:', error);
            return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    /**
     * Handle liking a post. Expects JSON body with actor field. Returns a Like activity.
     */
    static async handleLikePost(request: Request, postId: string): Promise<Response> {
        try {
            const postUri = `${config.federation.protocol}://${config.federation.domain}/posts/${postId}`;
            // Parse request body
            const body = await request.json().catch(() => null);
            const actor = body && typeof body === 'object' ? (body as any).actor : undefined;
            if (!actor) {
                return new Response(JSON.stringify({ error: 'Missing required field: actor' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            // Resolve actor identifier
            let identifier: string;
            if (actor.startsWith('http://') || actor.startsWith('https://')) {
                try {
                    const actorUrl = new URL(actor);
                    const parts = actorUrl.pathname.split('/');
                    const usersIndex = parts.indexOf('users');
                    identifier = usersIndex !== -1 && parts[usersIndex + 1] ? parts[usersIndex + 1] : '';
                } catch {
                    identifier = '';
                }
            } else {
                identifier = actor;
            }
            if (!identifier) {
                return new Response(JSON.stringify({ error: 'Invalid actor identifier' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            // Verify actor exists
            const exists = await ActorModel.exists(identifier);
            if (!exists) {
                return new Response(JSON.stringify({ error: 'Actor not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            // Ensure the target post exists
            const postItem = await db.getItem(`POST#${postId}`, 'OBJECT');
            if (!postItem) {
                return new Response(JSON.stringify({ error: 'Post not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            const actorUri = `${config.federation.protocol}://${config.federation.domain}/users/${identifier}`;
            const likeId = randomUUID();
            const activityId = `${actorUri}/activities/${likeId}`;
            await activityPub.saveActivity(activityId, 'Like', actorUri, postUri);
            return new Response(
                JSON.stringify({
                    success: true,
                    activityId,
                    actor: actorUri,
                    object: postUri
                }),
                { status: 201, headers: { 'Content-Type': 'application/json' } }
            );
        } catch (error) {
            console.error('Error processing Like activity:', error);
            return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    /**
     * Handle unliking a post. Expects JSON body with actor field. Returns an Undo activity.
     */
    static async handleUnlikePost(request: Request, postId: string): Promise<Response> {
        try {
            const postUri = `${config.federation.protocol}://${config.federation.domain}/posts/${postId}`;
            const body = await request.json().catch(() => null);
            const actor = body && typeof body === 'object' ? (body as any).actor : undefined;
            if (!actor) {
                return new Response(JSON.stringify({ error: 'Missing required field: actor' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            // Resolve actor identifier
            let identifier: string;
            if (actor.startsWith('http://') || actor.startsWith('https://')) {
                try {
                    const actorUrl = new URL(actor);
                    const parts = actorUrl.pathname.split('/');
                    const usersIndex = parts.indexOf('users');
                    identifier = usersIndex !== -1 && parts[usersIndex + 1] ? parts[usersIndex + 1] : '';
                } catch {
                    identifier = '';
                }
            } else {
                identifier = actor;
            }
            if (!identifier) {
                return new Response(JSON.stringify({ error: 'Invalid actor identifier' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            const exists = await ActorModel.exists(identifier);
            if (!exists) {
                return new Response(JSON.stringify({ error: 'Actor not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            const postItem = await db.getItem(`POST#${postId}`, 'OBJECT');
            if (!postItem) {
                return new Response(JSON.stringify({ error: 'Post not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            const actorUri = `${config.federation.protocol}://${config.federation.domain}/users/${identifier}`;
            const undoId = randomUUID();
            const activityId = `${actorUri}/activities/${undoId}`;
            await activityPub.saveActivity(activityId, 'Undo', actorUri, postUri);
            return new Response(
                JSON.stringify({
                    success: true,
                    activityId,
                    actor: actorUri,
                    object: postUri
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        } catch (error) {
            console.error('Error processing Undo Like activity:', error);
            return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
            const actorParam = body && typeof body === 'object' ? (body as any).actor : undefined;
            const content = body && typeof body === 'object' ? (body as any).content : undefined;
            if (!actorParam || !content) {
                return new Response(JSON.stringify({ error: 'Missing required fields: actor and content' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            // Resolve actor identifier
            let identifier: string;
            if (actorParam.startsWith('http://') || actorParam.startsWith('https://')) {
                try {
                    const actorUrl = new URL(actorParam);
                    const parts = actorUrl.pathname.split('/');
                    const usersIndex = parts.indexOf('users');
                    identifier = usersIndex !== -1 && parts[usersIndex + 1] ? parts[usersIndex + 1] : '';
                } catch {
                    identifier = '';
                }
            } else {
                identifier = actorParam;
            }
            if (!identifier) {
                return new Response(JSON.stringify({ error: 'Invalid actor identifier' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            // Check actor exists
            const actorExists = await ActorModel.exists(identifier);
            if (!actorExists) {
                return new Response(JSON.stringify({ error: 'Actor not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            // Ensure parent post exists
            const postItem = await db.getItem(`POST#${parentPostId}`, 'OBJECT');
            if (!postItem) {
                return new Response(JSON.stringify({ error: 'Post not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            const actorUri = `${config.federation.protocol}://${config.federation.domain}/users/${identifier}`;
            const commentId = randomUUID();
            const commentObjectId = `${config.federation.protocol}://${config.federation.domain}/comments/${commentId}`;
            const activityId = `${actorUri}/activities/${commentId}`;
            // Save comment object in database
            const commentItem: Record<string, any> = {
                PK: `COMMENT#${commentId}`,
                SK: 'OBJECT',
                id: commentObjectId,
                actor: actorUri,
                content,
                inReplyTo: parentPostUri,
                created_at: new Date().toISOString()
            };
            await db.putItem(commentItem);
            // Additional data includes content and inReplyTo
            const additionalData: Record<string, any> = { content, inReplyTo: parentPostUri };
            await activityPub.saveActivity(activityId, 'Create', actorUri, commentObjectId, additionalData);
            return new Response(
                JSON.stringify({
                    success: true,
                    activityId,
                    objectId: commentObjectId,
                    actor: actorUri,
                    content,
                    inReplyTo: parentPostUri
                }),
                { status: 201, headers: { 'Content-Type': 'application/json' } }
            );
        } catch (error) {
            console.error('Error creating comment:', error);
            return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    /**
     * Generate a feed for a user. Returns a list of Create activities (posts and comments)
     * from the user and actors they follow, ordered by published date descending.
     */
    static async handleUserFeed(request: Request): Promise<Response> {
        try {
            const urlObj = new URL(request.url);
            const actorParam = urlObj.searchParams.get('actor') || '';
            if (!actorParam) {
                return new Response(JSON.stringify({ error: 'Missing required query parameter: actor' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            // Resolve actor identifier
            let identifier: string;
            if (actorParam.startsWith('http://') || actorParam.startsWith('https://')) {
                try {
                    const uri = new URL(actorParam);
                    const parts = uri.pathname.split('/');
                    const usersIndex = parts.indexOf('users');
                    identifier = usersIndex !== -1 && parts[usersIndex + 1] ? parts[usersIndex + 1] : '';
                } catch {
                    identifier = '';
                }
            } else {
                identifier = actorParam;
            }
            if (!identifier) {
                return new Response(JSON.stringify({ error: 'Invalid actor identifier' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            // Verify actor exists
            const exists = await ActorModel.exists(identifier);
            if (!exists) {
                return new Response(JSON.stringify({ error: 'Actor not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
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
                    const parts = u.pathname.split('/');
                    const usersIndex = parts.indexOf('users');
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
                const uriStr = String(uri);
                const id = uriStr.startsWith('http://') || uriStr.startsWith('https://') ? extractIdentifier(uriStr) : uriStr;
                if (!id) continue;

                // Get full actor object
                const actor = await ActorModel.getActor(id);
                const activities = (await activityPub.getActorActivities(id)) as any[];

                for (const act of activities) {
                    const activity: any = act as any;
                    if (activity.type === 'Create') {
                        const entry: any = {
                            actor: actor, // Full actor object
                            object: activity.object, // Full post object
                            published: activity.published
                        };
                        if (activity.additionalData && typeof activity.additionalData === 'object') {
                            if ('content' in activity.additionalData) {
                                entry.content = (activity.additionalData as any).content;
                            }
                            if ('attachment' in activity.additionalData) {
                                entry.attachment = (activity.additionalData as any).attachment;
                            }
                            if ('inReplyTo' in activity.additionalData) {
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
            return new Response(JSON.stringify({ items }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (error) {
            console.error('Error generating feed:', error);
            return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
            const actor = body && typeof body === 'object' ? (body as any).actor : undefined;
            const target = body && typeof body === 'object' ? (body as any).target : undefined;
            if (!actor || !target) {
                return new Response(JSON.stringify({ error: 'Missing required fields: actor and target' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            // Resolve follower identifier
            let followerId: string;
            if (actor.startsWith('http://') || actor.startsWith('https://')) {
                try {
                    const u = new URL(actor);
                    const parts = u.pathname.split('/');
                    const idx = parts.indexOf('users');
                    followerId = idx !== -1 && parts[idx + 1] ? parts[idx + 1] : '';
                } catch {
                    followerId = '';
                }
            } else {
                followerId = actor;
            }
            // Resolve target identifier and target URI. If target is a full URI, use it; otherwise construct local URI.
            let targetId: string;
            let targetUri: string;
            if (target.startsWith('http://') || target.startsWith('https://')) {
                targetUri = target;
                try {
                    const tu = new URL(target);
                    const parts = tu.pathname.split('/');
                    const idx = parts.indexOf('users');
                    targetId = idx !== -1 && parts[idx + 1] ? parts[idx + 1] : '';
                } catch {
                    targetId = '';
                }
            } else {
                targetId = target;
                targetUri = `${config.federation.protocol}://${config.federation.domain}/users/${target}`;
            }
            if (!followerId) {
                return new Response(JSON.stringify({ error: 'Invalid actor identifier' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            // Verify follower exists
            const followerExists = await ActorModel.exists(followerId);
            if (!followerExists) {
                return new Response(JSON.stringify({ error: 'Actor not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            if (targetId && followerId === targetId) {
                return new Response(JSON.stringify({ error: 'Cannot follow yourself' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            // If target is local, ensure it exists
            try {
                const targetHost = new URL(targetUri).hostname;
                const localHost = config.federation.domain.split(':')[0];
                if (targetHost === localHost) {
                    const targetExists = await ActorModel.exists(targetId);
                    if (!targetExists) {
                        return new Response(JSON.stringify({ error: 'Target actor not found' }), {
                            status: 404,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                }
            } catch {
                return new Response(JSON.stringify({ error: 'Invalid target URI' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            }
            const followerUri = `${config.federation.protocol}://${config.federation.domain}/users/${followerId}`;
            const followId = randomUUID();
            const activityId = `${followerUri}/activities/${followId}`;
            if (request.method === 'POST') {
                await activityPub.saveFollower(activityId, followerUri, targetUri);
                await activityPub.saveActivity(activityId, 'Follow', followerUri, targetUri);
                return new Response(
                    JSON.stringify({
                        success: true,
                        activityId,
                        follower: followerUri,
                        target: targetUri
                    }),
                    { status: 201, headers: { 'Content-Type': 'application/json' } }
                );
            } else {
                // DELETE - unfollow
                await activityPub.removeFollower(followerUri, targetUri);
                await activityPub.saveActivity(activityId, 'Undo', followerUri, targetUri);
                return new Response(
                    JSON.stringify({
                        success: true,
                        activityId,
                        follower: followerUri,
                        target: targetUri
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                );
            }
        } catch (error) {
            console.error('Error processing follow/unfollow:', error);
            return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }
}
