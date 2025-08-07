import { Comment } from '../types/comment';
import { config } from '../config/config';

export interface CreatePostRequest {
    actor: string;
    content: string;
    media?: File;
}

export interface CreatePostResponse {
    success: boolean;
    activityId?: string;
    objectId?: string;
    actor?: string;
    content?: string;
    message?: string;
    error?: string;
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
        this.baseUrl = `${config.API_URL}/api/posts`;
    }

    async createPost(postData: CreatePostRequest, authToken?: string): Promise<CreatePostResponse> {
        try {
            if (config.MOCK_DATA) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                const mockActivityId = `mock-activity-${Date.now()}`;
                const mockObjectId = `mock-object-${Date.now()}`;

                return {
                    success: true,
                    activityId: mockActivityId,
                    objectId: mockObjectId,
                    actor: postData.actor,
                    content: postData.content,
                    message: 'Post created successfully'
                };
            }

            const headers: Record<string, string> = {};

            if (authToken) {
                headers.Authorization = `Bearer ${authToken}`;
            }

            let body: BodyInit;

            if (postData.media) {
                const formData = new FormData();
                formData.append('actor', postData.actor);
                formData.append('content', postData.content);
                formData.append('media', postData.media);

                body = formData;
            } else {
                headers['Content-Type'] = 'application/json';
                body = JSON.stringify({
                    actor: postData.actor,
                    content: postData.content
                });
            }

            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers,
                body
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return {
                success: result.success || true,
                activityId: result.activityId,
                objectId: result.objectId,
                actor: result.actor,
                content: result.content,
                message: result.message || 'Post created successfully'
            };
        } catch (error) {
            console.error('Error creating post:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'An unexpected error occurred'
            };
        }
    }

    async createComment(commentData: CreateCommentRequest): Promise<CreateCommentResponse> {
        try {
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
