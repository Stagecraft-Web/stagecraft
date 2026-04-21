import { describe, expect, it } from "vitest";
import { defaultAspectForKind, inferMediaKind } from "./inferMediaKind";

describe("inferMediaKind", () => {
  it("returns 'none' when path is missing", () => {
    expect(inferMediaKind(undefined)).toBe("none");
  });

  describe("photo extensions", () => {
    it.each(["jpg", "jpeg", "png", "webp", "avif", "gif", "svg"])(
      "infers photo from .%s",
      (ext) => {
        expect(inferMediaKind(`./hero.${ext}`)).toBe("photo");
      },
    );

    it("is case-insensitive", () => {
      expect(inferMediaKind("./HERO.JPG")).toBe("photo");
    });
  });

  describe("audio extensions", () => {
    it.each(["mp3", "wav", "ogg", "m4a", "flac", "aac"])(
      "infers audio from .%s",
      (ext) => {
        expect(inferMediaKind(`./song.${ext}`)).toBe("audio");
      },
    );
  });

  describe("video extensions", () => {
    it.each(["mp4", "webm", "mov", "mkv", "m4v"])(
      "infers video from .%s",
      (ext) => {
        expect(inferMediaKind(`./reel.${ext}`)).toBe("video");
      },
    );
  });

  it("infers pdf from .pdf", () => {
    expect(inferMediaKind("./one-sheet.pdf")).toBe("pdf");
  });

  it("falls back to 'icon' for unknown extensions", () => {
    expect(inferMediaKind("./bundle.zip")).toBe("icon");
    expect(inferMediaKind("./stems.stem")).toBe("icon");
  });

  it("falls back to 'icon' when there's no extension at all", () => {
    expect(inferMediaKind("./README")).toBe("icon");
  });

  describe("URL handling", () => {
    it("ignores query strings", () => {
      expect(inferMediaKind("https://cdn.example.com/x.jpg?v=3")).toBe("photo");
    });

    it("ignores fragments", () => {
      expect(inferMediaKind("https://cdn.example.com/x.mp3#t=30")).toBe("audio");
    });

    it("handles deeply-nested paths", () => {
      expect(inferMediaKind("/a/b/c/d/file.pdf")).toBe("pdf");
    });
  });
});

describe("defaultAspectForKind", () => {
  it.each(["photo", "video", "audio", "pdf", "icon"] as const)(
    "%s defaults to 4:3 (so mixed lists align horizontally)",
    (kind) => {
      expect(defaultAspectForKind(kind)).toBe("4:3");
    },
  );

  it("'none' (no media) defaults to auto", () => {
    expect(defaultAspectForKind("none")).toBe("auto");
  });
});
