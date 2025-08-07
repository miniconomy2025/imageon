import { useAuth } from '../contexts/AuthContext';
import { User } from '../types/user';

const config = {
    MOCK_DATA: import.meta.env.VITE_MOCK_DATA,
    MOCK_IMAGE_URL: import.meta.env.VITE_MOCK_IMAGE_URL
};

export const useGetCurrentUser = () => {
    const { currentUser: user, loading: isAuthenticated } = useAuth();

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

    return {
        user: user,
        isFetching: false,
        isError: false,
        isSuccess: isAuthenticated
    };
};
