import React, { useState, useRef, useEffect } from 'react';
import { useSearchUser } from '../../hooks/useSearchUser';
import { useFollowUser } from '../../hooks/useFollowUser';
import { User } from '../../types/user';
import './userSearch.css';
import { useNavigate } from 'react-router-dom';
import { Pages } from '../../pages/pageRouting';
import { useGetFollowing } from '../../hooks/useGetFollowing';

export const UserSearch = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [showResults, setShowResults] = useState(false);
    const [optimisticFollows, setOptimisticFollows] = useState<Set<number>>(new Set());
    const searchRef = useRef<HTMLDivElement>(null);
    const debounceTimeoutRef = useRef<number | null>(null);

    const navigate = useNavigate();

    const { following } = useGetFollowing();
    const { data: searchResults, isLoading } = useSearchUser(debouncedSearchTerm, following ?? []);
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

    const handleFollowClick = (user: User, isFollowing: boolean) => {
        // Optimistically update the follow state
        if (!isFollowing) {
            setOptimisticFollows(prev => new Set(prev).add(user.id));
        }

        followUser(
            {
                userId: user.id,
                isFollowing: isFollowing,
                targetUsername: user.url || user.username
            },
            {
                onError: () => {
                    // Revert optimistic update on error
                    if (!isFollowing) {
                        setOptimisticFollows(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(user.id);
                            return newSet;
                        });
                    }
                }
            }
        );
    };

    const handleResultClick = (user: User) => {
        // Extract domain from user handle or URL
        let domain = 'unknown';
        if (user.handle) {
            const parts = user.handle.split('@');
            domain = parts.length > 1 ? parts[parts.length - 1] : 'unknown';
        } else if (user.url) {
            try {
                domain = new URL(user.url).hostname;
            } catch {
                domain = 'unknown';
            }
        }

        navigate(Pages.profilePage.replace(':domain', domain).replace(':username', user?.username));
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
                    ) : searchResults.length > 0 ? (
                        searchResults.map(({ user, isFollowing }) => {
                            // Check if user is optimistically followed
                            const isOptimisticallyFollowed = optimisticFollows.has(user.id);
                            const effectivelyFollowing = isFollowing || isOptimisticallyFollowed;

                            return (
                                <div key={user.id} className='user-search__result-item' onClick={() => handleResultClick(user)}>
                                    <div className='user-search__user-info'>
                                        <img
                                            src={user.icon?.url}
                                            alt={`${user.username}'s avatar`}
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
                                        className={`user-search__follow-btn ${effectivelyFollowing ? 'user-search__follow-btn--following' : ''}`}
                                        onClick={e => {
                                            if (!effectivelyFollowing) {
                                                e.stopPropagation();
                                                handleFollowClick(user, isFollowing);
                                            }
                                        }}
                                        disabled={isFollowLoading}>
                                        {isFollowLoading ? '...' : effectivelyFollowing ? 'Following' : 'Follow'}
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
