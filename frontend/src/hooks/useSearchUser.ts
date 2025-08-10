import { useQuery } from '@tanstack/react-query';
import { User } from '../types/user';

import { config } from '../config/config';
import { useAuth } from '../contexts/AuthContext';

export const useSearchUser = (searchTerm: string, followers: User[]) => {
    const { currentUser } = useAuth();

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['searchUsers', searchTerm],
        queryFn: async (): Promise<Array<{ user: User; isFollowing: boolean }>> => {
            // Format the handle properly for the discovery endpoint
            const formatHandle = (term: string) => {
                const cleanTerm = term.replace(/^@/, '');

                if (cleanTerm.includes('@')) {
                    return cleanTerm;
                }

                const domain = new URL(config.API_URL).hostname;
                return `${cleanTerm}@${domain}`;
            };

            const formattedHandle = formatHandle(searchTerm);

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
                    return [];
                }
                throw new Error('Network response was not ok');
            }

            const discoveryData = await response.json();

            if (!discoveryData.success || !discoveryData.user) {
                return [];
            }

            const user = discoveryData.user;

            const transformedUser: User = {
                id: typeof user.id === 'string' ? user.id.hashCode() : Date.now(),
                username: user.preferredUsername || user.name || searchTerm,
                name: user.name,
                preferredUsername: user.preferredUsername,
                summary: user.summary,
                icon: user.icon ? { url: user.icon.url, type: user.icon.type.toLowerCase() } : { url: config.MOCK_IMAGE_URL, type: 'image' },
                bio: user.summary || 'No bio available',
                handle: user.handle,
                url: user.id,
                type: user.type
            };

            // Check if the user is already being followed
            const isFollowing = followers.some(follower => follower.handle === user.handle || follower.id === transformedUser.id || follower.url === user.id);

            return [
                {
                    user: transformedUser,
                    isFollowing
                }
            ];
        },
        enabled: searchTerm.length > 0,
        staleTime: 30000
    });

    return {
        data: data || [],
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
