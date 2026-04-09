import { useState, useEffect, useCallback } from "react";
import Image from "./Image";
import styles from "./Lightbox.module.css";

interface LightboxProps {
  images: { src: string; alt: string; caption?: string }[];
  initialIndex?: number;
  onClose: () => void;
}

export default function Lightbox({ images, initialIndex = 0, onClose }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const current = images[index];

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, next, prev]);

  if (!current) return null;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-label="Image lightbox">
      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close lightbox">
          &times;
        </button>

        {images.length > 1 && (
          <>
            <button
              className={`${styles.navBtn} ${styles.navPrev}`}
              onClick={prev}
              aria-label="Previous image"
            >
              &#8249;
            </button>
            <button
              className={`${styles.navBtn} ${styles.navNext}`}
              onClick={next}
              aria-label="Next image"
            >
              &#8250;
            </button>
          </>
        )}

        <Image
          src={current.src}
          alt={current.alt}
          loading="eager"
          objectFit="contain"
        />

        {current.caption && (
          <p className={styles.caption}>{current.caption}</p>
        )}

        {images.length > 1 && (
          <p className={styles.counter}>
            {index + 1} / {images.length}
          </p>
        )}
      </div>
    </div>
  );
}
