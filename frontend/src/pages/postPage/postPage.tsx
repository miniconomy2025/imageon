import { useNavigate, useParams } from "react-router-dom";
import { useGetPost } from "../../hooks/useGetPost";
import { AttachmentCarousel } from "../../components/AttachmentCarousel/attachementCarousel";

export const PostPage = () => {
    const params = useParams();
    const navigate = useNavigate();
    
    if (!params.postId || params.postId === '' || params.postId === undefined) {
        navigate('/'); // Redirect to home if postId is not provided
    }

    const {data: post} = useGetPost(params.postId ?? '');

    return (
        <div>
            <h1>{post?.title}</h1>
            <AttachmentCarousel attachments={post?.attachments || []} />
            <p>{post?.content}</p>
            <p>Author: {post?.author?.firstName}</p>
            <p>Posted at: {post?.postedAt}</p>
        </div>
    );
};
