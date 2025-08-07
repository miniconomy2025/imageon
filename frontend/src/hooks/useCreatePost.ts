import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

export interface CreatePostRequest {
    content: string;
    files?: File[];
}

export const useCreatePost = () => {
    const queryClient = useQueryClient();
    const { currentUser, userProfile } = useAuth();

    return useMutation({
        mutationFn: async (postData: CreatePostRequest) => {
            if (!currentUser) {
                throw new Error('User not authenticated');
            }

            const authToken = await currentUser.getIdToken();

            const username = userProfile?.username;

            if (!username) {
                throw new Error('User profile incomplete');
            }

            // Create FormData for file uploads
            const formData = new FormData();
            formData.append('actor', username);
            formData.append('content', postData.content);

            // Add files if present
            if (postData.files && postData.files.length > 0) {
                postData.files.forEach(file => {
                    formData.append('media', file);
                });
            }

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/posts`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${authToken}`
                    // Don't set Content-Type header - let browser set it with boundary for multipart/form-data
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to create post');
            }

            return response.json();
        },
        onSuccess: result => {
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ['userFeed'] });
                queryClient.invalidateQueries({ queryKey: ['posts'] });
            }
        },
        onError: error => {
            console.error('Error creating post:', error);
        }
    });
};

export default useCreatePost;
