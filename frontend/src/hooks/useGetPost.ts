import { useQuery } from '@tanstack/react-query';
import { Post } from '../types/post';
import { useAuth } from '../contexts/AuthContext';
import { useGetUserByUrl } from './useGetUserByUrl';

export const useGetPost = (url: string) => {
    const { currentUser } = useAuth();

    const getAuthorUrlFromPostUrl = (postUrl: string) => {
        if (!postUrl) return '';
        const postIdParts = postUrl.split('/');
        const userIndex = postIdParts.findIndex((part: string) => part === 'users');
        if (userIndex !== -1 && userIndex + 1 < postIdParts.length) {
            return postIdParts.slice(0, userIndex + 2).join('/');
        }
        return '';
    };

    console.debug('useGetPost called with URL:', url);

    const authorUrl = getAuthorUrlFromPostUrl(url);
    const { user, isFetching: isFetchingUser } = useGetUserByUrl(authorUrl);

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['post', url],
        queryFn: async (): Promise<Post> => {
            const response = await fetch(url, {
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

            const result = await response.json();

            // Handle attachments - can be single object or array
            let attachments = [];
            if (result.attachment) {
                if (Array.isArray(result.attachment)) {
                    attachments = result.attachment.map((att: any) => ({
                        id: att.id || '',
                        type: att.mediaType || att.type || 'image',
                        url: att.url || '',
                        name: att.name || ''
                    }));
                } else {
                    // Single attachment object
                    attachments = [
                        {
                            id: result.attachment.id || '',
                            type: result.attachment.mediaType || result.attachment.type || 'image',
                            url: result.attachment.url || '',
                            name: result.attachment.name || ''
                        }
                    ];
                }
            }

            const mappedPost = {
                id: result.id || '',
                content: result.content || '',
                title: result.name || result.summary || '',
                author: user,
                postedAt: result.published || new Date().toISOString(),
                likes: result.likes?.totalItems || 0,
                comments: result.replies?.items || [],
                attachments: attachments,
                url: result.url || result.id || ''
            } as Post;

            console.log('useGetPost mapped post:', mappedPost);
            return mappedPost;
        },
        enabled: !!url && !isFetchingUser,
        retry: 3,
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000 // 10 minutes
    });

    return {
        data,
        isFetching,
        isError,
        isSuccess
    };
};
