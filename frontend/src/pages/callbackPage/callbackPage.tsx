import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../api/authService';
import config from '../../../config.json';
import './callbackPage.css';

export const CallbackPage = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [searchParams] = useSearchParams();
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(true);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                const code = searchParams.get('code');
                const state = searchParams.get('state');
                const error = searchParams.get('error');

                if (error) {
                    throw new Error(`OAuth error: ${error}`);
                }

                if (!code) {
                    throw new Error('No authorization code received');
                }

                const result = await authService.handleGoogleCallback(code, state || undefined);

                if (result.success && result.user && result.token) {
                    login(result.user, result.token);

                    const redirectPath = state ? decodeURIComponent(state) : config.AUTH.DEFAULT_REDIRECT;

                    navigate(redirectPath, { replace: true });
                } else {
                    throw new Error(result.message || 'Authentication failed');
                }
            } catch (err) {
                console.error('OAuth callback error:', err);
                setError(err instanceof Error ? err.message : 'Authentication failed');
                setIsProcessing(false);
            }
        };

        handleCallback();
    }, [searchParams, login, navigate]);

    const handleRetry = () => {
        setError(null);
        setIsProcessing(true);
        // Redirect back to Google OAuth
        authService.redirectToGoogleAuth();
    };

    const handleGoHome = () => {
        navigate(config.AUTH.DEFAULT_REDIRECT);
    };

    if (isProcessing) {
        return (
            <div className='callback-page'>
                <div className='callback-page__container'>
                    <div className='callback-page__spinner'></div>
                    <h2>Completing sign in...</h2>
                    <p>Please wait while we finish setting up your account.</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className='callback-page'>
                <div className='callback-page__container'>
                    <div className='callback-page__error'>
                        <h2>Sign in failed</h2>
                        <p>{error}</p>
                        <div className='callback-page__actions'>
                            <button onClick={handleRetry} className='callback-page__button callback-page__button--primary'>
                                Try Again
                            </button>
                            <button onClick={handleGoHome} className='callback-page__button callback-page__button--secondary'>
                                Go Home
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};
