import { useState, useEffect, useCallback } from "react";
import styles from "./VideoLightbox.module.css";
import type { EmbeddableVideo } from "../content-components/VideoGallery/toEmbeddable";

interface VideoLightboxProps {
  videos: EmbeddableVideo[];
}

export default function VideoLightbox({ videos }: VideoLightboxProps) {
  const [index, setIndex] = useState<number | null>(null);

  const close = useCallback(() => setIndex(null), []);

  useEffect(() => {
    function handleOpen(e: Event) {
      const detail = (e as CustomEvent<{ index: number }>).detail;
      setIndex(detail.index);
    }
    window.addEventListener("open-video-lightbox", handleOpen);
    return () => window.removeEventListener("open-video-lightbox", handleOpen);
  }, []);

  useEffect(() => {
    if (index === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index, close]);

  if (index === null) return null;
  const current = videos[index];
  if (!current || !current.embedUrl) return null;

  return (
    <div
      className={styles.overlay}
      onClick={close}
      role="dialog"
      aria-label={`Video player: ${current.title}`}
    >
      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.closeBtn}
          onClick={close}
          aria-label="Close video"
        >
          &times;
        </button>
        <div className={styles.frameWrap}>
          <iframe
            src={current.embedUrl}
            title={current.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className={styles.frame}
          />
        </div>
        {current.title && <p className={styles.caption}>{current.title}</p>}
      </div>
    </div>
  );
}
