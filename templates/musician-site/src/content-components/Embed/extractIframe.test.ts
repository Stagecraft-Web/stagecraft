import { describe, expect, it } from "vitest";
import { extractIframe, extractEmbedHost } from "./extractIframe";

// Real-world embed snippets gathered from each service's "Share / Embed" UI.
// Kept verbatim so this test doubles as documentation of the input shapes
// the parser is expected to handle.
const SPOTIFY_ALBUM = `<iframe style="border-radius:12px" src="https://open.spotify.com/embed/album/1DFixLWuPkv3KT3TnV35m3?utm_source=generator" width="100%" height="352" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;

const BANDCAMP_ALBUM = `<iframe style="border: 0; width: 350px; height: 470px;" src="https://bandcamp.com/EmbeddedPlayer/album=2940998191/size=large/bgcol=ffffff/linkcol=0687f5/artwork=small/transparent=true/" seamless><a href="https://pumpkinbreadband.bandcamp.com/album/pumpkin-bread-ep">Pumpkin Bread EP by Pumpkin Bread</a></iframe>`;

const YOUTUBE_VIDEO = `<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;

const VIMEO_VIDEO = `<iframe src="https://player.vimeo.com/video/76979871?h=8272103f6e&color=ffffff&title=0&byline=0&portrait=0" width="640" height="360" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;

const SOUNDCLOUD_TRACK = `<iframe width="100%" height="300" scrolling="no" frameborder="no" allow="autoplay" src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/293&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true"></iframe>`;

describe("extractIframe", () => {
  describe("happy path: real-world snippets", () => {
    it("parses a Spotify album embed", () => {
      const parsed = extractIframe(SPOTIFY_ALBUM);
      expect(parsed).not.toBeNull();
      expect(parsed!.attributes.src).toBe(
        "https://open.spotify.com/embed/album/1DFixLWuPkv3KT3TnV35m3?utm_source=generator",
      );
      expect(parsed!.attributes.width).toBe("100%");
      expect(parsed!.attributes.height).toBe("352");
      expect(parsed!.attributes.style).toBe("border-radius:12px");
      expect(parsed!.attributes.allow).toContain("autoplay");
      expect(parsed!.attributes.loading).toBe("lazy");
      expect(parsed!.attributes.allowfullscreen).toBe("");
      expect(parsed!.attributes.frameborder).toBe("0");
    });

    it("parses a Bandcamp album embed (single-quoted style not used here)", () => {
      const parsed = extractIframe(BANDCAMP_ALBUM);
      expect(parsed).not.toBeNull();
      expect(parsed!.attributes.src).toContain("bandcamp.com/EmbeddedPlayer/album=2940998191");
      expect(parsed!.attributes.style).toContain("width: 350px");
    });

    it("parses a YouTube embed", () => {
      const parsed = extractIframe(YOUTUBE_VIDEO);
      expect(parsed).not.toBeNull();
      expect(parsed!.attributes.src).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
      expect(parsed!.attributes.title).toBe("YouTube video player");
      expect(parsed!.attributes.allowfullscreen).toBe("");
    });

    it("parses a Vimeo embed", () => {
      const parsed = extractIframe(VIMEO_VIDEO);
      expect(parsed).not.toBeNull();
      expect(parsed!.attributes.src).toContain("player.vimeo.com/video/76979871");
      expect(parsed!.attributes.width).toBe("640");
      expect(parsed!.attributes.height).toBe("360");
    });

    it("parses a SoundCloud embed", () => {
      const parsed = extractIframe(SOUNDCLOUD_TRACK);
      expect(parsed).not.toBeNull();
      expect(parsed!.attributes.src).toContain("w.soundcloud.com/player/");
    });
  });

  describe("attribute allowlisting", () => {
    it("drops referrerpolicy (not on allowlist)", () => {
      const parsed = extractIframe(YOUTUBE_VIDEO);
      expect(parsed).not.toBeNull();
      expect(parsed!.attributes).not.toHaveProperty("referrerpolicy");
    });

    it("drops srcdoc, name, sandbox, scrolling, and other unlisted attrs", () => {
      const malicious = `<iframe src="https://example.com" srcdoc="<script>alert(1)</script>" name="bad" sandbox="allow-scripts" scrolling="no" data-tracking="42" id="x" class="y" onload="alert(1)"></iframe>`;
      const parsed = extractIframe(malicious);
      expect(parsed).not.toBeNull();
      expect(parsed!.attributes.src).toBe("https://example.com");
      expect(parsed!.attributes).not.toHaveProperty("srcdoc");
      expect(parsed!.attributes).not.toHaveProperty("name");
      expect(parsed!.attributes).not.toHaveProperty("sandbox");
      expect(parsed!.attributes).not.toHaveProperty("scrolling");
      expect(parsed!.attributes).not.toHaveProperty("data-tracking");
      expect(parsed!.attributes).not.toHaveProperty("id");
      expect(parsed!.attributes).not.toHaveProperty("class");
      expect(parsed!.attributes).not.toHaveProperty("onload");
    });

    it("normalizes attribute names to lowercase (frameBorder -> frameborder)", () => {
      const parsed = extractIframe(SPOTIFY_ALBUM);
      expect(parsed).not.toBeNull();
      expect(parsed!.attributes.frameborder).toBe("0");
    });

    it("supports single-quoted attribute values", () => {
      const snippet = `<iframe src='https://example.com/embed' width='400' height='300'></iframe>`;
      const parsed = extractIframe(snippet);
      expect(parsed).not.toBeNull();
      expect(parsed!.attributes.src).toBe("https://example.com/embed");
      expect(parsed!.attributes.width).toBe("400");
    });

    it("captures allowfullscreen as a bare boolean attribute", () => {
      const snippet = `<iframe src="https://example.com" allowfullscreen></iframe>`;
      const parsed = extractIframe(snippet);
      expect(parsed).not.toBeNull();
      expect(parsed!.attributes.allowfullscreen).toBe("");
    });
  });

  describe("invalid / malformed inputs", () => {
    it("returns null for null / undefined / non-string", () => {
      expect(extractIframe(null)).toBeNull();
      expect(extractIframe(undefined)).toBeNull();
      // @ts-expect-error — runtime guard for non-string inputs
      expect(extractIframe(42)).toBeNull();
    });

    it("returns null for empty / whitespace-only input", () => {
      expect(extractIframe("")).toBeNull();
      expect(extractIframe("   \n  ")).toBeNull();
    });

    it("returns null when no iframe is present", () => {
      expect(extractIframe("<div>just text</div>")).toBeNull();
      expect(extractIframe("https://example.com/embed")).toBeNull();
    });

    it("returns null when iframe has no src attribute", () => {
      expect(extractIframe(`<iframe width="400" height="300"></iframe>`)).toBeNull();
    });

    it("ignores leading wrapper markup and finds the first iframe", () => {
      const wrapped = `<div class="foo"><p>oops</p>${SPOTIFY_ALBUM}</div>`;
      const parsed = extractIframe(wrapped);
      expect(parsed).not.toBeNull();
      expect(parsed!.attributes.src).toContain("open.spotify.com");
    });
  });
});

describe("extractEmbedHost", () => {
  it("returns the host for a normal URL", () => {
    expect(extractEmbedHost("https://open.spotify.com/embed/album/123")).toBe("open.spotify.com");
    expect(extractEmbedHost("https://www.youtube.com/embed/abc")).toBe("www.youtube.com");
    expect(extractEmbedHost("https://bandcamp.com/EmbeddedPlayer/album=1")).toBe("bandcamp.com");
  });

  it("handles protocol-relative URLs", () => {
    expect(extractEmbedHost("//player.vimeo.com/video/123")).toBe("player.vimeo.com");
  });

  it("returns null for malformed URLs", () => {
    expect(extractEmbedHost("not a url")).toBeNull();
    expect(extractEmbedHost("")).toBeNull();
    expect(extractEmbedHost(null)).toBeNull();
    expect(extractEmbedHost(undefined)).toBeNull();
  });
});
