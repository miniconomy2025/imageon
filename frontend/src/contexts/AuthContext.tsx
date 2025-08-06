import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService, AuthState } from '../api/authService';
import { User } from '../types/user';

interface AuthContextType extends AuthState {
    login: (user: User, token: string) => void;
    logout: () => void;
    updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [authState, setAuthState] = useState<AuthState>(() => {
        // Initialize from localStorage
        return authService.getAuthState();
    });

    const login = (user: User, token: string) => {
        setAuthState({
            isAuthenticated: true,
            user,
            token
        });
    };

    const logout = () => {
        authService.logout();
        setAuthState({
            isAuthenticated: false,
            user: null,
            token: null
        });
    };

    const updateUser = (user: User) => {
        if (authState.isAuthenticated) {
            setAuthState(prev => ({
                ...prev,
                user
            }));
            // Update localStorage
            localStorage.setItem('imageon_user', JSON.stringify(user));
        }
    };

    // Listen for storage changes (e.g., logout in another tab)
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'imageon_auth_token' || e.key === 'imageon_user') {
                const newAuthState = authService.getAuthState();
                setAuthState(newAuthState);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const value: AuthContextType = {
        ...authState,
        login,
        logout,
        updateUser
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
