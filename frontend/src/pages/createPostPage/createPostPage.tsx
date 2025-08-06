import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetCurrentUser } from '../../hooks/useGetCurrentUser';
import { useCreatePost } from '../../hooks/useCreatePost';
import { Card, Button, Input } from '../../components';
import './createPostPage.css';

export const CreatePostPage = () => {
    const navigate = useNavigate();
    const { user: currentUser } = useGetCurrentUser();
    const createPostMutation = useCreatePost();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [attachments, setAttachments] = useState<string[]>([]);

    const isSubmitting = createPostMutation.isPending;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!content.trim()) {
            alert('Post content is required');
            return;
        }

        const postData = {
            title: title.trim() || undefined,
            content: content.trim(),
            attachments: attachments.filter(url => url.trim() !== ''),
            postedAt: new Date().toISOString()
        };

        try {
            const result = await createPostMutation.mutateAsync(postData);

            if (result.success) {
                navigate('/');
            } else {
                throw new Error(result.message || 'Failed to create post');
            }
        } catch (error) {
            console.error('Error creating post:', error);
            alert(error instanceof Error ? error.message : 'Failed to create post. Please try again.');
        }
    };

    const handleAddAttachment = () => {
        const url = prompt('Enter image URL:');
        if (url && url.trim()) {
            setAttachments(prev => [...prev, url.trim()]);
        }
    };

    const handleRemoveAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleCancel = () => {
        if (content.trim() || title.trim() || attachments.length > 0) {
            const confirmed = window.confirm('Are you sure you want to discard this post?');
            if (confirmed) {
                navigate(-1);
            }
        } else {
            navigate(-1);
        }
    };

    if (!currentUser) {
        return (
            <div className='create-post-page'>
                <Card className='create-post-page__error'>
                    <p>You must be logged in to create a post.</p>
                    <Button onClick={() => navigate('/')}>Go Home</Button>
                </Card>
            </div>
        );
    }

    return (
        <div className='create-post-page'>
            <div className='create-post-page__header'>
                <h1>Create New Post</h1>
                <Button variant='secondary' onClick={handleCancel} disabled={isSubmitting}>
                    Cancel
                </Button>
            </div>

            <Card className='create-post-page__content'>
                <form onSubmit={handleSubmit} className='create-post-form'>
                    <div className='create-post-form__field'>
                        <Input
                            type='text'
                            placeholder='Post title (optional)'
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className='create-post-form__title'
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className='create-post-form__field'>
                        <label htmlFor='post-content'>Post Content *</label>
                        <textarea
                            id='post-content'
                            className='create-post-form__content'
                            placeholder="What's on your mind?"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            rows={6}
                            disabled={isSubmitting}
                            required
                        />
                    </div>

                    <div className='create-post-form__field'>
                        <div className='create-post-form__attachments'>
                            <div className='create-post-form__attachments-header'>
                                <h3>Attachments</h3>
                                <Button type='button' variant='secondary' size='small' onClick={handleAddAttachment} disabled={isSubmitting}>
                                    Add Image URL
                                </Button>
                            </div>

                            {attachments.length > 0 && (
                                <div className='create-post-form__attachments-list'>
                                    {attachments.map((url, index) => (
                                        <div key={index} className='attachment-item'>
                                            <img
                                                src={url}
                                                alt={`Attachment ${index + 1}`}
                                                className='attachment-item__preview'
                                                onError={e => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                            <div className='attachment-item__info'>
                                                <span className='attachment-item__url'>{url}</span>
                                                <Button
                                                    type='button'
                                                    variant='secondary'
                                                    size='small'
                                                    onClick={() => handleRemoveAttachment(index)}
                                                    disabled={isSubmitting}>
                                                    Remove
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className='create-post-form__actions'>
                        <Button type='button' variant='secondary' onClick={handleCancel} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type='submit' disabled={!content.trim() || isSubmitting}>
                            {isSubmitting ? 'Creating...' : 'Create Post'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};
