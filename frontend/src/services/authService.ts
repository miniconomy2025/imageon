import { config } from '../config/config';
export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    username: string;
    photoURL: string;
    bio?: string;
    needsProfile: boolean;
    url: string; 
}

export interface CompleteProfileData {
    displayName: string;
    username: string;
    summary?: string;
}

export interface AuthResponse {
    success: boolean;
    user: UserProfile;
    needsProfile?: boolean;
}

export class AuthService {
    static async verifyToken(idToken: string): Promise<AuthResponse> {
        const response = await fetch(`${config.API_URL}/auth/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ idToken })
        });

        if (response.status === 404) {
            // User not found in backend - needs profile completion
            throw new Error('User not found');
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to verify token');
        }

        return response.json();
    }

    static async completeProfile(idToken: string, profileData: CompleteProfileData): Promise<AuthResponse> {
        const response = await fetch(`${config.API_URL}/auth/complete-profile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`
            },
            body: JSON.stringify(profileData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to complete profile');
        }

        return response.json();
    }

    static async getProfile(idToken: string): Promise<AuthResponse> {
        const response = await fetch(`${config.API_URL}/auth/profile`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${idToken}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get profile');
        }

        return response.json();
    }

    static async checkUsername(username: string): Promise<{ isAvailable: boolean }> {
        const response = await fetch(`${config.API_URL}/auth/check-username?username=${encodeURIComponent(username)}`, {
            method: 'GET'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to check username');
        }

        return response.json();
    }

    static async getLoggedInUser(idToken: string): Promise<AuthResponse> {
        const response = await fetch(`${config.API_URL}/auth/user/logged-in`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${idToken}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get logged in user');
        }

        return response.json();
    }
}
