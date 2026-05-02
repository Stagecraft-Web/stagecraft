import { useState, useEffect, useCallback } from "react";
import Image from "./Image";
import styles from "./Lightbox.module.css";

interface LightboxProps {
  images: { src: string; alt: string; caption?: string }[];
  /**
   * Custom event name to listen on. Defaults to "open-lightbox".
   * Override when multiple Lightbox instances co-exist on the same page
   * (e.g. one per Download item), so their open-events don't collide.
   */
  eventName?: string;
}

export default function Lightbox({ images, eventName = "open-lightbox" }: LightboxProps) {
  const [index, setIndex] = useState<number | null>(null);

  const close = useCallback(() => setIndex(null), []);

  const next = useCallback(() => {
    setIndex((i) => (i !== null ? (i + 1) % images.length : null));
  }, [images.length]);

  const prev = useCallback(() => {
    setIndex((i) => (i !== null ? (i - 1 + images.length) % images.length : null));
  }, [images.length]);

  useEffect(() => {
    function handleOpen(e: Event) {
      const detail = (e as CustomEvent<{ index: number }>).detail;
      setIndex(detail.index);
    }
    window.addEventListener(eventName, handleOpen);
    return () => window.removeEventListener(eventName, handleOpen);
  }, [eventName]);

  useEffect(() => {
    if (index === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index, close, next, prev]);

  if (index === null) return null;
  const current = images[index];
  if (!current) return null;

  return (
    <div className={styles.overlay} onClick={close} role="dialog" aria-label="Image lightbox">
      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={close} aria-label="Close lightbox">
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
