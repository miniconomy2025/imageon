import { UserFeed } from '../../components/Feeds/UserFeed';
import './mainPage.css';

export const MainPage = () => {
    return (
        <div className='main__feed'>
            <UserFeed/>
        </div>
    );
}