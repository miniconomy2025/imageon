import { useParams, useSearchParams } from 'react-router-dom';
import { useGetUserByUrl } from '../../hooks/useGetUserByUrl';
import { useUserPosts } from '../../hooks/useUserPosts';
import { LoaderDots } from '../../components/LoaderDots';
import { Card, PostCard, Avatar } from '../../components';
import './profilePage.css';
import { config } from '../../config/config';

export const ProfilePage = () => {
    const params = useParams();
    const [searchParams] = useSearchParams();
    const username = params.username;
    let userUrl = searchParams.get('url');

    if (!username) {
        return <div>Error: Username is required</div>;
    }

    if (!userUrl) {
        userUrl = `/users/${username}@${config.API_URL}`;
    }

    const { user, isFetching: isLoadingUser, isError: isLoadingUserError } = useGetUserByUrl(userUrl);
    const { posts: userPosts, isFetching: isLoadingPosts, isError: isLoadingPostsError } = useUserPosts(userUrl);

    if (isLoadingPostsError || isLoadingUserError) {
        return <div className='profile-page__error-message'>Error loading user or posts. Please try again later.</div>;
    }

    return (
        <div className='profile-page'>
            <div className='profile-page__container'>
                <Card className='profile-page__header-card'>
                    {isLoadingUser ? (
                        <div className='profile-page__loading'>
                            <LoaderDots />
                        </div>
                    ) : user ? (
                        <div className='profile-page__user-info'>
                            <Avatar
                                src={user.icon?.url}
                                alt={user.preferredUsername || user.username}
                                fallbackText={user.preferredUsername || user.username || 'U'}
                                size='large'
                            />
                            <div className='profile-page__user-details'>
                                <h1 className='profile-page__username'>@{user.username}</h1>
                                <p className='profile-page__name'>{user.preferredUsername}</p>
                                {user.bio && <p className='profile-page__bio'>{user.bio}</p>}
                            </div>
                        </div>
                    ) : (
                        <div className='profile-page__loading'>
                            <p>User not found</p>
                        </div>
                    )}
                </Card>
                <Card className='profile-page__posts-card'>
                    <h2 className='profile-page__section-title'>Posts ({userPosts?.length || 0})</h2>

                    <div className='profile__feed'>
                        {isLoadingPosts ? (
                            <div className='profile-page__loading'>
                                <LoaderDots />
                            </div>
                        ) : userPosts && userPosts.length > 0 ? (
                            <section className='profile__posts'>
                                {userPosts.map(post => (
                                    <Card key={post.id}>
                                        <PostCard post={post} author={user}/>
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
