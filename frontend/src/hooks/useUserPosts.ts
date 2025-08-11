import { useQuery } from '@tanstack/react-query';
import { Post } from '../types/post';
import { config } from '../config/config';
import { useAuth } from '../contexts/AuthContext';

export const useUserPosts = (url: string) => {
    const outboxUrl = `${url}/outbox`;
    const requestUrl = `${config.API_URL}/api/outbox`;
    const { userProfile } = useAuth();

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
                    if (item.object.id && typeof item.object.id === 'string' && item.object.id.includes('/comments/')) {
                        comments.push(item);
                    } else if (item.object.inReplyTo) {
                        comments.push(item);
                    } else if (item.object.type === 'Note' && typeof item.object.id === 'string') {
                        posts.push(item);
                    }
                }
            });

            const postsMap = new Map<string, Post>();

            // Process posts first
            posts.forEach((item: any) => {
                let postId = item.object.id;

                // Extract the actual post ID from the full URL
                const urlToProcess = item.object.url || item.object.id;
                if (urlToProcess && typeof urlToProcess === 'string') {
                    const urlParts = urlToProcess.split('/');
                    const extractedId = urlParts[urlParts.length - 1];
                    if (extractedId && extractedId.includes('-')) {
                        postId = extractedId;
                    }
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

                let likeCount = 0;
                let userLiked = false;

                if (item.object.likes) {
                    if (item.object.likes.totalItems !== undefined) {
                        likeCount = item.object.likes.totalItems;
                    }

                    if (item.object.likes.items) {
                        const likesArray = Array.isArray(item.object.likes.items) ? item.object.likes.items : [item.object.likes.items];

                        if (item.object.likes.totalItems === undefined) {
                            likeCount = likesArray.length;
                        }

                        userLiked = likesArray.some((like: any) => like.actor === userProfile?.url);
                    }
                }

                const post: Post = {
                    id: postId,
                    content: item.object.content,
                    postedAt: item.object.published,
                    url: item.object.url || item.object.id,
                    attachments,
                    likes: likeCount,
                    likeCount: likeCount,
                    userLiked: userLiked,
                    comments: []
                };

                // Store post with multiple keys for lookup
                postsMap.set(item.object.id, post);
                postsMap.set(postId, post);
                if (item.object.url && item.object.url !== item.object.id) {
                    postsMap.set(item.object.url, post);
                }
            });

            // Return unique posts
            const finalPosts = Array.from(postsMap.values()).filter((post, index, array) => array.findIndex(p => p.id === post.id) === index);

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
