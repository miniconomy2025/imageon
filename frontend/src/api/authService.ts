import config from '../../config.json';
import { User } from '../types/user';

export interface GoogleAuthRequest {
    code: string;
    state?: string;
}

export interface LoginResponse {
    success: boolean;
    user?: User;
    token?: string;
    message?: string;
}

export interface AuthState {
    isAuthenticated: boolean;
    user: User | null;
    token: string | null;
}

class AuthService {
    private readonly baseUrl: string;
    private readonly tokenKey = 'imageon_auth_token';
    private readonly userKey = 'imageon_user';

    constructor() {
        this.baseUrl = `${config.API_URL}/auth`;
    }

    // Google OAuth URL generation
    getGoogleAuthUrl(state?: string): string {
        const params = new URLSearchParams({
            client_id: config.GOOGLE_OAUTH.CLIENT_ID,
            redirect_uri: config.GOOGLE_OAUTH.REDIRECT_URI,
            response_type: 'code',
            scope: config.GOOGLE_OAUTH.SCOPE,
            access_type: 'offline',
            prompt: 'consent'
        });

        if (state) {
            params.append('state', state);
        }

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    // Redirect to Google OAuth
    redirectToGoogleAuth(returnPath?: string): void {
        const state = returnPath ? encodeURIComponent(returnPath) : undefined;
        const authUrl = this.getGoogleAuthUrl(state);
        window.location.href = authUrl;
    }

    // Handle Google OAuth callback
    async handleGoogleCallback(code: string, state?: string): Promise<LoginResponse> {
        try {
            if (config.MOCK_DATA) {
                console.log('Mock Google OAuth callback:', { code, state });

                await new Promise(resolve => setTimeout(resolve, 1000));

                const mockUser: User = {
                    id: 1,
                    username: 'googleuser',
                    firstName: 'Google',
                    lastName: 'User',
                    avatar: config.MOCK_IMAGE_URL || 'https://via.placeholder.com/150',
                    bio: 'Tech enthusiast and early adopter. Love exploring new platforms and connecting with like-minded individuals.'
                };

                const mockToken = `mock-google-token-${Date.now()}`;

                // Store in localStorage
                this.setAuthData(mockUser, mockToken);

                return {
                    success: true,
                    user: mockUser,
                    token: mockToken,
                    message: 'Google login successful'
                };
            }

            const response = await fetch(`${this.baseUrl}/google/callback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code, state })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.user && result.token) {
                this.setAuthData(result.user, result.token);
            }

            return result;
        } catch (error) {
            console.error('Google OAuth callback error:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Google authentication failed'
            };
        }
    }

    logout(): void {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
    }

    getAuthState(): AuthState {
        const token = localStorage.getItem(this.tokenKey);
        const userStr = localStorage.getItem(this.userKey);

        if (!token || !userStr) {
            return {
                isAuthenticated: false,
                user: null,
                token: null
            };
        }

        try {
            const user = JSON.parse(userStr) as User;
            return {
                isAuthenticated: true,
                user,
                token
            };
        } catch {
            // If parsing fails, clear invalid data
            this.logout();
            return {
                isAuthenticated: false,
                user: null,
                token: null
            };
        }
    }

    getCurrentUser(): User | null {
        const authState = this.getAuthState();
        return authState.user;
    }

    getToken(): string | null {
        return localStorage.getItem(this.tokenKey);
    }

    isAuthenticated(): boolean {
        const authState = this.getAuthState();
        return authState.isAuthenticated;
    }

    private setAuthData(user: User, token: string): void {
        localStorage.setItem(this.tokenKey, token);
        localStorage.setItem(this.userKey, JSON.stringify(user));
    }

    // Method to add auth headers to requests
    getAuthHeaders(): Record<string, string> {
        const token = this.getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    }
}

export const authService = new AuthService();
export default authService;
