import { useQuery } from '@tanstack/react-query';
import config from '../../config.json';
import { Post } from '../types/post';

export const useGetPost = (id: string) => {

    const url = `${config.API_URL}/posts/${id}`;

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['post', id],
        queryFn: async (): Promise<Post> => {
            if (config.MOCK_DATA) {
                return Promise.resolve({ id: 1, title: 'Post 1', content: 'Content 1', author: { firstName: 'Bob', lastName: 'Bobby'}, postedAt: new Date().toISOString(), attachments: [config.MOCK_IMAGE_URL, config.MOCK_IMAGE_URL, config.MOCK_IMAGE_URL],  likes: 0, shares: 0, comments: 0 } as Post);
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        },
        enabled: !!id,
    });

    return {
        data,
        isFetching,
        isError,
        isSuccess,
      };
};