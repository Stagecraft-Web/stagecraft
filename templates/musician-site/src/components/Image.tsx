import { IMAGE_VARIANT_FORMATS, IMAGE_VARIANT_WIDTHS, type ImageMetadata } from "@/lib/image-types";

type Props = {
  image: ImageMetadata;
  /** Hint to the browser for sizing. Default: 100vw. */
  sizes?: string;
  className?: string;
};

function variantPath(image: ImageMetadata, width: number, format: string): string {
  return `/images/${image.contentSlug}/${image.id}/${width}.${format}`;
}

function srcSetForFormat(image: ImageMetadata, format: string): string {
  return IMAGE_VARIANT_WIDTHS.filter((w) => w <= image.width)
    .map((w) => `${variantPath(image, w, format)} ${w}w`)
    .join(", ");
}

export function Image({ image, sizes = "100vw", className }: Props) {
  const fallback = `${variantPath(image, Math.min(800, image.width), "webp")}`;

  return (
    <picture>
      {IMAGE_VARIANT_FORMATS.map((format) => (
        <source
          key={format}
          type={`image/${format}`}
          srcSet={srcSetForFormat(image, format)}
          sizes={sizes}
        />
      ))}
      <img
        src={fallback}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading="lazy"
        decoding="async"
        className={className}
        style={{
          backgroundImage: `url(${image.placeholderDataUri})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    </picture>
  );
}
