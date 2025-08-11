import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';
import { AuthService, UserProfile, CompleteProfileData } from '../services/authService';

interface AuthContextType {
    currentUser: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    completeProfile: (profileData: CompleteProfileData) => Promise<void>;
    checkUsername: (username: string) => Promise<boolean>;
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
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const verifyTokenWithBackend = async (user: User) => {
        try {
            const idToken = await user.getIdToken();
            const authResponse = await AuthService.verifyToken(idToken);

            if (authResponse.needsProfile) {
                // User needs to complete their profile
                setUserProfile({
                    uid: user.uid,
                    email: user.email || '',
                    displayName: user.displayName || '',
                    username: '',
                    photoURL: user.photoURL || '',
                    needsProfile: true,
                    url: authResponse.user.url || ''
                });
            } else {
                // User profile is complete
                setUserProfile(authResponse.user);
            }
        } catch (error: any) {
            console.error('Error verifying token with backend:', error);

            // Check if the error is specifically about user not found (404)
            if (error.message && error.message.includes('User not found')) {
                // User exists in Firebase but not in backend - needs profile completion
                setUserProfile({
                    uid: user.uid,
                    email: user.email || '',
                    displayName: user.displayName || '',
                    username: '',
                    photoURL: user.photoURL || '',
                    needsProfile: true,
                    url: ''
                });
            } else {
                // For other errors, still assume user needs to complete profile
                setUserProfile({
                    uid: user.uid,
                    email: user.email || '',
                    displayName: user.displayName || '',
                    username: '',
                    photoURL: user.photoURL || '',
                    needsProfile: true,
                    url: ''
                });
            }
        }
    };

    const signInWithGoogle = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);

            // Verify token with backend
            await verifyTokenWithBackend(result.user);
        } catch (error) {
            console.error('Google sign-in error:', error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            setUserProfile(null);
        } catch (error) {
            throw error;
        }
    };

    const completeProfile = async (profileData: CompleteProfileData) => {
        if (!currentUser) {
            throw new Error('No user logged in');
        }

        try {
            const idToken = await currentUser.getIdToken();
            const authResponse = await AuthService.completeProfile(idToken, profileData);
            setUserProfile(authResponse.user);
        } catch (error) {
            console.error('Error completing profile:', error);
            throw error;
        }
    };

    const checkUsername = async (username: string): Promise<boolean> => {
        try {
            const response = await AuthService.checkUsername(username);
            return response.isAvailable;
        } catch (error) {
            console.error('Error checking username:', error);
            return false;
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async user => {
            setCurrentUser(user);

            if (user) {
                // Verify token with backend when user signs in
                await verifyTokenWithBackend(user);
            } else {
                setUserProfile(null);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value: AuthContextType = {
        currentUser,
        userProfile,
        loading,
        signInWithGoogle,
        logout,
        completeProfile,
        checkUsername
    };

    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};
