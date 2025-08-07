import { useQuery } from '@tanstack/react-query';
import { User } from '../types/user';
import { useAuth } from '../contexts/AuthContext';

import { config } from '../config/config';
export const useGetFollowers = () => {
    const { currentUser } = useAuth();

    const url = `${config.API_URL}/auth/user/followers`;

    const { data, isError, isSuccess, isFetching } = useQuery({
        queryKey: ['followers', currentUser?.uid],
        queryFn: async (): Promise<User[]> => {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${(await currentUser?.getIdTokenResult())?.token}`
                }
            });
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const result = await response.json();
            return result.followers || [];
        },
        enabled: currentUser?.uid != null
    });

    return {
        followers: data,
        isFetching,
        isError,
        isSuccess
    };
};
