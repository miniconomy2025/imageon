import { useQuery } from '@tanstack/react-query';
import { User } from '../types/user';
import { config } from '../config/config';
import { useAuth } from '../contexts/AuthContext';

export const useGetUser = (username: string) => {
    const { currentUser } = useAuth();

    const { data, isError, isSuccess, isFetching, error } = useQuery({
        queryKey: ['user', username],
        queryFn: async (): Promise<User> => {
            // Get token outside of the fetch for better error handling
            const tokenResult = await currentUser?.getIdTokenResult();
            const token = tokenResult?.token;

            const url = `${config.API_URL}/users/${username}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/activity+json',
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch user: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            
            // Add validation for the response
            if (!result) {
                throw new Error('Invalid response: No user data received');
            }

            const mappedUser: User = {
                id: result.id ? parseInt(result.id.split('/').pop() || '0') || 0 : 0,
                username: result.preferredUsername || username,
                preferredUsername: result.name?.split(' ')[0] || result.preferredUsername || username,
                name: result.name || result.preferredUsername || username,
                bio: result.summary || '',
                icon: result.icon ? { type: 'image', url: result.icon } : undefined,
                url: result.url || result.id,
                inbox: result.inbox,
                outbox: result.outbox,
                followers: result.followers,
                following: result.following
            };
            
            return mappedUser;
        },
        enabled: !!username && !!currentUser, // Also check if user is authenticated
        retry: (failureCount, error) => {
            // Don't retry on authentication errors
            if (error instanceof Error && error.message.includes('401')) {
                return false;
            }
            return failureCount < 3;
        },
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000   // 10 minutes
    });

    return {
        user: data,
        isFetching,
        isError,
        isSuccess,
        error
    };
};
