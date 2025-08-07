import { useQuery } from '@tanstack/react-query';
import { User } from '../types/user';
import { useAuth } from '../contexts/AuthContext';

const config = {
    API_URL: import.meta.env.VITE_API_URL,
    MOCK_DATA: import.meta.env.VITE_MOCK_DATA,
    MOCK_IMAGE_URL: import.meta.env.VITE_MOCK_IMAGE_URL
};

export const useGetFollowing = () => {
    const { currentUser } = useAuth();

    const url = `${config.API_URL}/auth/user/following`;

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['following', currentUser?.uid],
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

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${currentUser?.getIdToken()}`
                }
            });
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        },
        enabled: currentUser?.uid != null
    });

    return {
        following: data,
        isFetching,
        isError,
        isSuccess
    };
};
