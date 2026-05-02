import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import {
  IMAGE_VARIANT_FORMATS,
  IMAGE_VARIANT_WIDTHS,
  type ImageId,
  type ImageMetadata,
  type ImageVariantFormat,
  type ImageVariantWidth,
  asImageId,
} from "./image-types";

const PUBLIC_IMAGES_DIR = path.join(process.cwd(), "public/images");
const HASH_LENGTH = 16;
const PLACEHOLDER_WIDTH = 20;

export type ProcessImageInput = {
  buffer: Buffer;
  contentSlug: string;
  alt: string;
  originalExt: ImageMetadata["originalExt"];
};

export type ProcessImageResult = {
  metadata: ImageMetadata;
  /** True when sharp ran. False when an existing original was found at the target path. */
  processed: boolean;
};

export function computeImageId(buffer: Buffer): ImageId {
  const hex = createHash("sha256").update(buffer).digest("hex").slice(0, HASH_LENGTH);
  return asImageId(hex);
}

export function imageDir(contentSlug: string, id: ImageId): string {
  return path.join(PUBLIC_IMAGES_DIR, contentSlug, id);
}

export function variantFilename(width: ImageVariantWidth, format: ImageVariantFormat): string {
  return `${width}.${format}`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Process an uploaded image: generate variants, write to disk, return metadata.
 * Idempotent: if the original (by content hash) already exists at the target path,
 * skip processing and return existing metadata.
 */
export async function processImage(input: ProcessImageInput): Promise<ProcessImageResult> {
  const id = computeImageId(input.buffer);
  const dir = imageDir(input.contentSlug, id);
  const originalPath = path.join(dir, `original.${input.originalExt}`);

  if (await fileExists(originalPath)) {
    const metadata = await readImageMetadata(input.contentSlug, id, input.alt, input.originalExt);
    return { metadata, processed: false };
  }

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(originalPath, input.buffer);

  const rotated = sharp(input.buffer).rotate();
  const meta = await rotated.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width === 0 || height === 0) {
    throw new Error("could not read image dimensions");
  }

  await Promise.all(
    IMAGE_VARIANT_WIDTHS.flatMap((variantWidth) =>
      IMAGE_VARIANT_FORMATS.map(async (format) => {
        const target = path.join(dir, variantFilename(variantWidth, format));
        const pipeline = sharp(input.buffer)
          .rotate()
          .resize({ width: Math.min(variantWidth, width), withoutEnlargement: true });
        const buffer = await (format === "webp"
          ? pipeline.webp({ quality: 80 }).toBuffer()
          : pipeline.avif({ quality: 60 }).toBuffer());
        await fs.writeFile(target, buffer);
      }),
    ),
  );

  const placeholderBuffer = await sharp(input.buffer)
    .rotate()
    .resize({ width: PLACEHOLDER_WIDTH })
    .webp({ quality: 30 })
    .toBuffer();
  const placeholderDataUri = `data:image/webp;base64,${placeholderBuffer.toString("base64")}`;

  return {
    metadata: {
      id,
      alt: input.alt,
      width,
      height,
      placeholderDataUri,
      contentSlug: input.contentSlug,
      originalExt: input.originalExt,
    },
    processed: true,
  };
}

async function readImageMetadata(
  contentSlug: string,
  id: ImageId,
  alt: string,
  originalExt: ImageMetadata["originalExt"],
): Promise<ImageMetadata> {
  const dir = imageDir(contentSlug, id);
  const buffer = await fs.readFile(path.join(dir, `original.${originalExt}`));
  const meta = await sharp(buffer).rotate().metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const placeholderBuffer = await sharp(buffer)
    .rotate()
    .resize({ width: PLACEHOLDER_WIDTH })
    .webp({ quality: 30 })
    .toBuffer();
  return {
    id,
    alt,
    width,
    height,
    placeholderDataUri: `data:image/webp;base64,${placeholderBuffer.toString("base64")}`,
    contentSlug,
    originalExt,
  };
}
