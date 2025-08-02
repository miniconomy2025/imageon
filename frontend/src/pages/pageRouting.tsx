import { createBrowserRouter } from "react-router-dom";
import Layout from "../layouts/mainLayout";
import { MainPage } from "./mainPage/mainPage";
import { ProfilePage } from "./profilePage/profilePage";

export const Pages = {
    mainPage: '/',
    profilePage: '/:username',
} as const;

export const router = createBrowserRouter([
    {
        path: "/",
        element: <Layout />,
        children: [
            {
                path: "/",
                element: <MainPage />,
            },
            {
                path: "/:username",
                element: <ProfilePage />,
            },
        ],
    },
]);