import { auth, googleProvider } from "../config/firebase";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";

const API_BASE_URL = "http://localhost:3000"; // Update this to your backend URL

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
  needsProfile: boolean;
}

export interface CompleteProfileData {
  displayName: string;
  username: string;
}

class AuthService {
  // Sign in with Google
  async signInWithGoogle(): Promise<User> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }

  // Verify token with backend
  async verifyToken(idToken: string): Promise<UserProfile> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle the case where user doesn't exist (needs profile completion)
        if (response.status === 404 && data.needsProfile) {
          return {
            uid: data.uid || "",
            email: data.email || "",
            needsProfile: true,
            displayName: undefined,
            username: undefined,
            photoURL: undefined,
          };
        }
        throw new Error(data.error || "Failed to verify token");
      }

      return data.user;
    } catch (error) {
      console.error("Error verifying token:", error);
      throw error;
    }
  }

  // Complete user profile
  async completeProfile(
    profileData: CompleteProfileData,
    idToken: string
  ): Promise<UserProfile> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/complete-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(profileData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to complete profile");
      }

      return data.user;
    } catch (error) {
      console.error("Error completing profile:", error);
      throw error;
    }
  }

  // Get user profile
  async getProfile(idToken: string): Promise<UserProfile> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get profile");
      }

      return data.user;
    } catch (error) {
      console.error("Error getting profile:", error);
      throw error;
    }
  }

  // Update user profile
  async updateProfile(
    updates: Partial<UserProfile>,
    idToken: string
  ): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  }

  // Check username availability
  async checkUsername(username: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/check-username?username=${encodeURIComponent(
          username
        )}`,
        {
          method: "GET",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to check username");
      }

      return data.isAvailable;
    } catch (error) {
      console.error("Error checking username:", error);
      throw error;
    }
  }

  // Listen to auth state changes
  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  }
}

export const authService = new AuthService();
