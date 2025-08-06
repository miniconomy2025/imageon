import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postsService, CreateCommentRequest } from '../api/postsService';

export const useCreateComment = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (commentData: CreateCommentRequest) => postsService.createComment(commentData),
        onSuccess: (data, variables) => {
            // Invalidate and refetch the post to show the new comment
            queryClient.invalidateQueries({
                queryKey: ['post', variables.postId]
            });

            if (data.success && data.comment) {
                queryClient.setQueryData(['post', variables.postId], (oldData: any) => {
                    if (oldData) {
                        return {
                            ...oldData,
                            comments: [...(oldData.comments || []), data.comment]
                        };
                    }
                    return oldData;
                });
            }
        },
        onError: error => {
            console.error('Failed to create comment:', error);
        }
    });
};
