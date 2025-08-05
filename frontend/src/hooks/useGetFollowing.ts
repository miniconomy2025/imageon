import { useQuery } from '@tanstack/react-query';
import config from '../../config.json';
import { User } from '../types/user';

export const useGetFollowing = (username: string) => {
    const url = `${config.API_URL}/users/${username}/following`;

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['following', username],
        queryFn: async (): Promise<User[]> => {
            if (config.MOCK_DATA) {
                return Promise.resolve([
                    { id: 1, username, firstName: 'John', lastName: 'Doe' } as User,
                    { id: 2, username, firstName: 'Bob', lastName: 'Doe' } as User,
                    { id: 3, username, firstName: 'Alice', lastName: 'Doe' } as User
                ]);
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
        following: data,
        isFetching,
        isError,
        isSuccess
    };
};
