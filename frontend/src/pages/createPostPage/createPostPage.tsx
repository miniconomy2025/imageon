import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetCurrentUser } from '../../hooks/useGetCurrentUser';
import { useCreatePost } from '../../hooks/useCreatePost';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button } from '../../components';
import './createPostPage.css';

export const CreatePostPage = () => {
    const navigate = useNavigate();
    const { user: currentUser } = useGetCurrentUser();
    const { userProfile } = useAuth();
    const createPostMutation = useCreatePost();
    const [content, setContent] = useState('');
    const [files, setFiles] = useState<File[]>([]);

    const isSubmitting = createPostMutation.isPending;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!content.trim()) {
            alert('Post content is required');
            return;
        }

        if (!userProfile?.username) {
            alert('User profile not found. Please ensure you are logged in.');
            return;
        }

        const postData = {
            content: content.trim(),
            files: files.length > 0 ? files : undefined
        };

        try {
            const result = await createPostMutation.mutateAsync(postData);

            if (result.success) {
                navigate('/');
            } else {
                throw new Error(result.error || result.message || 'Failed to create post');
            }
        } catch (error) {
            console.error('Error creating post:', error);
            alert(error instanceof Error ? error.message : 'Failed to create post. Please try again.');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 50 * 1024 * 1024) {
                alert('File size must be less than 50MB');
                return;
            }

            // Check file type (images and videos)
            if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
                alert('Only image and video files are supported');
                return;
            }

            setFiles([file]); // Replace existing file with new one
        }
    };

    const handleRemoveFile = () => {
        setFiles([]);
        // Reset the file input
        const fileInput = document.getElementById('media-upload') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
    };

    const handleCancel = () => {
        if (content.trim() || files.length > 0) {
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
                        <div className='create-post-form__media'>
                            <div className='create-post-form__media-header'>
                                <h3>Media Upload</h3>
                                <label htmlFor='media-upload' className='create-post-form__upload-button'>
                                    <span
                                        className='create-post-form__upload-label'
                                        style={{
                                            display: 'inline-block',
                                            padding: '8px 16px',
                                            backgroundColor: '#f0f0f0',
                                            border: '1px solid #ccc',
                                            borderRadius: '4px',
                                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                            opacity: isSubmitting ? 0.6 : 1
                                        }}>
                                        Choose File
                                    </span>
                                </label>
                                <input
                                    id='media-upload'
                                    type='file'
                                    accept='image/*,video/*'
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                    disabled={isSubmitting}
                                />
                            </div>

                            {files.length > 0 && (
                                <div className='create-post-form__media-preview'>
                                    <div className='media-preview-item'>
                                        {files[0].type.startsWith('image/') ? (
                                            <img src={URL.createObjectURL(files[0])} alt='Media preview' className='media-preview-item__image' />
                                        ) : (
                                            <video src={URL.createObjectURL(files[0])} controls className='media-preview-item__video' />
                                        )}
                                        <div className='media-preview-item__info'>
                                            <span className='media-preview-item__name'>{files[0].name}</span>
                                            <span className='media-preview-item__size'>{(files[0].size / 1024 / 1024).toFixed(2)} MB</span>
                                            <Button type='button' variant='secondary' size='small' onClick={handleRemoveFile} disabled={isSubmitting}>
                                                Remove
                                            </Button>
                                        </div>
                                    </div>
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
