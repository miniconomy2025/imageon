import { useAuth } from '../contexts/AuthContext';

export const useGetCurrentUser = () => {
    const { user, isAuthenticated } = useAuth();

    return {
        user: user,
        isFetching: false,
        isError: false,
        isSuccess: isAuthenticated
    };
};
