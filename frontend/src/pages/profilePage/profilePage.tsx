import { useParams } from "react-router-dom";
import { useGetUser } from "../../hooks/useGetUser";
import { useUserPosts } from "../../hooks/useUserPosts";
import { Card, PostCard } from "../../components";
import './profilePage.css';
export const ProfilePage = () => {
    const params = useParams();
    const username = params.username;

    if (!username) {
        return <div>Error: Username is required</div>;
    }

    const { user, isFetching: isLoadingUser } = useGetUser(username);
    const { posts: userPosts, isFetching: isLoadingPosts } = useUserPosts(username);

    return (
        <div className="profile__feed">
            {isLoadingUser && <p>Loading user...</p>}
            {user && (
                <>
                    <h1>{user.username}</h1>
                    <p>First Name: {user.firstName}</p>
                    <p>Last Name: {user.lastName}</p>
                </>
            )}
            <section className="profile__posts">
            {isLoadingPosts && <p>Loading posts...</p>}
            {userPosts && userPosts.map(post => (
                <Card key={post.id}>
                    <PostCard post={post} />
                </Card>
            ))}
            </section>
        </div>
    );
};