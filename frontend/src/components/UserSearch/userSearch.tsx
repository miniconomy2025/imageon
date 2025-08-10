import React, { useState, useRef, useEffect } from 'react';
import { useSearchUser } from '../../hooks/useSearchUser';
import { useFollowUser } from '../../hooks/useFollowUser';
import { User } from '../../types/user';
import './userSearch.css';
import { useNavigate } from 'react-router-dom';
import { Pages } from '../../pages/pageRouting';

export const UserSearch = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [followingUsers, setFollowingUsers] = useState<Set<number>>(new Set());
    const searchRef = useRef<HTMLDivElement>(null);
    const debounceTimeoutRef = useRef<number | null>(null);

    const navigate = useNavigate();

    const { users, isLoading } = useSearchUser(debouncedSearchTerm);
    const { followUser, isLoading: isFollowLoading } = useFollowUser();

    useEffect(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        debounceTimeoutRef.current = window.setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 1000);

        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [searchTerm]);

    // Close results when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);
        setShowResults(value.length > 0);
    };

    const handleFollowClick = (user: User) => {
        const isCurrentlyFollowing = followingUsers.has(user.id);

        followUser({
            userId: user.id,
            isFollowing: isCurrentlyFollowing,
            targetUsername: user.url || user.username
        });

        // Optimistically update the UI
        setFollowingUsers(prev => {
            const newSet = new Set(prev);
            if (isCurrentlyFollowing) {
                newSet.delete(user.id);
            } else {
                newSet.add(user.id);
            }
            return newSet;
        });
    };

    const handleResultClick = (user: User) => {
        navigate(Pages.profilePage.replace(':username', user?.username) + `?url=${encodeURIComponent(user?.url || '')}`);
    };

    return (
        <div className='user-search' ref={searchRef}>
            <input
                type='text'
                placeholder='Enter full username (include domain if external)...'
                className='user-search__input'
                value={searchTerm}
                onChange={handleInputChange}
                onFocus={() => searchTerm.length > 0 && setShowResults(true)}
            />

            {showResults && (
                <div className='user-search__results'>
                    {isLoading ? (
                        <div className='user-search__loading'>Searching...</div>
                    ) : users.length > 0 ? (
                        users.map(user => {
                            const isFollowing = followingUsers.has(user.id);
                            return (
                                <div key={user.id} className='user-search__result-item' onClick={() => handleResultClick(user)}>
                                    <div className='user-search__user-info'>
                                        <img
                                            src={user.icon?.url}
                                            alt={`${user.username}'s .icon?.url`}
                                            className='user-search__avatar'
                                            onError={e => {
                                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40x40/e9ecef/6c757d?text=U';
                                            }}
                                        />
                                        <div className='user-search__user-details'>
                                            <p className='user-search__username'>@{user.username}</p>
                                            <p className='user-search__name'>{user.preferredUsername}</p>
                                        </div>
                                    </div>
                                    <button
                                        className={`user-search__follow-btn ${isFollowing ? 'user-search__follow-btn--following' : ''}`}
                                        onClick={e => {
                                            e.stopPropagation();
                                            handleFollowClick(user);
                                        }}
                                        disabled={isFollowLoading}>
                                        {isFollowLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                                    </button>
                                </div>
                            );
                        })
                    ) : searchTerm.length > 0 ? (
                        <div className='user-search__no-results'>No users found</div>
                    ) : null}
                </div>
            )}
        </div>
    );
};
