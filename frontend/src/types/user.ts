export type User = {
    id: number;
    username: string;
    bio?: string;
    name?: string;
    preferredUsername?: string;
    summary?: string;
    url?: string;
    icon?: {
        type: string;
        url: string;
    };
    type?: string;
    inbox?: string;
    outbox?: string;
    followers?: string;
    following?: string;
    published?: string;
    followers_count?: number;
    following_count?: number;
    handle?: string;
};
