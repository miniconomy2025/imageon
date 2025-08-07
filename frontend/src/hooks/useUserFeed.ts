import { useInfiniteQuery } from '@tanstack/react-query';
import { Post } from '../types/post';
import { useAuth } from '../contexts/AuthContext';

import { config } from '../config/config';
export const useUserFeed = (username: string) => {
    const { currentUser } = useAuth();

    const { data, isError, isSuccess, isFetching, fetchNextPage, hasNextPage } = useInfiniteQuery({
        queryKey: ['userFeed', username],
        queryFn: async ({ pageParam = 1 }): Promise<Post[]> => {
            if (config.MOCK_DATA) {
                return Promise.resolve([
                    {
                        id: String(pageParam * 3 - 2),
                        title: `Post ${pageParam * 3 - 2}`,
                        content: `Content ${
                            pageParam * 3 - 2
                        } content content content content content content content content content content content content content content content content content content content content content content content contentv`,
                        author: { username },
                        postedAt: new Date().toISOString(),
                        attachments: [config.MOCK_IMAGE_URL, config.MOCK_IMAGE_URL, config.MOCK_IMAGE_URL]
                    },
                    {
                        id: String(pageParam * 3 - 1),
                        title: `Post ${pageParam * 3 - 1}`,
                        content: `Content ${pageParam * 3 - 1}`,
                        author: { username },
                        postedAt: new Date().toISOString(),
                        attachments: [config.MOCK_IMAGE_URL]
                    },
                    {
                        id: String(pageParam * 3),
                        title: `Post ${pageParam * 3}`,
                        content: `Content ${pageParam * 3}`,
                        author: { username },
                        postedAt: new Date().toISOString(),
                        attachments: [config.MOCK_IMAGE_URL, config.MOCK_IMAGE_URL]
                    }
                ] as Post[]);
            }

            const url = `${config.API_URL}/api/feed`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${currentUser?.getIdToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        },
        getNextPageParam: (lastPage, pages) => {
            // Returns undefined if there are no more pages
            return lastPage.length > 0 ? pages.length + 1 : undefined;
        },
        enabled: !!username,
        initialPageParam: 1
    });

    const posts = data?.pages.flat() || [];

    return {
        posts,
        isFetching,
        isError,
        isSuccess,
        fetchNextPage,
        hasNextPage
    };
};
