import { useQuery } from '@tanstack/react-query';
import { User } from '../types/user';
import { useAuth } from '../contexts/AuthContext';

export const useGetUserByUrl = (url: string) => {
    const { currentUser } = useAuth();

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['user', url],
        queryFn: async (): Promise<User> => {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Accept: 'application/activity+json',
                    'Content-Type': 'application/activity+json',
                    Authorization: `Bearer ${(await currentUser?.getIdTokenResult())?.token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            const backendUser = result;

            const mappedUser = {
                id: backendUser.id ? parseInt(backendUser.id.split('/').pop()) || 0 : 0,
                username: backendUser.preferredUsername || '',
                preferredUsername: backendUser.name?.split(' ')[0] || backendUser.preferredUsername || '',
                name: backendUser.name || '',
                bio: backendUser.summary || '',
                icon: backendUser.icon ? { type: 'image', url: backendUser.icon } : undefined,
                url: backendUser.url || backendUser.id || '',
                inbox: backendUser.inbox || '',
                outbox: backendUser.outbox || '',
                followers: backendUser.followers || '',
                following: backendUser.following || ''
            } as User;

            console.log('useGetUserByUrl mapped user:', mappedUser);
            return mappedUser;
        },
        enabled: !!url,
        retry: 3,
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000
    });

    return {
        user: data,
        isFetching,
        isError,
        isSuccess
    };
};
