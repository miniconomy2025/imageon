import { useState, useEffect } from 'react';

export const useIsMobile = (breakpoint: number = 768) => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkIfMobile = () => {
            const mobile = window.innerWidth <= breakpoint;
            setIsMobile(mobile);
        };

        checkIfMobile();

        window.addEventListener('resize', checkIfMobile);

        return () => window.removeEventListener('resize', checkIfMobile);
    }, [breakpoint]);

    return isMobile;
};