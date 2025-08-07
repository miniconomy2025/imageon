import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postsService, CreatePostRequest } from '../api';
import { useAuth } from '../contexts/AuthContext';

export const useCreatePost = () => {
    const queryClient = useQueryClient();
    const { currentUser } = useAuth();

    return useMutation({
        mutationFn: async (postData: CreatePostRequest) => {
            const authToken = currentUser ? await currentUser.getIdToken() : undefined;
            return postsService.createPost(postData, authToken);
        },
        onSuccess: result => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ['userFeed'] });
                queryClient.invalidateQueries({ queryKey: ['posts'] });

                // Since the response doesn't include a full post object,
                // we'll just invalidate queries to refetch the data
            }
        },
        onError: error => {
            console.error('Error creating post:', error);
        }
    });
};

export default useCreatePost;
