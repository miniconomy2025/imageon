import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

const config = {
    API_URL: import.meta.env.VITE_API_URL,
    MOCK_DATA: import.meta.env.VITE_MOCK_DATA
};

interface LikePostParams {
    postId: string;
    isLiked: boolean;
}

export const useLikePost = () => {
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async ({ postId, isLiked }: LikePostParams): Promise<void> => {
            if (config.MOCK_DATA) {
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve();
                    }, 500);
                });
            }

            const url = `${config.API_URL}/api/posts/${postId}/like`;
            const method = isLiked ? 'DELETE' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${currentUser?.getIdToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to update like status');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['posts'] });
            queryClient.invalidateQueries({ queryKey: ['feed'] });
            queryClient.invalidateQueries({ queryKey: ['user'] });
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
