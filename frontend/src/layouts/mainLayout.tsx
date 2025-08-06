import React from 'react';
import { Outlet } from 'react-router-dom';
import './layout.css';
import { SideBar } from '../components/Sidebar/sideBar';
import { LogoutButton } from '../components/LogoutButton/LogoutButton';

const Layout: React.FC = () => {
    return (
        <div className='app'>
            <header className='app__header'>
                <div className='header-content'>
                    <div className='header-left'>
                        <h1 className='app-title'>ImageOn</h1>
                    </div>
                    <div className='header-right'>
                        <LogoutButton />
                    </div>
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
