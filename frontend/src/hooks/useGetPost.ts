import { useQuery } from '@tanstack/react-query';
import { Post } from '../types/post';

import { config } from '../config/config';
export const useGetPost = (id: string) => {
    const url = `${config.API_URL}/posts/${id}`;

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['post', id],
        queryFn: async (): Promise<Post> => {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        },
        enabled: !!id
    });

    return {
        data,
        isFetching,
        isError,
        isSuccess
    };
};
