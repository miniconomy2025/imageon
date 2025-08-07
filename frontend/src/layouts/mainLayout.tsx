import React from 'react';
import { Outlet } from 'react-router-dom';
import './layout.css';
import { SideBar } from '../components/Sidebar/sideBar';
import { LogoutButton } from '../components/LogoutButton/LogoutButton';
import { UserSearch } from '../components/UserSearch/userSearch';

const Layout: React.FC = () => {
    return (
        <div className='app'>
            <header className='app__header'>
                <div className='header-content'>
                    <h1 className='app-title'>ImageOn</h1>
                    <UserSearch />
                    <LogoutButton />
                </div>
            </header>
            <main className='app__main'>
                <SideBar />
                <div className='main-content'>
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
