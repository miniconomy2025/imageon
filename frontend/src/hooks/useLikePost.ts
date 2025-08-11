import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { config } from '../config/config';

interface LikePostParams {
    postId: string;
    isLiked: boolean;
}

export const useLikePost = () => {
    const { currentUser, userProfile } = useAuth();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async ({ postId, isLiked }: LikePostParams): Promise<void> => {
            const url = `${config.API_URL}/api/posts/${postId}/like`;
            const method = isLiked ? 'DELETE' : 'POST';

            // Prepare ActivityPub-compatible payload
            const actor = userProfile?.username;

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${(await currentUser?.getIdTokenResult())?.token}`
                },
                body: JSON.stringify({
                    postId,
                    actor
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update like status');
            }
        },
        onSuccess: () => {
            // Invalidate all post-related caches
            queryClient.invalidateQueries({ queryKey: ['posts'] });
            queryClient.invalidateQueries({ queryKey: ['feed'] });
            queryClient.invalidateQueries({ queryKey: ['user'] });
            queryClient.invalidateQueries({ queryKey: ['post'] });
        },
        onError: error => {
            console.error('Error updating like status:', error);
        }
    });

    return {
        likePost: mutation.mutate,
        isLoading: mutation.isPending,
        isError: mutation.isError,
        error: mutation.error,
        isSuccess: mutation.isSuccess
    };
};
