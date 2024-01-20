import { useEffect, useRef, useState } from 'react';
import { blurHashToDataURL } from './util/bluredHash';
import { images } from './constants/images';

const ImageCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const nextIndex = (currentIndex + 1) % images.length;
    const timer = setTimeout(() => setCurrentIndex(nextIndex), 3000 * 10);

    return () => clearTimeout(timer);
  }, [currentIndex]);

  useEffect(() => {
    const currentImage = images[currentIndex];

    const dataURL = blurHashToDataURL(currentImage.blur_hash);

    if (dataURL && imageRef.current) {
      imageRef.current.style.transition = 'opacity 1s ease-out';
      imageRef.current.style.opacity = '0';

      imageRef.current.onload = () => {
        imageRef.current?.setAttribute('src', currentImage.urls.full);
        imageRef.current!.style.opacity = '1';
      };
    }
  }, [currentIndex]);

  return (
    <main style={{ height: '100dvh', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100dvw', overflow: 'hidden', userSelect: '-moz-none' && 'none', }}>
      <picture
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        <source srcSet={images[currentIndex].urls.raw} />
        <img
          ref={imageRef}
          alt={images[currentIndex].alt_description}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </picture>
    </main>
  );
};

export default ImageCarousel;
