import './menuButton.css';

export const MenuButton = ({ className, onClick }: { className?: string; onClick: () => void }) => {
    return (
        <button className={`menu-button ${className}`} onClick={onClick}>
            {[1, 2, 3].map((_, index) => (
                <div key={index} className='menu__button__bar'></div>
            ))}
        </button>
    );
};
