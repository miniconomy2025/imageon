import { useQuery } from '@tanstack/react-query';
import { Post } from '../types/post';
import { useAuth } from '../contexts/AuthContext';

export const useGetPost = (url: string, author: any) => {
    const { currentUser } = useAuth();

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
            const ensureMediaType = (att: any) => {
                // Prefer mediaType, fallback to type for video/image detection
                let mediaType = att.mediaType || att.type || '';
                // If type is 'Video' or 'Image', set a default mediaType
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

            const mappedPost = {
                id: result.id.split('/').pop(),
                content: result.content,
                title: result.name || result.summary,
                author: author,
                postedAt: result.published || new Date().toISOString(),
                likes: result.likes?.totalItems || 0,
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
