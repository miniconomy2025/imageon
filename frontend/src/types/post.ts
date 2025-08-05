import { User } from "./user";

export type Post = {
    id: number;
    title?: string;
    content?: string;
    author?: User;
    postedAt?: string;
    likes?: number;
    shares?: number;
    comments?: number;
    attachments?: string[];
};