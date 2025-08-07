import { useState, useEffect } from 'react';
import './sideBar.css';
import { useGetFollowing } from '../../hooks/useGetFollowing';
import { useGetCurrentUser } from '../../hooks/useGetCurrentUser';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Pages } from '../../pages/pageRouting';
import { useNavigate } from 'react-router-dom';
import { UserCard } from '../UserCard/userCard';
import { MenuButton } from '../MenuButton/menuButton';
import Card from '../Card/Card';
import { useGetFollowers } from '../../hooks/useGetFollowers';

export interface SidebarMenuItem {
    label: string;
    onClick: () => void;
}

export const SideBar = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const isMobile = useIsMobile(768);
    const currentUser = useGetCurrentUser();
    const navigate = useNavigate();
    const { following, isFetching } = useGetFollowing();
    const { followers, isFetching: isFetchingFollowers } = useGetFollowers();

    useEffect(() => {
        setIsCollapsed(isMobile);
    }, [isMobile]);

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    const handleUserClick = () => {
        if (isMobile) {
            toggleSidebar();
        }
    };

    const menuItems: SidebarMenuItem[] = [
        {
            label: 'Home',
            onClick: () => {
                handleUserClick();
                navigate(Pages.mainPage);
            }
        },
        {
            label: 'My Profile',
            onClick: () => {
                handleUserClick();
                currentUser?.user?.username && navigate(Pages.profilePage.replace(':username', currentUser?.user?.username));
            }
        },
        {
            label: 'Create post',
            onClick: () => {
                handleUserClick();
                navigate(Pages.createPostPage);
            }
        }
    ];

    return (
        <>
            {isMobile && isCollapsed && <MenuButton className='toggle-btn' onClick={toggleSidebar} />}

            <div className={`sidebar-spacer ${isCollapsed ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''}`}></div>

            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''}`}>
                <div className='sidebar-header'>
                    <h2>{!isCollapsed && 'imageon'}</h2>
                    <MenuButton className='toggle-btn' onClick={toggleSidebar} />
                </div>

                {!isCollapsed && (
                    <>
                        <div className='sidebar-menuSection'>
                            {menuItems.map((item, index) => (
                                <Card key={index} className='sidebar-menu-item' onClick={item.onClick}>
                                    {item.label}
                                </Card>
                            ))}
                        </div>
                        <div className='sidebar-menuSection'>
                            <h3>Your followers</h3>
                            {isFetchingFollowers ? (
                                <p>Loading followers...</p>
                            ) : (
                                <ul>
                                    {followers &&
                                        followers?.map((user, index) => (
                                            <UserCard
                                                key={`${user.id}-${index}`}
                                                user={user}
                                                onClick={() => {
                                                    handleUserClick();
                                                    navigate(
                                                        Pages.profilePage.replace(':username', user.username) + `?url=${encodeURIComponent(user.url || '')}`
                                                    );
                                                }}
                                            />
                                        ))}
                                </ul>
                            )}
                        </div>
                        <div className='sidebar-menuSection'>
                            <h3>Following</h3>
                            {isFetching ? (
                                <p>Loading following...</p>
                            ) : (
                                <ul>
                                    {following &&
                                        following?.map((user, index) => (
                                            <UserCard
                                                key={`${user.id}-${index}`}
                                                user={user}
                                                onClick={() => {
                                                    handleUserClick();
                                                    navigate(
                                                        Pages.profilePage.replace(':username', user.username) + `?url=${encodeURIComponent(user.url || '')}`
                                                    );
                                                }}
                                            />
                                        ))}
                                </ul>
                            )}
                        </div>
                    </>
                )}
            </aside>
        </>
    );
};
