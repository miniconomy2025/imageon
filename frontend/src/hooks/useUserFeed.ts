import { useInfiniteQuery } from '@tanstack/react-query';
import { Post } from '../types/post';
import { useAuth } from '../contexts/AuthContext';

import { config } from '../config/config';
export const useUserFeed = (username: string) => {
    const { currentUser } = useAuth();

    const { data, isError, isSuccess, isFetching, fetchNextPage, hasNextPage } = useInfiniteQuery<Post[], Error>({
        queryKey: ['userFeed', username],
        queryFn: async ({}): Promise<Post[]> => {
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

                // Map actor to both actor and author fields
                const user = item.actor
                    ? {
                          id: item.actor.id,
                          username: item.actor.preferredUsername || '',
                          name: item.actor.name,
                          preferredUsername: item.actor.preferredUsername,
                          summary: item.actor.summary,
                          bio: item.actor.summary,
                          url: item.actor.url,
                          icon: item.actor.icon,
                          type: item.actor.type,
                          inbox: item.actor.inbox,
                          outbox: item.actor.outbox,
                          followers: item.actor.followers,
                          following: item.actor.following,
                          published: item.actor.published,
                          followers_count: item.actor.followers_count,
                          following_count: item.actor.following_count
                      }
                    : undefined;

                return {
                    id: postId,
                    content: item.content,
                    postedAt: item.published,
                    attachments: item.attachment || [],
                    author: user,
                    object: item.object,
                    likes: 0,
                    comments: []
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
