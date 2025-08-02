import { useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserFeed } from "../../hooks/useUserFeed";
import Card from "../Card/Card"
import Post from "../Post/Post"


export const UserFeed = () => {
    const navigate = useNavigate();
    const observerRef = useRef<IntersectionObserver | null>(null);

    //Once login is implemented, replace with logged-in users username
    const username = "Bob";

    if (!username) {
        return <div>Error: Username is required</div>;
    }

    const { posts: feedPosts, isFetching: isLoadingPosts, fetchNextPage, hasNextPage } = useUserFeed(username);

    const lastPostElementRef = useCallback((node: HTMLDivElement) => {
        if (isLoadingPosts) return;
        if (observerRef.current) observerRef.current.disconnect();
        
        observerRef.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasNextPage) {
                fetchNextPage();
            }
        });
        
        if (node) observerRef.current.observe(node);
    }, [isLoadingPosts, fetchNextPage, hasNextPage]);

    useEffect(() => {
        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, []);
    
    return (
        <>
            {isLoadingPosts && <p>Loading posts...</p>}
            {feedPosts && feedPosts.map((post, index) => (
        <Card 
            key={post.id}
            ref={index === feedPosts.length - 1 ? lastPostElementRef : null}
        >
            <Post content={post.content} author={{ name: post.author, avatar: '' }} timestamp={post.postedAt} />
        </Card>))}
            {isLoadingPosts && <p>Loading more posts...</p>}
        </>
    );
}