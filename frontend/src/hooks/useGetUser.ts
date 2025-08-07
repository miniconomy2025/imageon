import { useQuery } from '@tanstack/react-query';
import { User } from '../types/user';

import { config } from '../config/config';
import { useAuth } from '../contexts/AuthContext';

export const useGetUser = (username: string) => {
    const { currentUser } = useAuth();
    const url = `${config.API_URL}/auth/user/by-id?userId=${username}`;

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['user', username],
        queryFn: async (): Promise<User> => {
            if (config.MOCK_DATA) {
                return Promise.resolve({
                    id: parseInt(username) || 1,
                    username: `user${username}`,
                    firstName: 'John',
                    lastName: 'Doe',
                    avatar: config.MOCK_IMAGE_URL,
                    bio: `User ${username} is a creative individual who enjoys sharing thoughts and connecting with others. Passionate about technology and innovation.`
                } as User);
            }

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
                firstName: backendUser.displayName?.split(' ')[0] || '',
                lastName: backendUser.displayName?.split(' ').slice(1).join(' ') || '',
                avatar: backendUser.photoURL,
                bio: backendUser.bio
            } as User;
        },
        enabled: !!username
    });

    return {
        user: data,
        isFetching,
        isError,
        isSuccess
    };
};
