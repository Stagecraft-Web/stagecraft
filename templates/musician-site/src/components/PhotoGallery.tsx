import { useState } from "react";
import Image from "./Image";
import Lightbox from "./Lightbox";
import styles from "./PhotoGallery.module.css";

interface Photo {
  src: string;
  alt: string;
  caption?: string;
}

interface PhotoGalleryProps {
  photos: Photo[];
}

export default function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <>
      <div className={styles.grid}>
        {photos.map((photo, i) => (
          <button
            key={i}
            className={styles.item}
            onClick={() => setLightboxIndex(i)}
            aria-label={`View ${photo.alt}`}
          >
            <Image src={photo.src} alt={photo.alt} aspectRatio="4/3" />
            {photo.caption && <span className={styles.caption}>{photo.caption}</span>}
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
