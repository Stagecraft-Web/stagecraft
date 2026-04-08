import { useState } from "react";
import Image from "./Image";
import Lightbox from "./Lightbox";

interface Photo {
  src: string;
  alt: string;
  caption?: string;
}

interface PhotoGalleryProps {
  photos: Photo[];
}

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
    gap: "1.5rem",
  },
  item: {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    borderRadius: "var(--radius)",
    overflow: "hidden",
    textAlign: "left" as const,
  },
  caption: {
    display: "block",
    padding: "0.5rem 0",
    fontSize: "var(--font-size-sm)",
    color: "var(--color-text-muted)",
  },
};

export default function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <>
      <div style={styles.grid}>
        {photos.map((photo, i) => (
          <button
            key={i}
            style={styles.item}
            onClick={() => setLightboxIndex(i)}
            aria-label={`View ${photo.alt}`}
          >
            <Image src={photo.src} alt={photo.alt} aspectRatio="4/3" />
            {photo.caption && <span style={styles.caption}>{photo.caption}</span>}
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
