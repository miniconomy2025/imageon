import React, { useState, useEffect } from 'react';
import './sideBar.css';
import { useGetFollowing } from '../../hooks/useGetFollowing';
import { useGetCurrentUser } from '../../hooks/useGetCurrentUser';
import { useIsMobile } from '../../hooks/useIsMobile';
import Avatar from '../Avatar/Avatar';
import { Pages } from '../../pages/pageRouting';
import { useNavigate } from 'react-router-dom';
import { UserCard } from '../UserCard/userCard';
import { MenuButton } from '../MenuButton/menuButton';

export const SideBar = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const isMobile = useIsMobile(768);
    const currentUser = useGetCurrentUser();
    const navigate = useNavigate();
    const { following, isFetching } = useGetFollowing(currentUser?.user?.username || '');

    useEffect(() => {
        setIsCollapsed(isMobile);
    }, [isMobile]);

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    return (
        <>
            {isMobile && isCollapsed && (
                <MenuButton className="toggle-btn" onClick={toggleSidebar} />
            )}
            
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''}`}>
                <div className="sidebar-header">
                    <h2>{!isCollapsed && 'imageon'}</h2>
                    <MenuButton className="toggle-btn" onClick={toggleSidebar} />
                </div>
                
                {!isCollapsed && (
                    <>
                        <div className="app__user">
                            <Avatar 
                                fallbackText={currentUser?.user?.username || 'User'} 
                                size="medium" 
                                onClick={() => { 
                                    toggleSidebar();
                                    currentUser?.user?.username && navigate(Pages.profilePage.replace(':username', currentUser?.user?.username))  }}
                            />
                        </div>
                        {isFetching ? <p>Loading following...</p> : (
                            <ul>
                                {following?.map((user, index) => (
                                    <UserCard key={`${user.id}-${index}`} user={user} onClick={() => {
                                        toggleSidebar();
                                        navigate(Pages.profilePage.replace(':username', user.username));
                                    }} />
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </aside>
        </>
    );
}