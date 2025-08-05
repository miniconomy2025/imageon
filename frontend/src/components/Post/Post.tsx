import React, { useState } from 'react';
import Avatar from '../Avatar/Avatar';
import Button from '../Button/Button';
import './Post.css';
import { useNavigate } from 'react-router-dom';
import { Pages } from '../../pages/pageRouting';
import { AttachmentCarousel } from '../AttachmentCarousel/attachementCarousel';
import { Post } from '../../types/post';

interface PostProps extends React.HTMLAttributes<HTMLDivElement> {
    post: Post;
    onLike?: (liked: boolean) => void;
    onComment?: () => void;
    onShare?: () => void;
    className?: string;
}

const PostCard: React.FC<PostProps> = ({ post, onLike, onComment, onShare, className = '', ...props }) => {
    const [isLiked, setIsLiked] = useState<boolean>(false);
    const [likeCount, setLikeCount] = useState<number>(post.likes ?? 0);

    const navigate = useNavigate();

    const handleLike = (): void => {
        setIsLiked(!isLiked);
        setLikeCount(prev => (isLiked ? prev - 1 : prev + 1));
        onLike && onLike(!isLiked);
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
                <Avatar src={post.author?.avatar || undefined} alt={post.author?.firstName} fallbackText={post.author?.firstName} size='medium' />
                <div className='post__author-info'>
                    <h4
                        onClick={() => {
                            navigate(Pages.profilePage.replace(':username', post.author?.firstName ?? ''));
                        }}
                        className='post__author-name'>
                        {post.author?.firstName}
                    </h4>
                    {post.postedAt && <span className='post__timestamp'>{formatTime(post.postedAt)}</span>}
                </div>
            </div>
            <AttachmentCarousel attachments={post?.attachments || []} />

            <div className='post__content'>{post.content}</div>

            <div className='post__actions'>
                <Button variant='outline' size='small' onClick={handleLike} className={`post__action ${isLiked ? 'post__action--liked' : ''}`}>
                    ❤️ {likeCount}
                </Button>

                <Button variant='outline' size='small' onClick={onShare} className='post__action'>
                    📤 {post.shares}
                </Button>
            </div>
        </div>
    );
};

export default PostCard;
