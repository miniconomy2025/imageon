import { useAuth } from '../contexts/AuthContext';
import config from '../../config.json';
import { User } from '../types/user';

export const useGetCurrentUser = () => {
    const { user, isAuthenticated } = useAuth();

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
