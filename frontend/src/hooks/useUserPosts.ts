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
        enabled: !!username,
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
