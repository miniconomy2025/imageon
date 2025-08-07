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

interface PostProps extends React.HTMLAttributes<HTMLDivElement> {
    post: Post;
    author?: User;
    className?: string;
}

const PostCard: React.FC<PostProps> = ({ post, author, className = '', ...props }) => {
    const [isLiked, setIsLiked] = useState<boolean>(false);
    const [likeCount, setLikeCount] = useState<number>(post.likes ?? 0);
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
        navigate(Pages.postPage.replace(':id', post.id.toString()));
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
                <Avatar src={author?.avatar || undefined} alt={author?.username} fallbackText={author?.username} size='medium' />
                <div className='post__author-info'>
                    <h4
                        onClick={() => {
                            navigate(Pages.profilePage.replace(':username', author?.username ?? ''));
                        }}
                        className='post__author-name'>
                        {author?.username}
                    </h4>
                    {post.postedAt && <span className='post__timestamp'>{formatTime(post.postedAt)}</span>}
                </div>
            </div>
            <AttachmentCarousel attachments={post?.attachments || []} />

            <div className='post__content'>{post.content}</div>

            <div className='post__actions'>
                <Button variant='primary' size='small' onClick={() => navigate(Pages.postPage.replace(':id', post.id.toString()))} className={`post__action`}>
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
