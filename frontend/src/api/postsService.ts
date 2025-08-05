import config from '../../config.json';
import { Post } from '../types/post';

export interface CreatePostRequest {
    title?: string;
    content: string;
    attachments?: string[];
    postedAt?: string;
}

export interface CreatePostResponse {
    success: boolean;
    post?: Post;
    message?: string;
}

class PostsService {
    private readonly baseUrl: string;

    constructor() {
        this.baseUrl = `${config.API_URL}/posts`;
    }

    async createPost(postData: CreatePostRequest): Promise<CreatePostResponse> {
        try {
            if (config.MOCK_DATA) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const mockPost: Post = {
                    id: `mock-post-${Date.now()}`,
                    title: postData.title,
                    content: postData.content,
                    attachments: postData.attachments || [],
                    postedAt: postData.postedAt || new Date().toISOString(),
                    likes: 0,
                    comments: [],
                    author: {
                        id: 1,
                        username: 'Bob',
                        firstName: 'John',
                        lastName: 'Doe'
                    }
                };

                return {
                    success: true,
                    post: mockPost,
                    message: 'Post created successfully'
                };
            }

            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                    // 'Authorization': `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify(postData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return {
                success: true,
                post: result.post || result,
                message: result.message || 'Post created successfully'
            };
        } catch (error) {
            console.error('Error creating post:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'An unexpected error occurred'
            };
        }
    }
}

export const postsService = new PostsService();
export default postsService;
