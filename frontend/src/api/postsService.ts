import { Post } from '../types/post';
import { Comment } from '../types/comment';

const config = {
    API_URL: import.meta.env.VITE_API_URL,
    MOCK_DATA: import.meta.env.VITE_MOCK_DATA,
    MOCK_IMAGE_URL: import.meta.env.VITE_MOCK_IMAGE_URL
};

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

export interface CreateCommentRequest {
    postId: string;
    content: string;
    authorId?: string;
}

export interface CreateCommentResponse {
    success: boolean;
    comment?: Comment;
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
                        lastName: 'Doe',
                        bio: 'Content creator and thought leader. Passionate about sharing knowledge and inspiring others.'
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

    async createComment(commentData: CreateCommentRequest): Promise<CreateCommentResponse> {
        try {
            if (config.MOCK_DATA) {
                await new Promise(resolve => setTimeout(resolve, 800));

                const mockComment: Comment = {
                    id: `mock-comment-${Date.now()}`,
                    postId: commentData.postId,
                    content: commentData.content,
                    createdAt: new Date().toISOString(),
                    author: {
                        id: parseInt(commentData.authorId || '1'),
                        username: 'Bob',
                        firstName: 'John',
                        lastName: 'Doe',
                        bio: 'Active community member who loves engaging in meaningful discussions.'
                    }
                };

                return {
                    success: true,
                    comment: mockComment,
                    message: 'Comment created successfully'
                };
            }

            const response = await fetch(`${this.baseUrl}/${commentData.postId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                    // 'Authorization': `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify({
                    content: commentData.content,
                    authorId: commentData.authorId
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return {
                success: true,
                comment: result.comment || result,
                message: result.message || 'Comment created successfully'
            };
        } catch (error) {
            console.error('Error creating comment:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'An unexpected error occurred'
            };
        }
    }
}

export const postsService = new PostsService();
export default postsService;
