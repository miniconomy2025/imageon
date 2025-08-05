import { User } from "../../types/user";
import Avatar from "../Avatar/Avatar";
import './userCard.css';

export const UserCard = ({ user, onClick }: { user: User, onClick: () => void }) => {
    return (
        <div className="user__card" onClick={onClick}>
            <Avatar
                src={user.avatar || undefined}
                alt={user.username}
                fallbackText={user.username}
                size="medium"
            />
            <div className="user__card-info">
                <h4 className="user__card-name">{!!user.firstName && !!user.lastName ? `${user.firstName} ${user.lastName}` : !!user.firstName ? `${user.firstName}` : user.username}</h4>
            </div>
        </div>
    );
}