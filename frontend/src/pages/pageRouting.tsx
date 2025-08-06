import { createBrowserRouter } from 'react-router-dom';
import Layout from '../layouts/mainLayout';
import { MainPage, ProfilePage, PostPage, CreatePostPage } from './index';
import { CallbackPage } from './callbackPage/callbackPage';
import { ProtectedRoute } from '../components/ProtectedRoute/ProtectedRoute';

export const Pages = {
    mainPage: '/',
    profilePage: '/:username',
    postPage: '/post/:postId',
    createPostPage: '/create-post',
    authCallback: '/auth/callback'
} as const;

export const router = createBrowserRouter([
    {
        path: '/auth/callback',
        element: <CallbackPage />
    },
    {
        path: '/',
        element: <Layout />,
        children: [
            {
                //Comment out the protected route for testing purposes
                path: '/',
                element: (
                    <ProtectedRoute>
                        <MainPage />
                    </ProtectedRoute>
                )
            },
            {
                path: '/:username',
                element: (
                    <ProtectedRoute>
                        <ProfilePage />
                    </ProtectedRoute>
                )
            },
            {
                path: '/post/:postId',
                element: (
                    <ProtectedRoute>
                        <PostPage />
                    </ProtectedRoute>
                )
            },
            {
                path: '/create-post',
                element: (
                    <ProtectedRoute>
                        <CreatePostPage />
                    </ProtectedRoute>
                )
            }
        ]
    }
]);
