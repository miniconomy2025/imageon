import React, { useState } from 'react';
import Avatar from '../Avatar/Avatar';
import Button from '../Button/Button';
import './Post.css';
import { useNavigate } from 'react-router-dom';
import { Pages } from '../../pages/pageRouting';
import { AttachmentCarousel } from '../AttachmentCarousel/attachementCarousel';
import { Post } from '../../types/post';
import { useLikePost } from '../../hooks/useLikePost';
import { User } from '../../types/user';
import DOMPurify from 'dompurify';

interface PostProps extends React.HTMLAttributes<HTMLDivElement> {
    post: Post;
    author?: User;
    className?: string;
}

const PostCard: React.FC<PostProps> = ({ post, author, className = '', ...props }) => {
    //Sanitize HTML content
    const sanitizeHtml = (html: string) => {
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div'],
            ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
            ALLOW_DATA_ATTR: false,
            KEEP_CONTENT: true
        });
    };

    // Helper to extract domain from author
    const getAuthorDomain = (author?: User) => {
        if (author?.handle) {
            const parts = author.handle.split('@');
            return parts.length > 1 ? parts[parts.length - 1] : 'unknown';
        }
        if (author?.url) {
            try {
                return new URL(author.url).hostname;
            } catch {
                return 'unknown';
            }
        }
        return 'unknown';
    };

    // Helper to extract domain, username, and postId from post URL
    const getPostPagePath = () => {
        const postUrl = post.url || '';

        // Expected format: https://domain.com/users/username/posts/postId
        // Alternative format: https://domain.com/posts/postId (need to get username from author)
        try {
            const url = new URL(postUrl);
            const domain = url.hostname;
            const pathParts = url.pathname.split('/');

            const usersIndex = pathParts.findIndex(part => part === 'users');
            const postsIndex = pathParts.findIndex(part => part === 'posts');

            let username: string;
            let postId: string;

            if (usersIndex !== -1 && postsIndex !== -1 && usersIndex + 1 < pathParts.length && postsIndex + 1 < pathParts.length) {
                // Format: /users/username/posts/postId
                username = pathParts[usersIndex + 1];
                postId = pathParts[postsIndex + 1];
            } else if (postsIndex !== -1 && postsIndex + 1 < pathParts.length) {
                // Format: /posts/postId - get username from author
                postId = pathParts[postsIndex + 1];
                username = author?.username || 'unknown';
            } else {
                throw new Error('Unable to parse post URL structure');
            }
            return `/${domain}/${username}/posts/${postId}`;
        } catch (error) {}

        // Fallback to main if parsing fails
        return Pages.mainPage;
    };
    const [isLiked, setIsLiked] = useState<boolean>(post.userLiked ?? false);
    const [likeCount, setLikeCount] = useState<number>(post.likeCount ?? 0);
    const { likePost, isLoading } = useLikePost();
    const navigate = useNavigate();

    const handleLike = (): void => {
        if (isLoading) return;

        const currentLikedState = isLiked;
        const newLikedState = !isLiked;

        setIsLiked(newLikedState);
        setLikeCount(prev => (currentLikedState ? prev - 1 : prev + 1));

        likePost(
            {
                postId: post.id,
                isLiked: currentLikedState
            },
            {
                onError: () => {
                    setIsLiked(currentLikedState);
                    setLikeCount(prev => (currentLikedState ? prev + 1 : prev - 1));
                }
            }
        );
    };

    const handleComment = (): void => {
        navigate(getPostPagePath());
    };

    const formatTime = (date: Date | string): string => {
        const now = new Date();
        const diff = now.getTime() - new Date(date).getTime();
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m`;
        if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
        return `${Math.floor(minutes / 1440)}d`;
    };

    return (
        <div className={`post ${className}`} {...props}>
            <div className='post__header'>
                <Avatar src={author?.icon?.url || undefined} alt={author?.username} fallbackText={author?.username} size='medium' />
                <div className='post__author-info'>
                    <h4
                        onClick={() => {
                            const domain = getAuthorDomain(author);
                            const username = author?.username ?? '';
                            navigate(Pages.profilePage.replace(':domain', domain).replace(':username', username));
                        }}
                        className='post__author-name'>
                        {author?.username}
                    </h4>
                    {post.postedAt && <span className='post__timestamp'>{formatTime(post.postedAt)}</span>}
                </div>
            </div>
            <AttachmentCarousel attachments={post?.attachments || []} />

            <div
                className='post__content'
                dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(post.content || '')
                }}
            />

            <div className='post__actions'>
                <Button variant='primary' size='small' onClick={() => navigate(getPostPagePath())} className={`post__action`}>
                    Open
                </Button>
                <Button variant='outline' size='small' onClick={handleLike} className={`post__action ${isLiked ? 'post__action--liked' : ''}`}>
                    ❤️ {likeCount}
                </Button>
                <Button variant='outline' size='small' onClick={handleComment} className='post__action'>
                    💬 {post.comments?.length}
                </Button>
            </div>
        </div>
    );
};

export default PostCard;
