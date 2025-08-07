import { useInfiniteQuery } from '@tanstack/react-query';
import { Post } from '../types/post';
import { useAuth } from '../contexts/AuthContext';

import { config } from '../config/config';
export const useUserFeed = (username: string) => {
    const { currentUser } = useAuth();

    const { data, isError, isSuccess, isFetching, fetchNextPage, hasNextPage } = useInfiniteQuery<Post[], Error>({
        queryKey: ['userFeed', username],
        queryFn: async ({ pageParam = 1 }): Promise<Post[]> => {
            const page = pageParam as number;
            if (config.MOCK_DATA) {
                return Promise.resolve([
                    {
                        id: String(page * 3 - 2),
                        title: `Post ${page * 3 - 2}`,
                        content: `Content ${
                            page * 3 - 2
                        } content content content content content content content content content content content content content content content content content content content content content content content contentv`,
                        author: { username },
                        postedAt: new Date().toISOString(),
                        attachments: [config.MOCK_IMAGE_URL, config.MOCK_IMAGE_URL, config.MOCK_IMAGE_URL]
                    },
                    {
                        id: String(page * 3 - 1),
                        title: `Post ${page * 3 - 1}`,
                        content: `Content ${page * 3 - 1}`,
                        author: { username },
                        postedAt: new Date().toISOString(),
                        attachments: [config.MOCK_IMAGE_URL]
                    },
                    {
                        id: String(page * 3),
                        title: `Post ${page * 3}`,
                        content: `Content ${page * 3}`,
                        author: { username },
                        postedAt: new Date().toISOString(),
                        attachments: [config.MOCK_IMAGE_URL, config.MOCK_IMAGE_URL]
                    }
                ] as Post[]);
            }

            const url = `${config.API_URL}/api/feed?actor=${encodeURIComponent(username)}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${(await currentUser?.getIdTokenResult())?.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const result = await response.json();
            const items = result.items || [];

            return items.map((item: any) => {
                let postId = item.id;

                if (item.object) {
                    const urlParts = item.object.split('/');
                    postId = urlParts[urlParts.length - 1];
                }

                return {
                    ...item,
                    id: postId
                };
            });
        },
        getNextPageParam: (_lastPage: Post[], _pages: Post[][]) => {
            // Returns undefined if there are no more pages
            //return lastPage.length > 0 ? pages.length + 1 : undefined;
            return undefined;
        },
        enabled: !!username,
        initialPageParam: 1
    });

    const posts: Post[] = data?.pages.flat() || [];

    return {
        posts,
        isFetching,
        isError,
        isSuccess,
        fetchNextPage,
        hasNextPage
    };
};
