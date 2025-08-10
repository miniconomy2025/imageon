import { useRef, useCallback, useEffect } from 'react';
import { useUserFeed } from '../../hooks/useUserFeed';
import Card from '../Card/Card';
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

    const { posts: feedPosts, isFetching: isLoadingPosts, fetchNextPage, hasNextPage } = useUserFeed(username);

    const lastPostElementRef = useCallback(
        (node: HTMLDivElement) => {
            if (isLoadingPosts) return;
            if (observerRef.current) observerRef.current.disconnect();

            observerRef.current = new IntersectionObserver(entries => {
                if (entries[0].isIntersecting && hasNextPage) {
                    fetchNextPage();
                }
            });

            if (node) observerRef.current.observe(node);
        },
        [isLoadingPosts, fetchNextPage, hasNextPage]
    );

    useEffect(() => {
        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, []);

    return (
        <>
            {isLoadingPosts && <LoaderDots />}
            {feedPosts &&
                feedPosts.map((post, index) => (
                    <Card key={post.id} ref={index === feedPosts.length - 1 ? lastPostElementRef : null}>
                        <PostCard post={post} author={post.author} />
                    </Card>
                ))}
        </>
    );
};
