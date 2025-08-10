import { useRef, useEffect } from 'react';
import { useUserFeed } from '../../hooks/useUserFeed';
import PostCard from '../Post/Post';
import { useAuth } from '../../contexts/AuthContext';
import LoaderDots from '../LoaderDots';

export const UserFeed = () => {
    const { userProfile } = useAuth();
    const observerRef = useRef<IntersectionObserver | null>(null);

    const username = userProfile?.username;

    if (!username) {
        return <div>Error: Username is required</div>;
    }

    const { posts: feedPosts, isFetching: isLoadingPosts } = useUserFeed(username);

    useEffect(() => {
        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, []);

    return (
        <>
            {isLoadingPosts === true ? (
                <LoaderDots />
            ) : (
                feedPosts.length > 0 && feedPosts.map(post => <PostCard post={post} author={post.author} key={post.id} />)
            )}
        </>
    );
};
