import { UserFeed } from '../../components/Feeds/UserFeed';
import './mainPage.css';

export const MainPage = () => {
    return (
        <div className='main-page'>
            <div className='main-page__container'>
                <UserFeed />
            </div>
        </div>
    );
};
