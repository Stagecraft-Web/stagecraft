import { useState, useEffect, useCallback } from "react";
import Image from "./Image";

interface LightboxProps {
  images: { src: string; alt: string; caption?: string }[];
  initialIndex?: number;
  onClose: () => void;
}

const styles = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 1000,
    background: "var(--color-overlay)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    position: "relative" as const,
    maxWidth: "90vw",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
  },
  closeBtn: {
    position: "absolute" as const,
    top: "-2rem",
    right: "-1rem",
    background: "none",
    border: "none",
    color: "var(--color-white)",
    fontSize: "2rem",
    cursor: "pointer",
    padding: "0.5rem",
  },
  navBtn: {
    position: "absolute" as const,
    top: "50%",
    transform: "translateY(-50%)",
    background: "var(--color-overlay-light)",
    border: "none",
    color: "var(--color-white)",
    fontSize: "2rem",
    cursor: "pointer",
    padding: "0.5rem 1rem",
    borderRadius: "4px",
  },
  caption: {
    color: "var(--color-text-light)",
    marginTop: "0.75rem",
    fontSize: "var(--font-size-lg)",
  },
  counter: {
    color: "var(--color-text-light)",
    fontSize: "var(--font-size-sm)",
    marginTop: "0.25rem",
  },
};

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
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-label="Image lightbox">
      <div style={styles.content} onClick={(e) => e.stopPropagation()}>
        <button style={styles.closeBtn} onClick={onClose} aria-label="Close lightbox">
          &times;
        </button>

        {images.length > 1 && (
          <>
            <button
              style={{ ...styles.navBtn, left: "-3rem" }}
              onClick={prev}
              aria-label="Previous image"
            >
              &#8249;
            </button>
            <button
              style={{ ...styles.navBtn, right: "-3rem" }}
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
          <p style={styles.caption}>{current.caption}</p>
        )}

        {images.length > 1 && (
          <p style={styles.counter}>
            {index + 1} / {images.length}
          </p>
        )}
      </div>
    </div>
  );
}
