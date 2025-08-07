import { useQuery } from '@tanstack/react-query';
import { User } from '../types/user';

import { config } from '../config/config';
import { useAuth } from '../contexts/AuthContext';

export const useSearchUser = (searchTerm: string) => {
    const { currentUser } = useAuth();

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

            // Format the handle properly for the discovery endpoint
            const formatHandle = (term: string) => {
                // Remove @ prefix if present
                const cleanTerm = term.replace(/^@/, '');

                // If it already contains @domain, use as is
                if (cleanTerm.includes('@')) {
                    return cleanTerm;
                }

                // Otherwise, append the local domain
                const domain = new URL(config.API_URL).hostname;
                return `${cleanTerm}@${domain}`;
            };

            const formattedHandle = formatHandle(searchTerm);

            // Use the /api/users/discover endpoint
            const url = `${config.API_URL}/api/users/discover`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${(await currentUser?.getIdTokenResult())?.token}`
                },
                body: JSON.stringify({ handle: formattedHandle })
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // User not found, return empty array
                    return [];
                }
                throw new Error('Network response was not ok');
            }

            const discoveryData = await response.json();

            if (!discoveryData.success || !discoveryData.user) {
                return [];
            }

            const user = discoveryData.user;

            // Transform the discovered user to your User format
            const transformedUser: User = {
                id: typeof user.id === 'string' ? user.id.hashCode() : Date.now(), // Convert string ID to number
                username: user.preferredUsername || user.name || searchTerm,
                firstName: user.name || user.preferredUsername || searchTerm,
                lastName: '',
                avatar: user.icon?.url || config.MOCK_IMAGE_URL,
                bio: user.summary || 'No bio available'
            };

            return [transformedUser];
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

// Helper function to convert string to number (simple hash)
declare global {
    interface String {
        hashCode(): number;
    }
}

String.prototype.hashCode = function () {
    let hash = 0;
    if (this.length === 0) return hash;
    for (let i = 0; i < this.length; i++) {
        const char = this.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
};
