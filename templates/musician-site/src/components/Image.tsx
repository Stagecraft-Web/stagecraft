import { useState } from "react";

interface ImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  /** Aspect ratio for the container (e.g. "4/3", "16/9") */
  aspectRatio?: string;
  /** Object-fit behavior */
  objectFit?: "cover" | "contain" | "fill";
}

export default function Image({
  src,
  alt,
  className,
  loading = "lazy",
  aspectRatio,
  objectFit = "cover",
}: ImageProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  return (
    <div
      className={`site-image ${className ?? ""}`}
      style={{
        aspectRatio,
        position: "relative",
        overflow: "hidden",
        backgroundColor: status !== "loaded" ? "var(--color-border)" : undefined,
      }}
    >
      {status === "error" ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            minHeight: 120,
            color: "var(--color-text-muted)",
            fontSize: "var(--font-size-sm)",
          }}
        >
          Image unavailable
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={loading}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          style={{
            width: "100%",
            height: "100%",
            objectFit,
            opacity: status === "loaded" ? 1 : 0,
            transition: "opacity 0.2s ease",
          }}
        />
      )}
    </div>
  );
}
