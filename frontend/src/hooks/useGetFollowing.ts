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
                    {
                        id: 1,
                        username: 'john',
                        firstName: 'John',
                        lastName: 'Doe',
                        avatar: config.MOCK_IMAGE_URL,
                        bio: 'Full-stack developer with expertise in React and Node.js. Love building scalable applications.'
                    } as User,
                    {
                        id: 2,
                        username: 'bob',
                        firstName: 'Bob',
                        lastName: 'Doe',
                        avatar: config.MOCK_IMAGE_URL,
                        bio: 'Creative designer and frontend developer. Passionate about user experience and accessibility.'
                    } as User,
                    {
                        id: 3,
                        username: 'alice',
                        firstName: 'Alice',
                        lastName: 'Doe',
                        avatar: config.MOCK_IMAGE_URL,
                        bio: 'Product manager turned developer. Bridging the gap between business and technology.'
                    } as User
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
