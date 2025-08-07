import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { config } from '../config/config';
interface CreateCommentParams {
    postId: string;
    content: string;
}

export const useCreateComment = () => {
    const { currentUser } = useAuth();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async ({ postId, content }: CreateCommentParams): Promise<void> => {
            const url = `${config.API_URL}/api/posts/${postId}/comment`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${(await currentUser?.getIdTokenResult())?.token}`
                },
                body: JSON.stringify({
                    content
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create comment');
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['posts'] });
            queryClient.invalidateQueries({ queryKey: ['feed'] });
            queryClient.invalidateQueries({ queryKey: ['user'] });
        },
        onError: error => {
            console.error('Error creating comment:', error);
        }
    });

    return {
        createComment: mutation.mutate,
        isLoading: mutation.isPending,
        isError: mutation.isError,
        error: mutation.error,
        isSuccess: mutation.isSuccess
    };
};
