import { useQuery } from '@tanstack/react-query';
import { Post } from '../types/post';
import { useAuth } from '../contexts/AuthContext';

import { config } from '../config/config';
export const useUserPosts = (username: string) => {
    const { currentUser } = useAuth();
    const url = `${config.API_URL}/auth/user/posts`;

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['userPosts', username],
        queryFn: async (): Promise<Post[]> => {
            const token = (await currentUser?.getIdTokenResult())?.token;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const result = await response.json();
            return result.posts || [];
        },
        enabled: !!username
    });

    return {
        posts: data,
        isFetching,
        isError,
        isSuccess
    };
};
