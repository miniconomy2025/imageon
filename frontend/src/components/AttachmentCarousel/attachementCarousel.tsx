import { useState } from 'react';
import './attachmentCarousel.css';

export const AttachmentCarousel = ({ attachments }: { attachments: string[] }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const carouselIndex = () => {
        if (currentIndex < attachments.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            return setCurrentIndex(0);
        }
    };

    return (
        <div className='attachment-carousel'>
            {attachments.length > 1 && <></>}
            <div className='attachment-carousel__images'>
                {attachments.map((attachment, index) => (
                    <img
                        key={index}
                        src={attachment}
                        alt={`Attachment ${index + 1}`}
                        className='attachment-carousel__image'
                        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                    />
                ))}
            </div>
            <div className='attachment-carousel__controls'>
                {attachments.length > 1 && (
                    <>
                        <button
                            className='attachment-carousel__button'
                            onClick={() => setCurrentIndex(currentIndex > 0 ? currentIndex - 1 : attachments.length - 1)}>
                            Prev
                        </button>
                        <button className='attachment-carousel__button' onClick={carouselIndex}>
                            Next
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
