import { useQuery } from '@tanstack/react-query';
import { User } from '../types/user';

import { config } from '../config/config';
import { useAuth } from '../contexts/AuthContext';

export const useSearchUser = (searchTerm: string) => {
    const { currentUser } = useAuth();

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['searchUsers', searchTerm],
        queryFn: async (): Promise<User[]> => {
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
                preferredUsername: user.name || user.preferredUsername || searchTerm,
                icon: { url: user.icon?.url || config.MOCK_IMAGE_URL, type: 'image' },
                bio: user.summary || 'No bio available',
                handle: user.handle,
                url: user.url
            };

            return [transformedUser];
        },
        enabled: searchTerm.length > 0,
        staleTime: 30000
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
