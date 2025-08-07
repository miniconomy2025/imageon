import { useQuery } from '@tanstack/react-query';
import { User } from '../types/user';

import { config } from '../config/config';
export const useSearchUser = (searchTerm: string) => {
    const url = `${config.API_URL}/.well-known/webfinger?resource=acct:${encodeURIComponent(searchTerm)}`;

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['searchUsers', searchTerm],
        queryFn: async (): Promise<User[]> => {
            if (config.MOCK_DATA) {
                // Mock data for development
                const mockUsers: User[] = [
                    {
                        id: 1,
                        username: 'john_doe',
                        firstName: 'John',
                        lastName: 'Doe',
                        avatar: config.MOCK_IMAGE_URL,
                        bio: 'Full-stack developer with expertise in React and Node.js.'
                    },
                    {
                        id: 2,
                        username: 'alice_smith',
                        firstName: 'Alice',
                        lastName: 'Smith',
                        avatar: config.MOCK_IMAGE_URL,
                        bio: 'Creative designer and frontend developer.'
                    },
                    {
                        id: 3,
                        username: 'bob_wilson',
                        firstName: 'Bob',
                        lastName: 'Wilson',
                        avatar: config.MOCK_IMAGE_URL,
                        bio: 'Product manager turned developer.'
                    },
                    {
                        id: 4,
                        username: 'sarah_jones',
                        firstName: 'Sarah',
                        lastName: 'Jones',
                        avatar: config.MOCK_IMAGE_URL,
                        bio: 'Data scientist and machine learning enthusiast.'
                    },
                    {
                        id: 5,
                        username: 'mike_brown',
                        firstName: 'Mike',
                        lastName: 'Brown',
                        avatar: config.MOCK_IMAGE_URL,
                        bio: 'DevOps engineer passionate about automation.'
                    }
                ];

                // Filter users based on search term
                return Promise.resolve(
                    mockUsers.filter(
                        user =>
                            user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            user.lastName.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                );
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        },
        enabled: searchTerm.length > 0, // Only run query if there's a search term
        staleTime: 30000 // Consider data stale after 30 seconds
    });

    return {
        users: data || [],
        isLoading: isFetching,
        isError,
        isSuccess
    };
};
