import { describe, expect, it } from "vitest";
import {
  extractBandcampAlbumId,
  extractSpotifyAlbumId,
  extractVimeoVideoId,
  extractYouTubeVideoId,
  resolveMediaEmbed,
} from "./toEmbedUrl";

describe("extractSpotifyAlbumId", () => {
  it("accepts a bare 22-char album ID", () => {
    expect(extractSpotifyAlbumId("4uLU6hMCjMI75M1A2tKUQC")).toBe(
      "4uLU6hMCjMI75M1A2tKUQC",
    );
  });
  it("extracts ID from open.spotify.com/album/<id>", () => {
    expect(
      extractSpotifyAlbumId("https://open.spotify.com/album/4uLU6hMCjMI75M1A2tKUQC"),
    ).toBe("4uLU6hMCjMI75M1A2tKUQC");
  });
  it("extracts ID with locale segment (intl-en)", () => {
    expect(
      extractSpotifyAlbumId(
        "https://open.spotify.com/intl-en/album/4uLU6hMCjMI75M1A2tKUQC?si=abc",
      ),
    ).toBe("4uLU6hMCjMI75M1A2tKUQC");
  });
  it("extracts ID from /embed/album/<id>", () => {
    expect(
      extractSpotifyAlbumId("https://open.spotify.com/embed/album/4uLU6hMCjMI75M1A2tKUQC"),
    ).toBe("4uLU6hMCjMI75M1A2tKUQC");
  });
  it("rejects unrelated hosts", () => {
    expect(extractSpotifyAlbumId("https://example.com/album/4uLU6hMCjMI75M1A2tKUQC")).toBeNull();
  });
  it("rejects empty input", () => {
    expect(extractSpotifyAlbumId("")).toBeNull();
    expect(extractSpotifyAlbumId("   ")).toBeNull();
  });
});

describe("extractBandcampAlbumId", () => {
  it("accepts a bare numeric ID", () => {
    expect(extractBandcampAlbumId("2089841200")).toBe("2089841200");
  });
  it("extracts album=<id> from a full embed URL", () => {
    expect(
      extractBandcampAlbumId(
        "https://bandcamp.com/EmbeddedPlayer/album=2089841200/size=large/bgcol=ffffff/",
      ),
    ).toBe("2089841200");
  });
  it("rejects a public album URL (no ID present)", () => {
    expect(extractBandcampAlbumId("https://artist.bandcamp.com/album/some-slug")).toBeNull();
  });
  it("rejects empty input", () => {
    expect(extractBandcampAlbumId("")).toBeNull();
  });
});

describe("extractYouTubeVideoId", () => {
  it("accepts a bare 11-char video ID", () => {
    expect(extractYouTubeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extracts from watch?v=", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });
  it("extracts from youtu.be short link", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extracts from /embed/<id>", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });
  it("extracts from /shorts/<id>", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });
});

describe("extractVimeoVideoId", () => {
  it("accepts a bare numeric ID", () => {
    expect(extractVimeoVideoId("12345678")).toBe("12345678");
  });
  it("extracts from vimeo.com/<id>", () => {
    expect(extractVimeoVideoId("https://vimeo.com/12345678")).toBe("12345678");
  });
  it("extracts from player.vimeo.com/video/<id>", () => {
    expect(extractVimeoVideoId("https://player.vimeo.com/video/12345678")).toBe("12345678");
  });
  it("rejects non-numeric path", () => {
    expect(extractVimeoVideoId("https://vimeo.com/some-slug")).toBeNull();
  });
});

describe("resolveMediaEmbed", () => {
  it("builds a Spotify embed URL", () => {
    const r = resolveMediaEmbed("spotify-album", "4uLU6hMCjMI75M1A2tKUQC");
    expect(r.embedUrl).toBe("https://open.spotify.com/embed/album/4uLU6hMCjMI75M1A2tKUQC");
    expect(r.serviceLabel).toBe("Spotify");
  });
  it("builds a Bandcamp embed URL with the standard layout params", () => {
    const r = resolveMediaEmbed("bandcamp-album", "2089841200");
    expect(r.embedUrl).toContain("bandcamp.com/EmbeddedPlayer/album=2089841200/");
    expect(r.embedUrl).toContain("size=large");
  });
  it("builds a YouTube nocookie embed URL with 16:9 ratio", () => {
    const r = resolveMediaEmbed("youtube-video", "https://youtu.be/dQw4w9WgXcQ");
    expect(r.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(r.aspectRatio).toBe("16 / 9");
  });
  it("builds a Vimeo player embed URL with 16:9 ratio", () => {
    const r = resolveMediaEmbed("vimeo-video", "https://vimeo.com/12345678");
    expect(r.embedUrl).toBe("https://player.vimeo.com/video/12345678");
    expect(r.aspectRatio).toBe("16 / 9");
  });
  it("returns embedUrl=null when input is unparsable", () => {
    expect(resolveMediaEmbed("youtube-video", "not a url").embedUrl).toBeNull();
    expect(resolveMediaEmbed("spotify-album", "too-short").embedUrl).toBeNull();
  });
});
