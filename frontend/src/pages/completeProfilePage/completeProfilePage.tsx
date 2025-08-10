import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './completeProfilePage.css';
import LoaderDots from '../../components/LoaderDots';

export const CompleteProfilePage: React.FC = () => {
    const { currentUser, userProfile, completeProfile, checkUsername, loading } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        displayName: userProfile?.displayName || '',
        username: '',
        summary: ''
    });

    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [submitting, setSubmitting] = useState(false);
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
    const [checkingUsername, setCheckingUsername] = useState(false);

    useEffect(() => {
        // If not loading and no current user, redirect to login
        if (!loading && !currentUser) {
            navigate('/login');
            return;
        }

        // If user already has a complete profile, redirect to home
        if (!loading && userProfile && !userProfile.needsProfile) {
            navigate('/');
            return;
        }

        // If user is authenticated but doesn't need profile completion, redirect to home
        if (!loading && currentUser && userProfile && !userProfile.needsProfile) {
            navigate('/');
            return;
        }
    }, [currentUser, userProfile, loading, navigate]);

    const validateForm = () => {
        const newErrors: { [key: string]: string } = {};

        if (!formData.displayName.trim()) {
            newErrors.displayName = 'Display name is required';
        }

        if (!formData.username.trim()) {
            newErrors.username = 'Username is required';
        } else if (formData.username.length < 3) {
            newErrors.username = 'Username must be at least 3 characters';
        } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
            newErrors.username = 'Username can only contain letters, numbers, and underscores';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleUsernameChange = async (username: string) => {
        setFormData(prev => ({ ...prev, username }));
        setErrors(prev => ({ ...prev, username: '' }));
        setUsernameAvailable(null);

        if (username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username)) {
            setCheckingUsername(true);
            try {
                const isAvailable = await checkUsername(username);
                setUsernameAvailable(isAvailable);
                if (!isAvailable) {
                    setErrors(prev => ({ ...prev, username: 'Username is already taken' }));
                }
            } catch (error) {
                console.error('Error checking username:', error);
                setErrors(prev => ({ ...prev, username: 'Error checking username availability' }));
            } finally {
                setCheckingUsername(false);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        if (usernameAvailable === false) {
            setErrors(prev => ({ ...prev, username: 'Username is already taken' }));
            return;
        }

        setSubmitting(true);
        try {
            await completeProfile({
                displayName: formData.displayName.trim(),
                username: formData.username.trim(),
                summary: formData.summary.trim()
            });
            navigate('/');
        } catch (error) {
            console.error('Error completing profile:', error);
            setErrors({ submit: 'Failed to complete profile. Please try again.' });
        } finally {
            setSubmitting(false);
        }
    };

    // Show loading while checking authentication state
    if (loading) {
        return (
            <div className='complete-profile-page'>
                <div className='complete-profile-container'>
                    <div className='complete-profile-card'>
                        <LoaderDots />
                    </div>
                </div>
            </div>
        );
    }

    // Don't show the form if user is not authenticated or doesn't need profile completion
    if (!currentUser || !userProfile || !userProfile.needsProfile) {
        return null;
    }

    return (
        <div className='complete-profile-page'>
            <div className='complete-profile-container'>
                <div className='complete-profile-card'>
                    <h1>Complete Your Profile</h1>
                    <p>Please provide some additional information to complete your account setup</p>

                    {errors.submit && <div className='error-message'>{errors.submit}</div>}

                    <form onSubmit={handleSubmit} className='profile-form'>
                        <div className='form-group'>
                            <label htmlFor='displayName'>Display Name *</label>
                            <input
                                type='text'
                                id='displayName'
                                value={formData.displayName}
                                onChange={e => {
                                    setFormData(prev => ({ ...prev, displayName: e.target.value }));
                                    setErrors(prev => ({ ...prev, displayName: '' }));
                                }}
                                className={errors.displayName ? 'error' : ''}
                                placeholder='Enter your display name'
                            />
                            {errors.displayName && <span className='error-text'>{errors.displayName}</span>}
                        </div>

                        <div className='form-group'>
                            <label htmlFor='username'>Username *</label>
                            <div className='username-input-container'>
                                <input
                                    type='text'
                                    id='username'
                                    value={formData.username}
                                    onChange={e => handleUsernameChange(e.target.value)}
                                    className={errors.username ? 'error' : ''}
                                    placeholder='Enter your username'
                                />
                                {checkingUsername && <div className='checking-spinner'></div>}
                                {usernameAvailable === true && <div className='username-available'>✓ Available</div>}
                                {usernameAvailable === false && <div className='username-taken'>✗ Taken</div>}
                            </div>
                            {errors.username && <span className='error-text'>{errors.username}</span>}
                        </div>

                        <div className='form-group'>
                            <label htmlFor='summary'>Bio (Optional)</label>
                            <textarea
                                id='summary'
                                value={formData.summary}
                                onChange={e => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                                placeholder='Tell us about yourself...'
                                rows={3}
                            />
                        </div>

                        <button type='submit' className='complete-profile-button' disabled={submitting || checkingUsername || usernameAvailable === false}>
                            {submitting ? <div className='loading-spinner'></div> : 'Complete Profile'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
