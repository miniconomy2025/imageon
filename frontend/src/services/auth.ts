import { auth, googleProvider } from '../config/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';

const config = {
    API_BASE_URL: import.meta.env.VITE_API_URL
};
export interface UserProfile {
    uid: string;
    email: string;
    displayName?: string;
    username?: string;
    photoURL?: string;
    bio?: string;
    followersCount?: number;
    followingCount?: number;
    postsCount?: number;
    actorId?: string;
    needsProfile: boolean;
}

export interface CompleteProfileData {
    displayName: string;
    username: string;
    summary?: string;
}

class AuthService {
    // Sign in with Google
    async signInWithGoogle(): Promise<User> {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            return result.user;
        } catch (error) {
            console.error('Error signing in with Google:', error);
            throw error;
        }
    }

    // Sign out
    async signOut(): Promise<void> {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Error signing out:', error);
            throw error;
        }
    }

    // Verify token with backend
    async verifyToken(idToken: string): Promise<UserProfile> {
        try {
            const response = await fetch(`${config.API_BASE_URL}/auth/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ idToken })
            });

            const data = await response.json();

            if (!response.ok) {
                // Handle the case where user doesn't exist (needs profile completion)
                if (response.status === 404 && data.needsProfile) {
                    return {
                        uid: data.uid || '',
                        email: data.email || '',
                        needsProfile: true,
                        displayName: undefined,
                        username: undefined,
                        photoURL: undefined
                    };
                }
                throw new Error(data.error || 'Failed to verify token');
            }

            return data.user;
        } catch (error) {
            console.error('Error verifying token:', error);
            throw error;
        }
    }

    // Complete user profile
    async completeProfile(profileData: CompleteProfileData, idToken: string): Promise<UserProfile> {
        try {
            const response = await fetch(`${config.API_BASE_URL}/auth/complete-profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`
                },
                body: JSON.stringify(profileData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to complete profile');
            }

            return data.user;
        } catch (error) {
            console.error('Error completing profile:', error);
            throw error;
        }
    }

    // Get user profile
    async getProfile(idToken: string): Promise<UserProfile> {
        try {
            const response = await fetch(`${config.API_BASE_URL}/auth/profile`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${idToken}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to get profile');
            }

            return data.user;
        } catch (error) {
            console.error('Error getting profile:', error);
            throw error;
        }
    }

    // Get current user (Firebase + Backend profile)
    async getCurrentUser(): Promise<UserProfile | null> {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                return null;
            }

            const idToken = await currentUser.getIdToken();
            return await this.getProfile(idToken);
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    }

    // Get logged in user (full profile from DynamoDB)
    async getLoggedInUser(): Promise<UserProfile | null> {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                return null;
            }

            const idToken = await currentUser.getIdToken();
            const response = await fetch(`${config.API_BASE_URL}/auth/user/logged-in`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${idToken}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to get logged in user');
            }

            return data.user;
        } catch (error) {
            console.error('Error getting logged in user:', error);
            return null;
        }
    }

    // Get user posts
    async getUserPosts(): Promise<any[]> {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                throw new Error('No user logged in');
            }

            const idToken = await currentUser.getIdToken();
            const response = await fetch(`${config.API_BASE_URL}/auth/user/posts`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${idToken}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to get user posts');
            }

            return data.posts;
        } catch (error) {
            console.error('Error getting user posts:', error);
            throw error;
        }
    }

    // Get user followers
    async getFollowers(): Promise<any[]> {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                throw new Error('No user logged in');
            }

            const idToken = await currentUser.getIdToken();
            const response = await fetch(`${config.API_BASE_URL}/auth/user/followers`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${idToken}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to get followers');
            }

            return data.followers;
        } catch (error) {
            console.error('Error getting followers:', error);
            throw error;
        }
    }

    // Get user following
    async getFollowing(): Promise<any[]> {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                throw new Error('No user logged in');
            }

            const idToken = await currentUser.getIdToken();
            const response = await fetch(`${config.API_BASE_URL}/auth/user/following`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${idToken}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to get following');
            }

            return data.following;
        } catch (error) {
            console.error('Error getting following:', error);
            throw error;
        }
    }

    // Get user by ID
    async getUserById(userId: string): Promise<UserProfile | null> {
        try {
            const response = await fetch(`${config.API_BASE_URL}/auth/user/by-id?userId=${encodeURIComponent(userId)}`, {
                method: 'GET'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to get user');
            }

            return data.user;
        } catch (error) {
            console.error('Error getting user by ID:', error);
            return null;
        }
    }

    // Update user profile
    async updateProfile(updates: Partial<UserProfile>, idToken: string): Promise<void> {
        try {
            const response = await fetch(`${config.API_BASE_URL}/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`
                },
                body: JSON.stringify(updates)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update profile');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
    }

    // Check username availability
    async checkUsername(username: string): Promise<boolean> {
        try {
            const response = await fetch(`${config.API_BASE_URL}/auth/check-username?username=${encodeURIComponent(username)}`, {
                method: 'GET'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to check username');
            }

            return data.isAvailable;
        } catch (error) {
            console.error('Error checking username:', error);
            throw error;
        }
    }

    // Listen to auth state changes
    onAuthStateChanged(callback: (user: User | null) => void) {
        return onAuthStateChanged(auth, callback);
    }
}

export const authService = new AuthService();
