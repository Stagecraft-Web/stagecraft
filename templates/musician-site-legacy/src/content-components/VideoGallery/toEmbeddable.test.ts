import { describe, it, expect } from "vitest";
import { extractYouTubeId, extractVimeoId, toEmbeddable } from "./toEmbeddable";

describe("extractYouTubeId", () => {
  it("parses watch URLs", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("parses youtu.be short URLs", () => {
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("parses embed URLs", () => {
    expect(extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("parses shorts URLs", () => {
    expect(extractYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("returns null for non-YouTube URLs", () => {
    expect(extractYouTubeId("https://example.com/watch?v=nope")).toBeNull();
  });
  it("returns null for malformed URLs", () => {
    expect(extractYouTubeId("not a url")).toBeNull();
  });
});

describe("extractVimeoId", () => {
  it("parses vimeo.com/ID URLs", () => {
    expect(extractVimeoId("https://vimeo.com/123456789")).toBe("123456789");
  });
  it("parses player.vimeo.com/video/ID URLs", () => {
    expect(extractVimeoId("https://player.vimeo.com/video/123456789")).toBe("123456789");
  });
  it("returns null for non-Vimeo URLs", () => {
    expect(extractVimeoId("https://youtube.com/watch?v=abc")).toBeNull();
  });
  it("returns null when the path segment is not numeric", () => {
    expect(extractVimeoId("https://vimeo.com/channels/staffpicks")).toBeNull();
  });
});

describe("toEmbeddable", () => {
  it("produces an embeddable YouTube video", () => {
    const result = toEmbeddable({
      title: "Test",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      type: "youtube",
    });
    expect(result.isEmbeddable).toBe(true);
    expect(result.embedUrl).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(result.thumbnailUrl).toContain("img.youtube.com/vi/dQw4w9WgXcQ");
  });

  it("produces an embeddable Vimeo video with no thumbnail", () => {
    const result = toEmbeddable({
      title: "Test",
      url: "https://vimeo.com/123456789",
      type: "vimeo",
    });
    expect(result.isEmbeddable).toBe(true);
    expect(result.embedUrl).toContain("player.vimeo.com/video/123456789");
    expect(result.thumbnailUrl).toBeNull();
  });

  it("falls back to link-out for type=other", () => {
    const result = toEmbeddable({
      title: "Test",
      url: "https://example.com/video",
      type: "other",
    });
    expect(result.isEmbeddable).toBe(false);
    expect(result.embedUrl).toBeNull();
  });

  it("falls back to link-out when YouTube ID cannot be parsed", () => {
    const result = toEmbeddable({
      title: "Test",
      url: "https://example.com/not-youtube",
      type: "youtube",
    });
    expect(result.isEmbeddable).toBe(false);
    expect(result.embedUrl).toBeNull();
  });
});
