import { NextResponse } from "next/server";
import { z } from "zod";

import { processImage } from "@/lib/image";
import {
  ALLOWED_INPUT_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  type AllowedInputMimeType,
  type ImageMetadata,
  uploadResponseSchema,
} from "@/lib/image-types";

const fieldsSchema = z.object({
  contentSlug: z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9-]*$/),
  alt: z.string().max(500),
});

const MIME_TO_EXT: Record<AllowedInputMimeType, ImageMetadata["originalExt"]> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

function err(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return err(400, "expected multipart/form-data");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return err(400, "missing file");
  }

  if (file.size === 0) {
    return err(400, "empty file");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return err(413, "file too large");
  }

  const mime = file.type;
  if (!ALLOWED_INPUT_MIME_TYPES.includes(mime as AllowedInputMimeType)) {
    return err(415, `unsupported type: ${mime || "unknown"}`);
  }

  const fields = fieldsSchema.safeParse({
    contentSlug: formData.get("contentSlug"),
    alt: formData.get("alt") ?? "",
  });
  if (!fields.success) {
    return err(400, `invalid fields: ${fields.error.message}`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await processImage({
    buffer,
    contentSlug: fields.data.contentSlug,
    alt: fields.data.alt,
    originalExt: MIME_TO_EXT[mime as AllowedInputMimeType],
  });

  return NextResponse.json(uploadResponseSchema.parse({ ok: true, image: result.metadata }));
}
