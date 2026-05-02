import { z } from "zod";

export const IMAGE_VARIANT_WIDTHS = [400, 800, 1600] as const;
export type ImageVariantWidth = (typeof IMAGE_VARIANT_WIDTHS)[number];

export const IMAGE_VARIANT_FORMATS = ["webp", "avif"] as const;
export type ImageVariantFormat = (typeof IMAGE_VARIANT_FORMATS)[number];

export const ALLOWED_INPUT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;
export type AllowedInputMimeType = (typeof ALLOWED_INPUT_MIME_TYPES)[number];

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

declare const imageIdBrand: unique symbol;
export type ImageId = string & { readonly [imageIdBrand]: never };
export const asImageId = (s: string): ImageId => s as ImageId;

export const imageMetadataSchema = z.object({
  id: z.string().min(1).transform(asImageId),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  placeholderDataUri: z.string().regex(/^data:image\/webp;base64,/),
  contentSlug: z.string().min(1),
  originalExt: z.enum(["jpg", "jpeg", "png", "webp", "avif"]),
});

export type ImageMetadata = z.infer<typeof imageMetadataSchema>;

export const uploadResponseSchema = z.object({ ok: z.literal(true), image: imageMetadataSchema });
export type UploadResponse = z.infer<typeof uploadResponseSchema>;

export const uploadErrorSchema = z.object({ ok: z.literal(false), error: z.string() });
export type UploadError = z.infer<typeof uploadErrorSchema>;
