import { useNavigate, useParams } from 'react-router-dom';
import { useGetPost } from '../../hooks/useGetPost';
import { useGetCurrentUser } from '../../hooks/useGetCurrentUser';
import { useCreateComment } from '../../hooks/useCreateComment';
import { AttachmentCarousel } from '../../components/AttachmentCarousel/attachementCarousel';
import { Card, Button, Avatar } from '../../components';
import { useState } from 'react';
import './postPage.css';

export const PostPage = () => {
    const params = useParams();
    const navigate = useNavigate();
    const { user: currentUser } = useGetCurrentUser();
    const [newComment, setNewComment] = useState('');
    const createCommentMutation = useCreateComment();

    if (!params.postId || params.postId === '' || params.postId === undefined) {
        navigate('/'); // Redirect to home if postId is not provided
    }

    const { data: post } = useGetPost(params.postId ?? '');

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newComment.trim() || !params.postId) {
            return;
        }

        try {
            const result = await createCommentMutation.mutateAsync({
                postId: params.postId,
                content: newComment.trim(),
                authorId: currentUser?.id?.toString() || '1'
            });

            if (result.success) {
                setNewComment('');
            } else {
                throw new Error(result.message || 'Failed to create comment');
            }
        } catch (error) {
            console.error('Error creating comment:', error);
            alert('Failed to create comment. Please try again.');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCommentSubmit(e as any);
        }
    };

    return (
        <div className='post-page'>
            <div className='post-page__container'>
                {/* Header with back button */}
                <div className='post-page__header'>
                    <Button variant='secondary' onClick={() => navigate(-1)} className='post-page__back-btn'>
                        ← Back
                    </Button>
                </div>

                {/* Main post content */}
                <Card className='post-page__main-card'>
                    {/* Post author info */}
                    <div className='post-page__author-section'>
                        <div className='post-page__author-info'>
                            <Avatar
                                src={post?.author?.avatar}
                                alt={post?.author?.firstName || post?.author?.username}
                                fallbackText={post?.author?.firstName || post?.author?.username || 'U'}
                            />
                            <div className='post-page__author-details'>
                                <h3 className='post-page__author-name'>
                                    {post?.author?.firstName} {post?.author?.lastName}
                                </h3>
                                <p className='post-page__author-username'>@{post?.author?.username}</p>
                                <p className='post-page__post-date'>{post?.postedAt ? new Date(post.postedAt).toLocaleString() : ''}</p>
                            </div>
                        </div>
                    </div>

                    {/* Post title */}
                    {post?.title && <h1 className='post-page__title'>{post.title}</h1>}

                    {/* Post content */}
                    <div className='post-page__content'>
                        <p className='post-page__text'>{post?.content}</p>
                    </div>

                    {/* Attachments */}
                    {post?.attachments && post.attachments.length > 0 && (
                        <div className='post-page__attachments'>
                            <AttachmentCarousel attachments={post.attachments} />
                        </div>
                    )}

                    {/* Post stats */}
                    <div className='post-page__stats'>
                        <span className='post-page__stat'>❤️ {post?.likes || 0} likes</span>
                        <span className='post-page__stat'>💬 {post?.comments?.length || 0} comments</span>
                    </div>
                </Card>

                {/* Comment creation section */}
                <Card className='post-page__comment-creator'>
                    <h3 className='post-page__section-title'>Add a comment</h3>
                    <form onSubmit={handleCommentSubmit} className='comment-form'>
                        <div className='comment-form__input-section'>
                            <Avatar
                                src={currentUser?.avatar}
                                alt={currentUser?.firstName || currentUser?.username}
                                fallbackText={currentUser?.firstName || currentUser?.username || 'You'}
                                size='small'
                            />
                            <div className='comment-form__input-container'>
                                <textarea
                                    className='comment-form__textarea'
                                    placeholder='What do you think about this post?'
                                    value={newComment}
                                    onChange={e => setNewComment(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    disabled={createCommentMutation.isPending}
                                    rows={3}
                                />
                                <div className='comment-form__actions'>
                                    <span className='comment-form__hint'>Press Enter to submit, Shift+Enter for new line</span>
                                    <Button type='submit' disabled={!newComment.trim() || createCommentMutation.isPending} size='small'>
                                        {createCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </form>
                </Card>

                {/* Comments section */}
                <Card className='post-page__comments-section'>
                    <h3 className='post-page__section-title'>Comments ({post?.comments?.length || 0})</h3>

                    <div className='post-page__comments-list'>
                        {post?.comments && post.comments.length > 0 ? (
                            post.comments.map(comment => (
                                <div key={comment.id} className='comment-item'>
                                    <Avatar
                                        src={comment.author?.avatar}
                                        alt={comment.author?.firstName || comment.author?.username}
                                        fallbackText={comment.author?.firstName || comment.author?.username || 'U'}
                                        size='small'
                                    />
                                    <div className='comment-item__content'>
                                        <div className='comment-item__header'>
                                            <span className='comment-item__author'>
                                                {comment.author?.firstName} {comment.author?.lastName}
                                            </span>
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
