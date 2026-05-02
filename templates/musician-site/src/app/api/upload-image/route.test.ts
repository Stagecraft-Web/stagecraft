import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";

import { POST } from "./route";
import { uploadErrorSchema, uploadResponseSchema } from "@/lib/image-types";

const TEST_SLUG = "route-test";
const TEST_PUBLIC = path.join(process.cwd(), "public/images", TEST_SLUG);

async function cleanup() {
  await fs.rm(TEST_PUBLIC, { recursive: true, force: true });
}

beforeEach(cleanup);
afterAll(cleanup);

async function jpegBuffer(width = 800, height = 600): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 100, g: 100, b: 100 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

function buildRequest(form: FormData): Request {
  return new Request("http://localhost/api/upload-image", { method: "POST", body: form });
}

describe("POST /api/upload-image", () => {
  it("happy path: returns valid metadata for a JPEG", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(await jpegBuffer())], { type: "image/jpeg" }), "photo.jpg");
    fd.append("contentSlug", TEST_SLUG);
    fd.append("alt", "test photo");

    const res = await POST(buildRequest(fd));
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = uploadResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.image.alt).toBe("test photo");
      expect(parsed.data.image.contentSlug).toBe(TEST_SLUG);
      expect(parsed.data.image.originalExt).toBe("jpg");
    }
  });

  it("rejects missing file", async () => {
    const fd = new FormData();
    fd.append("contentSlug", TEST_SLUG);
    fd.append("alt", "x");

    const res = await POST(buildRequest(fd));
    expect(res.status).toBe(400);
    expect(uploadErrorSchema.safeParse(await res.json()).success).toBe(true);
  });

  it("rejects empty file", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([], { type: "image/jpeg" }), "empty.jpg");
    fd.append("contentSlug", TEST_SLUG);
    fd.append("alt", "x");

    const res = await POST(buildRequest(fd));
    expect(res.status).toBe(400);
  });

  it("rejects unsupported mime type", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(Buffer.from("not an image"))], { type: "text/plain" }), "x.txt");
    fd.append("contentSlug", TEST_SLUG);
    fd.append("alt", "x");

    const res = await POST(buildRequest(fd));
    expect(res.status).toBe(415);
  });

  it("rejects invalid contentSlug", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(await jpegBuffer())], { type: "image/jpeg" }), "photo.jpg");
    fd.append("contentSlug", "Not A Slug!");
    fd.append("alt", "x");

    const res = await POST(buildRequest(fd));
    expect(res.status).toBe(400);
  });

  it("dedups: re-uploading the same bytes is idempotent", async () => {
    const buffer = await jpegBuffer();

    const upload = async () => {
      const fd = new FormData();
      fd.append("file", new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }), "photo.jpg");
      fd.append("contentSlug", TEST_SLUG);
      fd.append("alt", "dedup test");
      return POST(buildRequest(fd));
    };

    const a = await (await upload()).json();
    const b = await (await upload()).json();
    expect(a.image.id).toBe(b.image.id);
  });
});
