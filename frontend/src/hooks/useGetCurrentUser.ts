import { useAuth } from '../contexts/AuthContext';
import { User } from '../types/user';

import { config } from '../config/config';

export const useGetCurrentUser = () => {
    const { userProfile, loading: isAuthenticated } = useAuth();

    if (config?.MOCK_DATA) {
        return {
            user: {
                id: 1,
                username: 'mockUser',
                preferredUsername: 'Mock',
                lastName: 'User',
                icon: { url: userProfile?.photoURL, type: 'image' },
                bio: 'A passionate developer who loves creating amazing user experiences. Always learning and sharing knowledge with the community.'
            } as User,
            isFetching: false,
            isError: false,
            isSuccess: true
        };
    }

    // Map UserProfile to our custom User type
    const mappedUser = userProfile
        ? ({
              id: parseInt(userProfile.uid) || 0,
              username: userProfile.username,
              preferredUsername: userProfile.displayName?.split(' ')[0] || '',
              lastName: userProfile.displayName?.split(' ').slice(1).join(' ') || '',
              icon: { url: userProfile.photoURL, type: 'image' },
              bio: userProfile.bio,
              url: userProfile.url || ''
          } as User)
        : null;

    return {
        user: mappedUser,
        isFetching: false,
        isError: false,
        isSuccess: isAuthenticated && !!userProfile
    };
};
