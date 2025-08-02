import { useInfiniteQuery } from '@tanstack/react-query';
import config from '../../config.json';
import { Post } from '../types/post';

export const useUserFeed = (username: string) => {

    const { data, isError, isSuccess, isFetching, fetchNextPage, hasNextPage } = useInfiniteQuery({
        queryKey: ['userFeed', username],
        queryFn: async ({ pageParam = 1 }): Promise<Post[]> => {

            if (config.MOCK_DATA) {
                return Promise.resolve([
                    { id: pageParam * 3 - 2, title: `Post ${pageParam * 3 - 2}`, content: `Content ${pageParam * 3 - 2} content content content content content content content content content content content content content content content content content content content content content content content contentv`, author: username, postedAt: new Date().toISOString() }, 
                    { id: pageParam * 3 - 1, title: `Post ${pageParam * 3 - 1}`, content: `Content ${pageParam * 3 - 1}`, author: username, postedAt: new Date().toISOString() }, 
                    { id: pageParam * 3, title: `Post ${pageParam * 3}`, content: `Content ${pageParam * 3}`, author: username, postedAt: new Date().toISOString() }
                ] as Post[]);
            }

            const url = `${config.API_URL}/users/${username}/posts?page=${pageParam}`;
            const response = await fetch(url);

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
        initialPageParam: 1,
    });

    const posts = data?.pages.flat() || [];

    return {
        posts,
        isFetching,
        isError,
        isSuccess,
        fetchNextPage,
        hasNextPage,
    };
};