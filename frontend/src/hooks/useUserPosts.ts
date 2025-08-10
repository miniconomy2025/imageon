import { useQuery } from '@tanstack/react-query';
import { Post } from '../types/post';
import { useAuth } from '../contexts/AuthContext';

export const useUserPosts = (url: string) => {
    const { currentUser } = useAuth();
    const outboxUrl = `${url}/outbox`;

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['userPosts', outboxUrl],
        queryFn: async (): Promise<Post[]> => {
            const token = (await currentUser?.getIdTokenResult())?.token;

            const response = await fetch(outboxUrl, {
                method: 'GET',
                headers: {
                    Accept: 'application/activity+json',
                    'Content-Type': 'application/activity+json',
                    Authorization: `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const result = await response.json();
            console.debug(result);

            // If result.first exists, fetch the first page (pagination)
            let activities = [];
            if (result.first) {
                const pageResponse = await fetch(result.first, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                if (!pageResponse.ok) {
                    throw new Error('Network response was not ok');
                }
                const pageResult = await pageResponse.json();
                // Parse pageResult for posts just like result
                activities = (pageResult.orderedItems || [])
                    .filter((item: any) => item.type === 'Create' && item.object && item.object.type === 'Note' && typeof item.object.id === 'string')
                    .map((item: any) => {
                        let attachments = undefined;
                        if (item.object.attachment) {
                            if (Array.isArray(item.object.attachment)) {
                                attachments = item.object.attachment;
                            } else {
                                attachments = [item.object.attachment];
                            }
                        }
                        return {
                            id: item.object.id,
                            content: item.object.content,
                            postedAt: item.object.published,
                            url: item.object.url || item.object.id,
                            attachments
                        };
                    }) as Post[];
            } else {
                activities = (result.orderedItems || [])
                    .filter((item: any) => item.type === 'Create' && item.object && item.object.type === 'Note' && typeof item.object.id === 'string')
                    .map((item: any) => {
                        let attachments = undefined;
                        if (item.object.attachment) {
                            if (Array.isArray(item.object.attachment)) {
                                attachments = item.object.attachment;
                            } else {
                                attachments = [item.object.attachment];
                            }
                        }
                        return {
                            id: item.object.id,
                            content: item.object.content,
                            postedAt: item.object.published,
                            url: item.object.url || item.object.id,
                            attachments
                        };
                    }) as Post[];
            }

            // activities is already filtered and mapped to Post[]
            return activities;
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
