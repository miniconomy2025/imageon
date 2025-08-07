import { useQuery } from '@tanstack/react-query';
import { Post } from '../types/post';

const config = {
    API_URL: import.meta.env.VITE_API_URL,
    MOCK_DATA: import.meta.env.VITE_MOCK_DATA,
    MOCK_IMAGE_URL: import.meta.env.VITE_MOCK_IMAGE_URL
};

export const useUserPosts = (username: string) => {
    const url = `${config.API_URL}/users/${username}/posts`;

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['userPosts', username],
        queryFn: async (): Promise<Post[]> => {
            if (config.MOCK_DATA) {
                return Promise.resolve([
                    {
                        id: 1,
                        title: 'Post 1',
                        content: 'Content 1',
                        author: { username },
                        postedAt: new Date().toISOString(),
                        attachments: [config.MOCK_IMAGE_URL]
                    },
                    {
                        id: 2,
                        title: 'Post 2',
                        content: 'Content 2',
                        author: { username },
                        postedAt: new Date().toISOString(),
                        attachments: [config.MOCK_IMAGE_URL, config.MOCK_IMAGE_URL, config.MOCK_IMAGE_URL]
                    },
                    {
                        id: 3,
                        title: 'Post 3',
                        content: 'Content 3',
                        author: { username },
                        postedAt: new Date().toISOString(),
                        attachments: [config.MOCK_IMAGE_URL]
                    }
                ] as Post[]);
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        },
        enabled: !!username
    });

    return {
        posts: data,
        isFetching,
        isError,
        isSuccess
    };
};
