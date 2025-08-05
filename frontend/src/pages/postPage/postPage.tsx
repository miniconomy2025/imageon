import { useNavigate, useParams } from 'react-router-dom';
import { useGetPost } from '../../hooks/useGetPost';
import { AttachmentCarousel } from '../../components/AttachmentCarousel/attachementCarousel';
import './postPage.css';
import { Card } from '../../components';
import { UserCard } from '../../components/UserCard/userCard';

export const PostPage = () => {
    const params = useParams();
    const navigate = useNavigate();

    if (!params.postId || params.postId === '' || params.postId === undefined) {
        navigate('/'); // Redirect to home if postId is not provided
    }

    const { data: post } = useGetPost(params.postId ?? '');

    return (
        <div className='post-page'>
            <AttachmentCarousel attachments={post?.attachments || []} />
            <section className='post-page__content'>
                <p>{post?.content}</p>
                <p>Author: {post?.author?.firstName}</p>
                <p>Posted at: {post?.postedAt}</p>
            </section>
            <section className='post-page__author'>
                <h2>{post?.author?.username}</h2>
                <p>Posted at: {new Date(post?.postedAt || '').toLocaleString()}</p>
            </section>
            <section className='post-page__comments'>
                <h2>Comments</h2>
                {post?.comments && post.comments.length > 0 ? (
                    post.comments.map(comment => (
                        <Card key={comment.id} className='comment'>
                            <UserCard user={comment.author} />
                            <p>{comment.content}</p>
                            <span className='comment__timestamp'>{new Date(comment.createdAt || '').toLocaleString()}</span>
                        </Card>
                    ))
                ) : (
                    <p>No comments yet.</p>
                )}
            </section>
            <section className='post-page__actions'>
                <button onClick={() => navigate(-1)}>Back</button>
            </section>
        </div>
    );
};
