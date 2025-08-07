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
                firstName: 'Mock',
                lastName: 'User',
                avatar: config.MOCK_IMAGE_URL,
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
              firstName: userProfile.displayName?.split(' ')[0] || '',
              lastName: userProfile.displayName?.split(' ').slice(1).join(' ') || '',
              avatar: userProfile.photoURL,
              bio: userProfile.bio
          } as User)
        : null;

    return {
        user: mappedUser,
        isFetching: false,
        isError: false,
        isSuccess: isAuthenticated && !!userProfile
    };
};
