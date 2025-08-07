import { useParams } from 'react-router-dom';
import { useGetUser } from '../../hooks/useGetUser';
import { useUserPosts } from '../../hooks/useUserPosts';
import { Card, PostCard, Avatar } from '../../components';
import './profilePage.css';
import { useAuth } from '../../contexts/AuthContext';

export const ProfilePage = () => {
    const params = useParams();
    const username = params.username;

    if (!username) {
        return <div>Error: Username is required</div>;
    }

    const { user, isFetching: isLoadingUser } = useGetUser(username);
    const { posts: userPosts, isFetching: isLoadingPosts } = useUserPosts(username);

    return (
        <div className='profile-page'>
            <div className='profile-page__container'>
                {/* Profile Header */}
                <Card className='profile-page__header-card'>
                    {isLoadingUser ? (
                        <div className='profile-page__loading'>
                            <p>Loading user...</p>
                        </div>
                    ) : user ? (
                        <div className='profile-page__user-info'>
                            <Avatar
                                src={user.avatar}
                                alt={user.firstName || user.username}
                                fallbackText={user.firstName || user.username || 'U'}
                                size='large'
                            />
                            <div className='profile-page__user-details'>
                                <h1 className='profile-page__username'>@{user.username}</h1>
                                <p className='profile-page__name'>
                                    {user.firstName} {user.lastName}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className='profile-page__loading'>
                            <p>User not found</p>
                        </div>
                    )}
                </Card>

                {/* Posts Section */}
                <Card className='profile-page__posts-card'>
                    <h2 className='profile-page__section-title'>Posts ({userPosts?.length || 0})</h2>

                    <div className='profile__feed'>
                        {isLoadingPosts ? (
                            <div className='profile-page__loading'>
                                <p>Loading posts...</p>
                            </div>
                        ) : userPosts && userPosts.length > 0 ? (
                            <section className='profile__posts'>
                                {userPosts.map(post => (
                                    <Card key={post.id}>
                                        <PostCard post={post} />
                                    </Card>
                                ))}
                            </section>
                        ) : (
                            <div className='profile-page__no-posts'>
                                <p>No posts yet. This user hasn't shared anything!</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};
