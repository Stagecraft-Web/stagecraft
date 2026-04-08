import { useState } from "react";
import Lightbox from "./Lightbox";

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
      <div className="photo-gallery-grid">
        {photos.map((photo, i) => (
          <button
            key={i}
            className="photo-gallery-item"
            onClick={() => setLightboxIndex(i)}
            aria-label={`View ${photo.alt}`}
          >
            <img src={photo.src} alt={photo.alt} loading="lazy" />
            {photo.caption && <span className="photo-gallery-caption">{photo.caption}</span>}
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
