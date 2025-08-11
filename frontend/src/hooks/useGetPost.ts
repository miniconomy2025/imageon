import { useQuery } from '@tanstack/react-query';
import { Post } from '../types/post';
import { useAuth } from '../contexts/AuthContext';

export const useGetPost = (url: string, author: any) => {
    const { currentUser, userProfile } = useAuth();

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['post', url],
        queryFn: async (): Promise<Post> => {
            let response;
            let lastError;

            try {
                response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        Accept: 'application/activity+json',
                        'Content-Type': 'application/activity+json',
                        Authorization: `Bearer ${(await currentUser?.getIdTokenResult())?.token}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
                }
            } catch (error) {
                lastError = error;
                console.warn('First request failed, trying alternative URL format:', error);

                // Try alternative URL format: remove /users/username part
                try {
                    const urlObj = new URL(url);
                    const pathParts = urlObj.pathname.split('/');
                    const usersIndex = pathParts.findIndex(part => part === 'users');
                    const postsIndex = pathParts.findIndex(part => part === 'posts');

                    if (usersIndex !== -1 && postsIndex !== -1 && postsIndex > usersIndex) {
                        const alternativePathParts = [...pathParts.slice(0, usersIndex), ...pathParts.slice(postsIndex)];
                        urlObj.pathname = alternativePathParts.join('/');
                        const alternativeUrl = urlObj.toString();

                        response = await fetch(alternativeUrl, {
                            method: 'GET',
                            headers: {
                                Accept: 'application/activity+json',
                                'Content-Type': 'application/activity+json',
                                Authorization: `Bearer ${(await currentUser?.getIdTokenResult())?.token}`
                            }
                        });

                        if (!response.ok) {
                            throw new Error(`Alternative request failed: ${response.status} ${response.statusText}`);
                        }
                    } else {
                        throw lastError;
                    }
                } catch (alternativeError) {
                    console.error('Both original and alternative requests failed:', lastError, alternativeError);
                    throw lastError;
                }
            }

            const result = await response.json();

            // Handle attachments - can be single object or array
            let attachments = [];
            const ensureMediaType = (att: any) => {
                let mediaType = att.mediaType || att.type || '';
                if (!mediaType && att.type === 'Video') mediaType = 'video/mp4';
                if (!mediaType && att.type === 'Image') mediaType = 'image/png';
                return {
                    id: att.id || '',
                    type: att.type || '',
                    mediaType,
                    url: att.url || '',
                    name: att.name || ''
                };
            };
            if (result.attachment) {
                if (Array.isArray(result.attachment)) {
                    attachments = result.attachment.map(ensureMediaType);
                } else {
                    attachments = [ensureMediaType(result.attachment)];
                }
            }

            // Handle likes and userLiked
            let likeCount = 0;
            let userLiked = false;

            if (result.likes) {
                if (result.likes.totalItems !== undefined) {
                    likeCount = result.likes.totalItems;
                }

                if (result.likes.items) {
                    const likesArray = Array.isArray(result.likes.items) ? result.likes.items : [result.likes.items];

                    if (result.likes.totalItems === undefined) {
                        likeCount = likesArray.length;
                    }

                    userLiked = likesArray.some((like: any) => like.actor === userProfile?.url);
                }
            }

            const mappedPost = {
                id: result.id.split('/').pop(),
                content: result.content,
                title: result.name || result.summary,
                author: author,
                postedAt: result.published || new Date().toISOString(),
                likes: likeCount,
                likeCount: likeCount,
                userLiked: userLiked,
                comments: result.replies?.items || [],
                attachments: attachments,
                url: result.url
            } as Post;

            return mappedPost;
        },
        enabled: !!url && !!author,
        retry: 3,
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000
    });

    return {
        data,
        isFetching,
        isError,
        isSuccess
    };
};
