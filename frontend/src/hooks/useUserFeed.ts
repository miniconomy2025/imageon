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
                    id: postId,
                    attachments: item.attachment || []
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
