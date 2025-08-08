import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useGetPost } from '../../hooks/useGetPost';
import { useUserFeed } from '../../hooks/useUserFeed';
import { useGetCurrentUser } from '../../hooks/useGetCurrentUser';
import { useCreateComment } from '../../hooks/useCreateComment';
import { useLikePost } from '../../hooks/useLikePost';
import { AttachmentCarousel } from '../../components/AttachmentCarousel/attachementCarousel';
import { Card, Button, Avatar } from '../../components';
import { useState, useEffect } from 'react';
import './postPage.css';

export const PostPage = () => {
    const params = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user: currentUser } = useGetCurrentUser();
    const [newComment, setNewComment] = useState('');
    const { createComment, isLoading: isCreatingComment, isSuccess } = useCreateComment();

    // Like functionality
    const [isLiked, setIsLiked] = useState<boolean>(false);
    const [likeCount, setLikeCount] = useState<number>(0);
    const { likePost, isLoading: isLikingPost } = useLikePost();

    const postUrl = searchParams.get('url');
    const postId = params.postId;

    if (!postId) {
        return <div>Error: Post ID is required</div>;
    }

    if (!postUrl) {
        return <div>Error: Post URL is required</div>;
    }

    const { data: post } = useGetPost(postUrl);
    const username = currentUser?.username;
    const { posts: feedPosts } = useUserFeed(username || '');

    // Find the post in the user feed by URL
    const feedPost = feedPosts?.find((p: any) => p.url === postUrl);

    useEffect(() => {
        if (post?.likes !== undefined) {
            setLikeCount(post.likes);
        } else if (feedPost?.likes !== undefined) {
            setLikeCount(feedPost.likes);
        }
    }, [post?.likes, feedPost?.likes]);

    useEffect(() => {
        if (isSuccess) {
            setNewComment('');
        }
    }, [isSuccess]);

    const handleLike = (): void => {
        if (isLikingPost || !post) return;

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

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newComment.trim() || !postId) {
            return;
        }

        try {
            createComment({
                postId: postId,
                content: newComment.trim()
            });
        } catch (error) {
            console.error('Error creating comment:', error);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCommentSubmit(e as any);
        }
    };

    // Use comments from the feed post if available, otherwise fallback to post.comments
    const comments = feedPost?.comments || post?.comments || [];

    return (
        <div className='post-page'>
            <div className='post-page__container'>
                <div className='post-page__header'>
                    <Button variant='secondary' onClick={() => navigate(-1)} className='post-page__back-btn'>
                        ← Back
                    </Button>
                </div>

                <Card className='post-page__main-card'>
                    <div className='post-page__author-section'>
                        <div className='post-page__author-info'>
                            <Avatar
                                src={post?.author?.icon?.url}
                                alt={post?.author?.preferredUsername || post?.author?.username}
                                fallbackText={post?.author?.preferredUsername || post?.author?.username || 'U'}
                            />
                            <div className='post-page__author-details'>
                                <h3 className='post-page__author-name'>{post?.author?.preferredUsername}</h3>
                                <p className='post-page__author-username'>@{post?.author?.username}</p>
                                <p className='post-page__post-date'>{post?.postedAt ? new Date(post.postedAt).toLocaleString() : ''}</p>
                            </div>
                        </div>
                    </div>

                    {post?.title && <h1 className='post-page__title'>{post.title}</h1>}

                    <div className='post-page__content'>
                        <p className='post-page__text'>{post?.content}</p>
                    </div>

                    {post?.attachments && post.attachments.length > 0 && (
                        <div className='post-page__attachments'>
                            <AttachmentCarousel attachments={post.attachments} />
                        </div>
                    )}
                    <div className='post-page__stats'>
                        <Button
                            variant='outline'
                            size='small'
                            onClick={handleLike}
                            className={`post-page__stat-button ${isLiked ? 'post-page__stat-button--liked' : ''}`}
                            disabled={isLikingPost}>
                            ❤️ {likeCount} likes
                        </Button>
                        <span className='post-page__stat'>💬 {comments.length} comments</span>
                    </div>
                </Card>
                <Card className='post-page__comment-creator'>
                    <h3 className='post-page__section-title'>Add a comment</h3>
                    <form onSubmit={handleCommentSubmit} className='comment-form'>
                        <div className='comment-form__input-section'>
                            <Avatar
                                src={currentUser?.icon?.url || undefined}
                                alt={currentUser?.preferredUsername || currentUser?.username || 'You'}
                                fallbackText={currentUser?.preferredUsername || currentUser?.username || 'You'}
                                size='small'
                            />
                            <div className='comment-form__input-container'>
                                <textarea
                                    className='comment-form__textarea'
                                    placeholder='What do you think about this post?'
                                    value={newComment}
                                    onChange={e => setNewComment(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    disabled={isCreatingComment}
                                    rows={3}
                                />
                                <div className='comment-form__actions'>
                                    <span className='comment-form__hint'>Press Enter to submit, Shift+Enter for new line</span>
                                    <Button type='submit' disabled={!newComment.trim() || isCreatingComment} size='small'>
                                        {isCreatingComment ? 'Posting...' : 'Post Comment'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </form>
                </Card>
                <Card className='post-page__comments-section'>
                    <h3 className='post-page__section-title'>Comments ({comments.length})</h3>

                    <div className='post-page__comments-list'>
                        {comments && comments.length > 0 ? (
                            comments.map((comment: any) => (
                                <div key={comment.id} className='comment-item'>
                                    <Avatar
                                        src={comment.author?.icon?.url}
                                        alt={comment.author?.username}
                                        fallbackText={comment.author?.username || 'U'}
                                        size='small'
                                    />
                                    <div className='comment-item__content'>
                                        <div className='comment-item__header'>
                                            <span className='comment-item__author'>{comment.author?.preferredUsername}</span>
                                            <span className='comment-item__username'>@{comment.author?.username}</span>
                                            <span className='comment-item__timestamp'>
                                                {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}
                                            </span>
                                        </div>
                                        <p className='comment-item__text'>{comment.content}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className='post-page__no-comments'>
                                <p>No comments yet. Be the first to share your thoughts!</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};
