import { describe, expect, it, vi } from "vitest";

import { uploadImageFromClient, EDITOR_UPLOAD_SLUG } from "./upload-image-client";

function makeFile(size: number, type: string, name = "x.jpg"): File {
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type });
}

const MIN_VALID_METADATA = {
  id: "abc1234567890def",
  alt: "x",
  width: 800,
  height: 600,
  placeholderDataUri: "data:image/webp;base64,AAAA",
  contentSlug: EDITOR_UPLOAD_SLUG,
  originalExt: "jpg" as const,
};

describe("uploadImageFromClient", () => {
  it("rejects empty file with code=empty before any fetch", async () => {
    const fetchMock = vi.fn();
    await expect(
      uploadImageFromClient({
        file: makeFile(0, "image/jpeg"),
        alt: "x",
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "empty" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects oversized file with code=too-large", async () => {
    const fetchMock = vi.fn();
    await expect(
      uploadImageFromClient({
        file: makeFile(26 * 1024 * 1024, "image/jpeg"),
        alt: "x",
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "too-large" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported mime with code=invalid-mime", async () => {
    const fetchMock = vi.fn();
    await expect(
      uploadImageFromClient({
        file: makeFile(100, "text/plain", "x.txt"),
        alt: "x",
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "invalid-mime" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("happy path: POSTs the form to /api/upload-image and returns parsed metadata", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, image: MIN_VALID_METADATA }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const result = await uploadImageFromClient({
      file: makeFile(1024, "image/jpeg"),
      alt: "hero",
      contentSlug: "homepage",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.id).toBe("abc1234567890def");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
  });

  it("defaults contentSlug to EDITOR_UPLOAD_SLUG when not provided", async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: { body: FormData }) => {
      // assert here so we capture the form contents at call time
      const body = init.body;
      expect(body.get("contentSlug")).toBe(EDITOR_UPLOAD_SLUG);
      return new Response(JSON.stringify({ ok: true, image: MIN_VALID_METADATA }), { status: 200 });
    });
    await uploadImageFromClient({
      file: makeFile(1024, "image/jpeg"),
      alt: "x",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
  });

  it("maps server error JSON to code=server-error with the server's message", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, error: "boom" }), { status: 500 }),
    );
    await expect(
      uploadImageFromClient({
        file: makeFile(1024, "image/jpeg"),
        alt: "x",
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "server-error", message: "boom" });
  });

  it("maps fetch throw to code=request-failed", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(
      uploadImageFromClient({
        file: makeFile(1024, "image/jpeg"),
        alt: "x",
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "request-failed" });
  });
});
