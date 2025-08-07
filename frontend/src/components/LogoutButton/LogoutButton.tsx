import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import './LogoutButton.css';

export const LogoutButton: React.FC = () => {
    const { logout, currentUser } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    if (!currentUser) {
        return null;
    }

    return (
        <button className='logout-button' onClick={handleLogout}>
            <svg className='logout-icon' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                <path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' />
                <polyline points='16,17 21,12 16,7' />
                <line x1='21' y1='12' x2='9' y2='12' />
            </svg>
            Logout
        </button>
    );
};
