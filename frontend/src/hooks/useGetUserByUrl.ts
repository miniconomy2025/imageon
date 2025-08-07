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
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${(await currentUser?.getIdTokenResult())?.token}`
                }
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch user');
            }

            const backendUser = result.user;

            return {
                id: parseInt(backendUser.uid) || 0,
                username: backendUser.username,
                preferredUsername: backendUser.displayName?.split(' ')[0] || '',
                lastName: backendUser.displayName?.split(' ').slice(1).join(' ') || '',
                icon: { type: 'image', url: backendUser.photoURL },
                bio: backendUser.bio
            } as User;
        },
        enabled: !!url
    });

    return {
        user: data,
        isFetching,
        isError,
        isSuccess
    };
};
