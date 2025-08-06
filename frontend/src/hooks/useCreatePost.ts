import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postsService, CreatePostRequest } from '../api';

export const useCreatePost = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (postData: CreatePostRequest) => postsService.createPost(postData),
        onSuccess: result => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ['userFeed'] });
                queryClient.invalidateQueries({ queryKey: ['posts'] });

                if (result.post) {
                    queryClient.setQueryData(['post', result.post.id], result.post);
                }
            }
        },
        onError: error => {
            console.error('Error creating post:', error);
        }
    });
};

export default useCreatePost;
