import { useQuery } from '@tanstack/react-query';
import { User } from '../types/user';

import { config } from '../config/config';

export const useGetUser = (userId: string) => {
    const url = `${config.API_URL}/auth/user/by-id?userId=${userId}`;

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['user', userId],
        queryFn: async (): Promise<User> => {
            if (config.MOCK_DATA) {
                return Promise.resolve({
                    id: parseInt(userId) || 1,
                    username: `user${userId}`,
                    firstName: 'John',
                    lastName: 'Doe',
                    avatar: config.MOCK_IMAGE_URL,
                    bio: `User ${userId} is a creative individual who enjoys sharing thoughts and connecting with others. Passionate about technology and innovation.`
                } as User);
            }

            const response = await fetch(url);
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
        enabled: !!userId
    });

    return {
        user: data,
        isFetching,
        isError,
        isSuccess
    };
};
