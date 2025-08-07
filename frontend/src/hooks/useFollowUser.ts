import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { config } from '../config/config';

interface FollowUserParams {
    userId: number;
    isFollowing: boolean;
}

export const useFollowUser = () => {
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async ({ userId, isFollowing }: FollowUserParams): Promise<void> => {
            if (config.MOCK_DATA) {
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve();
                    }, 500);
                });
            }

            const url = `${config.API_URL}/api/follow`;
            const method = isFollowing ? 'DELETE' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${currentUser?.getIdToken()}`
                },
                body: JSON.stringify({
                    userId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update follow status');
            }
        },
        onSuccess: () => {
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
