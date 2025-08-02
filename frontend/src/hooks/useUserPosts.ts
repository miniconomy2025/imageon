import { useQuery } from '@tanstack/react-query';
import config from '../../config.json';
import { Post } from '../types/post';

export const useUserPosts = (username: string) => {

    const url = `${config.API_URL}/users/${username}/posts`;

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['userPosts', username],
        queryFn: async (): Promise<Post[]> => {
            if (config.MOCK_DATA) {
                return Promise.resolve([{ id: 1, title: 'Post 1', content: 'Content 1', author: username, postedAt: new Date().toISOString() }, 
                    { id: 2, title: 'Post 2', content: 'Content 2', author: username, postedAt: new Date().toISOString() }, 
                    { id: 3, title: 'Post 3', content: 'Content 3', author: username, postedAt: new Date().toISOString() }] as Post[]);
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        },
        enabled: !!username,
    });

    return {
        posts: data,
        isFetching,
        isError,
        isSuccess,
      };
};