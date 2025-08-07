import { useQuery } from '@tanstack/react-query';
import { User } from '../types/user';

const config = {
    API_URL: import.meta.env.VITE_API_URL,
    MOCK_DATA: import.meta.env.VITE_MOCK_DATA,
    MOCK_IMAGE_URL: import.meta.env.VITE_MOCK_IMAGE_URL
};

export const useGetUser = (username: string) => {
    const url = `${config.API_URL}/auth/user/by-id?userId=${username}`;

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['user', username],
        queryFn: async (): Promise<User> => {
            if (config.MOCK_DATA) {
                return Promise.resolve({
                    id: 1,
                    username,
                    firstName: 'John',
                    lastName: 'Doe',
                    avatar: config.MOCK_IMAGE_URL,
                    bio: `${username} is a creative individual who enjoys sharing thoughts and connecting with others. Passionate about technology and innovation.`
                } as User);
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
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
