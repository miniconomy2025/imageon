import { User } from '../../types/user';
import Avatar from '../Avatar/Avatar';
import './userCard.css';

export const UserCard = ({ user, onClick }: { user: User; onClick: () => void }) => {
    return (
        <div className='user__card' onClick={onClick}>
            <Avatar src={user.icon?.url || undefined} alt={user.username} fallbackText={user.username} size='medium' />
            <div className='user__card-info'>
                <h4 className='user__card-name'>
                    {!!user.preferredUsername ? `${user.preferredUsername}` : !!user.preferredUsername ? `${user.preferredUsername}` : user.username}
                </h4>
            </div>
        </div>
    );
};
