import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './ProtectedRoute.css';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { currentUser, userProfile, loading } = useAuth();

    if (loading) {
        return (
            <div className='auth-loading'>
                <div className='auth-loading__container'>
                    <div className='auth-loading__spinner'></div>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        return <Navigate to='/login' replace />;
    }

    // If user needs to complete their profile, redirect them to complete profile
    if (userProfile?.needsProfile) {
        return <Navigate to='/complete-profile' replace />;
    }

    return <>{children}</>;
};
