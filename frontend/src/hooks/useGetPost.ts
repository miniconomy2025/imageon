import { useQuery } from '@tanstack/react-query';
import config from '../../config.json';
import { Post } from '../types/post';
import { Comment } from '../types/comment';

export const useGetPost = (id: string) => {
    const url = `${config.API_URL}/posts/${id}`;

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['post', id],
        queryFn: async (): Promise<Post> => {
            if (config.MOCK_DATA) {
                return Promise.resolve({
                    id: '1',
                    title: 'Post 1',
                    content: 'Content 1',
                    author: { id: 1, firstName: 'Bob', lastName: 'Bobby', username: 'bob', avatar: config.MOCK_IMAGE_URL },
                    postedAt: new Date().toISOString(),
                    attachments: [config.MOCK_IMAGE_URL, config.MOCK_IMAGE_URL, config.MOCK_IMAGE_URL],
                    likes: 0,
                    comments: [
                        {
                            id: 'c1',
                            postId: '1',
                            author: {
                                id: '2',
                                firstName: 'Alice',
                                lastName: 'Smith',
                                username: 'alice',
                                avatar: config.MOCK_IMAGE_URL
                            },
                            content: 'Nice post!',
                            createdAt: new Date().toISOString()
                        },
                        {
                            id: 'c2',
                            postId: '1',
                            author: {
                                id: '3',
                                firstName: 'John',
                                lastName: 'Doe',
                                username: 'john',
                                avatar: config.MOCK_IMAGE_URL
                            },
                            content: 'Interesting read!',
                            createdAt: new Date().toISOString()
                        }
                    ]
                } as Post);
            }

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
