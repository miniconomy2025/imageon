import { useMutation, useQueryClient } from '@tanstack/react-query';

const config = {
    API_URL: import.meta.env.VITE_API_URL,
    MOCK_DATA: import.meta.env.VITE_MOCK_DATA
};

interface FollowUserParams {
    userId: number;
    isFollowing: boolean;
}

export const useFollowUser = () => {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async ({ userId, isFollowing }: FollowUserParams): Promise<void> => {
            if (config.MOCK_DATA) {
                // Mock implementation - just simulate a delay
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve();
                    }, 500);
                });
            }

            const url = `${config.API_URL}/users/${userId}/${isFollowing ? 'unfollow' : 'follow'}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include' // Include cookies for authentication
            });

            if (!response.ok) {
                throw new Error('Failed to update follow status');
            }
        },
        onSuccess: () => {
            // Invalidate related queries to refresh the data
            queryClient.invalidateQueries({ queryKey: ['following'] });
            queryClient.invalidateQueries({ queryKey: ['user'] });
            queryClient.invalidateQueries({ queryKey: ['searchUsers'] });
        },
        onError: error => {
            console.error('Error updating follow status:', error);
        }
    });

    return {
        followUser: mutation.mutate,
        isLoading: mutation.isPending,
        isError: mutation.isError,
        error: mutation.error,
        isSuccess: mutation.isSuccess
    };
};
