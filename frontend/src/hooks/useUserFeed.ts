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

            const posts: any[] = [];
            const comments: any[] = [];

            items.forEach((item: any) => {
                if (item.inReplyTo) {
                    comments.push(item);
                } else {
                    posts.push(item);
                }
            });

            const postsMap = new Map<string, Post>();

            posts.forEach((item: any) => {
                let postId = item.id;

                if (item.object) {
                    const urlParts = item.object.split('/');
                    postId = urlParts[urlParts.length - 1];
                }

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

                const post: Post = {
                    id: postId,
                    content: item.content,
                    postedAt: item.published,
                    attachments: item.attachment || [],
                    author: user,
                    likes: 0,
                    comments: [],
                    url: item.object
                };

                postsMap.set(item.object, post);
                postsMap.set(postId, post);

                if (item.id !== postId) {
                    postsMap.set(item.id, post);
                }

                console.log('Stored post with keys:', [item.object, postId, item.id].filter(Boolean));
            });

            // Add comments to their parent posts
            comments.forEach((commentItem: any) => {
                console.log('Processing comment:', {
                    commentId: commentItem.id,
                    inReplyTo: commentItem.inReplyTo,
                    availablePostKeys: Array.from(postsMap.keys())
                });

                let parentPost = postsMap.get(commentItem.inReplyTo);

                if (!parentPost && commentItem.inReplyTo) {
                    const urlParts = commentItem.inReplyTo.split('/');
                    const postIdFromUrl = urlParts[urlParts.length - 1];
                    parentPost = postsMap.get(postIdFromUrl);
                    console.log('Trying to find post by ID:', postIdFromUrl, 'found:', !!parentPost);
                }

                if (parentPost) {
                    let commentId = commentItem.id;
                    if (commentItem.object) {
                        const urlParts = commentItem.object.split('/');
                        commentId = urlParts[urlParts.length - 1];
                    }

                    const commentUser = commentItem.actor
                        ? {
                              id: commentItem.actor.id,
                              username: commentItem.actor.preferredUsername || '',
                              name: commentItem.actor.name,
                              preferredUsername: commentItem.actor.preferredUsername,
                              summary: commentItem.actor.summary,
                              bio: commentItem.actor.summary,
                              url: commentItem.actor.url,
                              icon: commentItem.actor.icon,
                              type: commentItem.actor.type,
                              inbox: commentItem.actor.inbox,
                              outbox: commentItem.actor.outbox,
                              followers: commentItem.actor.followers,
                              following: commentItem.actor.following,
                              published: commentItem.actor.published,
                              followers_count: commentItem.actor.followers_count,
                              following_count: commentItem.actor.following_count
                          }
                        : {
                              id: '',
                              username: '',
                              name: '',
                              preferredUsername: '',
                              summary: '',
                              bio: '',
                              url: '',
                              icon: null,
                              type: '',
                              inbox: '',
                              outbox: '',
                              followers: '',
                              following: '',
                              published: '',
                              followers_count: 0,
                              following_count: 0
                          };

                    const comment = {
                        id: commentId,
                        postId: parentPost.id,
                        author: commentUser,
                        content: commentItem.content,
                        createdAt: commentItem.published
                    };

                    if (!parentPost.comments) {
                        parentPost.comments = [];
                    }
                    parentPost.comments.push(comment);
                    console.log('Added comment to post:', parentPost.id, 'total comments now:', parentPost.comments.length);
                } else {
                    console.log('Parent post not found for comment:', commentItem.id, 'inReplyTo:', commentItem.inReplyTo);
                }
            });

            const posts1 = Array.from(postsMap.values()).filter((post, index, array) => array.findIndex(p => p.id === post.id) === index);
            console.log('useUserFeed posts1', posts1);
            return posts1;
        },
        getNextPageParam: (_lastPage: Post[], _pages: Post[][]) => {
            return undefined;
        },
        enabled: !!username,
        retry: 3,
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
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
