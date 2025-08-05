import { createBrowserRouter } from 'react-router-dom';
import Layout from '../layouts/mainLayout';
import { MainPage, ProfilePage, PostPage, CreatePostPage } from './index';

export const Pages = {
    mainPage: '/',
    profilePage: '/:username',
    postPage: '/post/:postId',
    createPostPage: '/create-post'
} as const;

export const router = createBrowserRouter([
    {
        path: '/',
        element: <Layout />,
        children: [
            {
                path: '/',
                element: <MainPage />
            },
            {
                path: '/:username',
                element: <ProfilePage />
            },
            {
                path: '/post/:postId',
                element: <PostPage />
            },
            {
                path: '/create-post',
                element: <CreatePostPage />
            }
        ]
    }
]);
