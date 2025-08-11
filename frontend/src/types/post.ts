import { User } from './user';
import { Comment } from './comment';
import { Attachment } from './attachment';

export type Post = {
    id: string;
    title?: string;
    content?: string;
    author?: User;
    postedAt?: string;
    likes?: number;
    likeCount?: number;
    userLiked?: boolean;
    comments?: Comment[];
    attachments?: Attachment[];
    url?: string;
};
