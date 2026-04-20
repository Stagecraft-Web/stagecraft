import { describe, it, expect } from "vitest";
import { validateVideoProps, withoutAutoplay } from "./resolveSource";

describe("validateVideoProps", () => {
  it("returns a collection-mode result when slug is set", () => {
    const result = validateVideoProps({ slug: "live-session" });
    expect(result).toEqual({ mode: "collection", slug: "live-session" });
  });

  it("returns a url-mode result when url + type are set", () => {
    const result = validateVideoProps({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      type: "youtube",
      title: "Custom",
    });
    expect(result).toEqual({
      mode: "url",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      type: "youtube",
      title: "Custom",
    });
  });

  it("preserves an undefined title in url mode", () => {
    const result = validateVideoProps({
      url: "https://vimeo.com/123",
      type: "vimeo",
    });
    expect(result.mode).toBe("url");
    if (result.mode === "url") {
      expect(result.title).toBeUndefined();
    }
  });

  it("throws when neither slug nor url is provided", () => {
    expect(() => validateVideoProps({})).toThrow(/exactly one of/);
  });

  it("throws when both slug and url are provided", () => {
    expect(() =>
      validateVideoProps({
        slug: "live-session",
        url: "https://www.youtube.com/watch?v=abc",
        type: "youtube",
      }),
    ).toThrow(/exactly one of/);
  });

  it("throws when url is provided without type", () => {
    expect(() =>
      validateVideoProps({ url: "https://www.youtube.com/watch?v=abc" }),
    ).toThrow(/`type` is required/);
  });

  it("throws when type is not youtube or vimeo", () => {
    expect(() =>
      // @ts-expect-error -- exercising the runtime guard
      validateVideoProps({ url: "https://example.com", type: "other" }),
    ).toThrow(/must be "youtube" or "vimeo"/);
  });

  it("treats an empty-string slug as missing", () => {
    expect(() => validateVideoProps({ slug: "" })).toThrow(/exactly one of/);
  });
});

describe("withoutAutoplay", () => {
  it("removes autoplay=1 when it's the only param", () => {
    expect(withoutAutoplay("https://example.com/video?autoplay=1")).toBe(
      "https://example.com/video",
    );
  });

  it("removes autoplay=1 when other params follow", () => {
    expect(
      withoutAutoplay(
        "https://www.youtube-nocookie.com/embed/abc?autoplay=1&rel=0",
      ),
    ).toBe("https://www.youtube-nocookie.com/embed/abc?rel=0");
  });

  it("removes autoplay=1 when other params precede", () => {
    expect(
      withoutAutoplay("https://player.vimeo.com/video/123?h=ff&autoplay=1"),
    ).toBe("https://player.vimeo.com/video/123?h=ff");
  });

  it("leaves URLs without autoplay untouched", () => {
    expect(
      withoutAutoplay("https://www.youtube-nocookie.com/embed/abc?rel=0"),
    ).toBe("https://www.youtube-nocookie.com/embed/abc?rel=0");
  });

  it("returns malformed input untouched", () => {
    expect(withoutAutoplay("not a url")).toBe("not a url");
  });
});
