import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../api/authService';
import './ProtectedRoute.css';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const location = useLocation();

    useEffect(() => {
        if (!isAuthenticated) {
            // Store the current path so we can redirect back after login
            const returnPath = location.pathname + location.search;

            // Redirect to Google OAuth
            authService.redirectToGoogleAuth(returnPath);
        }
    }, [isAuthenticated, location]);

    // Show loading state while checking auth or redirecting
    if (!isAuthenticated) {
        return (
            <div className='auth-loading'>
                <div className='auth-loading__container'>
                    <div className='auth-loading__spinner'></div>
                    <p>Redirecting to login...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
