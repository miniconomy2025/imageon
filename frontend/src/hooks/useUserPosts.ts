import { useQuery } from '@tanstack/react-query';
import { Post } from '../types/post';
import { config } from '../config/config';

export const useUserPosts = (url: string) => {
    const outboxUrl = `${url}/outbox`;
    const requestUrl = `${config.API_URL}/api/outbox`;

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['userPosts', outboxUrl],
        queryFn: async (): Promise<Post[]> => {
            const response = await fetch(requestUrl, {
                method: 'POST',
                body: JSON.stringify({
                    outboxUrl: outboxUrl
                })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const result = await response.json();
            const items = result.orderedItems || result.items || [];

            // Separate posts and comments
            const posts: any[] = [];
            const comments: any[] = [];

            items.forEach((item: any) => {
                if (item.type === 'Create' && item.object) {
                    if (item.object.inReplyTo) {
                        // This is a comment
                        comments.push(item);
                    } else if (item.object.type === 'Note' && typeof item.object.id === 'string') {
                        // This is a post
                        posts.push(item);
                    }
                }
            });

            const postsMap = new Map<string, Post>();

            // Process posts first
            posts.forEach((item: any) => {
                let postId = item.object.id;
                if (item.object.url) {
                    const urlParts = item.object.url.split('/');
                    postId = urlParts[urlParts.length - 1];
                }

                // Handle attachments
                let attachments = undefined;
                if (item.object.attachment) {
                    if (Array.isArray(item.object.attachment)) {
                        attachments = item.object.attachment;
                    } else {
                        attachments = [item.object.attachment];
                    }
                }

                const post: Post = {
                    id: postId,
                    content: item.object.content,
                    postedAt: item.object.published,
                    url: item.object.url || item.object.id,
                    attachments,
                    likes: 0,
                    comments: []
                };

                // Store post with multiple keys for lookup
                postsMap.set(item.object.id, post);
                postsMap.set(postId, post);
                if (item.object.url && item.object.url !== item.object.id) {
                    postsMap.set(item.object.url, post);
                }

                console.log('Stored user post with keys:', [item.object.id, postId, item.object.url].filter(Boolean));
            });

            // Add comments to their parent posts
            comments.forEach((commentItem: any) => {
                console.log('Processing user comment:', {
                    commentId: commentItem.object.id,
                    inReplyTo: commentItem.object.inReplyTo,
                    availablePostKeys: Array.from(postsMap.keys())
                });

                let parentPost = postsMap.get(commentItem.object.inReplyTo);

                if (!parentPost && commentItem.object.inReplyTo) {
                    const urlParts = commentItem.object.inReplyTo.split('/');
                    const postIdFromUrl = urlParts[urlParts.length - 1];
                    parentPost = postsMap.get(postIdFromUrl);
                    console.log('Trying to find user post by ID:', postIdFromUrl, 'found:', !!parentPost);
                }

                if (parentPost) {
                    let commentId = commentItem.object.id;
                    if (commentItem.object.url) {
                        const urlParts = commentItem.object.url.split('/');
                        commentId = urlParts[urlParts.length - 1];
                    }

                    const comment = {
                        id: commentId,
                        postId: parentPost.id,
                        author: {
                            id: 0, // Default numeric ID for comments
                            username: '',
                            name: '',
                            preferredUsername: '',
                            summary: '',
                            bio: '',
                            url: '',
                            icon: undefined,
                            type: '',
                            inbox: '',
                            outbox: '',
                            followers: '',
                            following: '',
                            published: '',
                            followers_count: 0,
                            following_count: 0
                        },
                        content: commentItem.object.content,
                        createdAt: commentItem.object.published
                    };

                    if (!parentPost.comments) {
                        parentPost.comments = [];
                    }
                    parentPost.comments.push(comment);
                    console.log('Added comment to user post:', parentPost.id, 'total comments now:', parentPost.comments.length);
                } else {
                    console.log('Parent post not found for user comment:', commentItem.object.id, 'inReplyTo:', commentItem.object.inReplyTo);
                }
            });

            // Return unique posts
            const finalPosts = Array.from(postsMap.values()).filter((post, index, array) => array.findIndex(p => p.id === post.id) === index);

            console.log('useUserPosts finalPosts', finalPosts);
            return finalPosts;
        },
        enabled: !!outboxUrl,
        retry: 3,
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff: 1s, 2s, 4s, max 30s
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000 // 10 minutes
    });

    return {
        posts: data,
        isFetching,
        isError,
        isSuccess
    };
};
