import { useQuery } from '@tanstack/react-query';
import config from '../../config.json';
import { User } from '../types/user';

export const useGetCurrentUser = () => {

    const url = `${config.API_URL}/users/me`;

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['user', 'me'],
        queryFn: async (): Promise<User> => {
            if (config.MOCK_DATA) {
                return Promise.resolve({ id: 1, username: 'Bob', firstName: 'John', lastName: 'Doe' } as User);
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        },
        enabled: true,
    });

    return {
        user: data,
        isFetching,
        isError,
        isSuccess,
    };
};