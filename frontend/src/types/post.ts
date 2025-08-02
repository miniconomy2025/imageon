export type Post = {
    id: number;
    title: string;
    content: string;
    author: string;
    postedAt: string;
    attachments?: string[];
};