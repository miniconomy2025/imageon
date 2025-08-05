export type Comment = {
    id: string;
    postId?: string;
    author: {
        id?: string;
        firstName?: string;
        lastName?: string;
        username?: string;
        avatar?: string;
    };
    content: string;
    createdAt?: string;
};
