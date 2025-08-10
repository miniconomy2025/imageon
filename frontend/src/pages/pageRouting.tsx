import { createBrowserRouter } from 'react-router-dom';
import Layout from '../layouts/mainLayout';
import { MainPage, ProfilePage, PostPage, CreatePostPage } from './index';
import { LoginPage } from './loginPage/loginPage';
import { CompleteProfilePage } from './completeProfilePage/completeProfilePage';
import { ProtectedRoute } from '../components/ProtectedRoute/ProtectedRoute';

export const Pages = {
    mainPage: '/',
    profilePage: '/:domain/:username',
    postPage: '/:domain/:username/posts/:postId',
    createPostPage: '/create-post',
    login: '/login',
    completeProfile: '/complete-profile'
} as const;

export const router = createBrowserRouter([
    {
        path: '/login',
        element: <LoginPage />
    },
    {
        path: '/complete-profile',
        element: <CompleteProfilePage />
    },
    {
        path: '/',
        element: <Layout />,
        children: [
            {
                path: '/',
                element: (
                    <ProtectedRoute>
                        <MainPage />
                    </ProtectedRoute>
                )
            },
            {
                path: '/:domain/:username',
                element: (
                    <ProtectedRoute>
                        <ProfilePage />
                    </ProtectedRoute>
                )
            },
            {
                path: '/:domain/:username/posts/:postId',
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
