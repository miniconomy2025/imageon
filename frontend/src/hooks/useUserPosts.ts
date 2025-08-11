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
                }),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const result = await response.json();
            console.debug(result);

            // If result.first exists, fetch the first page (pagination)
            let activities = [];

            activities = (result.orderedItems || result.items || [])
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
