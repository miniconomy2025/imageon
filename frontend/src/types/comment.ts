import { User } from './user';

export type Comment = {
    id: string;
    postId?: string;
    author: User;
    content: string;
    createdAt?: string;
};
