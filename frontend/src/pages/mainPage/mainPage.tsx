import { UserFeed } from '../../components/Feeds/UserFeed';
import './mainPage.css';

export const MainPage = () => {
    return (
        <div className='main-page'>
            <div className='main-page__container'>
                <div className='main__feed'>
                    <UserFeed />
                </div>
            </div>
        </div>
    );
};
