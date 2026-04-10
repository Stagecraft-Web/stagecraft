import { describe, it, expect } from "vitest";
import {
  stripHtml,
  extractTitle,
  extractDescription,
  extractHeadings,
  extractParagraphs,
  extractImages,
  extractEmbeds,
  extractNavLinks,
  extractSocialLinks,
  resolveUrl,
  isSameDomain,
  inferArtistName,
} from "../migration/crawler";

const BASE = "https://example.com";

// ─── stripHtml ────────────────────────────────────────────────────────────────

describe("stripHtml", () => {
  it("removes basic tags", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("removes script and style blocks entirely", () => {
    const html = `<script>alert("x")</script><style>body{}</style><p>Visible</p>`;
    expect(stripHtml(html)).toBe("Visible");
  });

  it("decodes common entities", () => {
    expect(stripHtml("Tom &amp; Jerry &mdash; a story")).toBe("Tom & Jerry — a story");
  });

  it("collapses whitespace", () => {
    expect(stripHtml("  foo   bar  ")).toBe("foo bar");
  });
});

// ─── extractTitle ─────────────────────────────────────────────────────────────

describe("extractTitle", () => {
  it("extracts <title> tag", () => {
    const html = "<title>Sarah Chen Music | Official Site</title>";
    expect(extractTitle(html)).toBe("Sarah Chen Music | Official Site");
  });

  it("prefers og:title over <title>", () => {
    const html = `
      <title>Fallback</title>
      <meta property="og:title" content="Sarah Chen — Composer">
    `;
    expect(extractTitle(html)).toBe("Sarah Chen — Composer");
  });

  it("returns empty string when no title found", () => {
    expect(extractTitle("<html><body></body></html>")).toBe("");
  });
});

// ─── extractDescription ──────────────────────────────────────────────────────

describe("extractDescription", () => {
  it("extracts meta description", () => {
    const html = `<meta name="description" content="Award-winning cellist based in NYC.">`;
    expect(extractDescription(html)).toBe("Award-winning cellist based in NYC.");
  });

  it("prefers og:description", () => {
    const html = `
      <meta name="description" content="Fallback description">
      <meta property="og:description" content="OG description wins">
    `;
    expect(extractDescription(html)).toBe("OG description wins");
  });
});

// ─── extractHeadings ──────────────────────────────────────────────────────────

describe("extractHeadings", () => {
  it("extracts h1–h3 headings", () => {
    const html = `<h1>Welcome</h1><h2>About <span>Me</span></h2><h3>Contact</h3>`;
    expect(extractHeadings(html)).toEqual(["Welcome", "About Me", "Contact"]);
  });

  it("ignores h4 and below", () => {
    const html = `<h4>Tiny</h4><h1>Big</h1>`;
    expect(extractHeadings(html)).toEqual(["Big"]);
  });
});

// ─── extractParagraphs ───────────────────────────────────────────────────────

describe("extractParagraphs", () => {
  it("extracts paragraphs longer than 30 characters", () => {
    const html = `
      <p>Short</p>
      <p>This is a longer paragraph with meaningful content about the artist.</p>
    `;
    const result = extractParagraphs(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("meaningful content");
  });

  it("filters out short navigation snippets", () => {
    const html = `<p>OK</p><p>Bio: I am a musician who has played for 20 years in various venues.</p>`;
    expect(extractParagraphs(html)).toHaveLength(1);
  });
});

// ─── extractImages ────────────────────────────────────────────────────────────

describe("extractImages", () => {
  it("extracts src and alt attributes", () => {
    const html = `<img src="/hero.jpg" alt="Hero photo">`;
    const imgs = extractImages(html, BASE);
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toEqual({ src: `${BASE}/hero.jpg`, alt: "Hero photo" });
  });

  it("resolves relative URLs against base", () => {
    const html = `<img src="images/portrait.jpg" alt="">`;
    const imgs = extractImages(html, `${BASE}/`);
    expect(imgs[0].src).toBe(`${BASE}/images/portrait.jpg`);
  });

  it("skips data: URIs", () => {
    const html = `<img src="data:image/png;base64,abc" alt="inline">`;
    expect(extractImages(html, BASE)).toHaveLength(0);
  });
});

// ─── extractEmbeds ────────────────────────────────────────────────────────────

describe("extractEmbeds", () => {
  it("classifies YouTube iframe", () => {
    const html = `<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>`;
    const embeds = extractEmbeds(html);
    expect(embeds).toHaveLength(1);
    expect(embeds[0].type).toBe("youtube");
  });

  it("classifies SoundCloud iframe", () => {
    const html = `<iframe src="https://w.soundcloud.com/player/?url=..."></iframe>`;
    expect(extractEmbeds(html)[0].type).toBe("soundcloud");
  });

  it("classifies Spotify iframe", () => {
    const html = `<iframe src="https://open.spotify.com/embed/track/abc"></iframe>`;
    expect(extractEmbeds(html)[0].type).toBe("spotify");
  });

  it("classifies Bandcamp iframe", () => {
    const html = `<iframe src="https://bandcamp.com/EmbeddedPlayer/..."></iframe>`;
    expect(extractEmbeds(html)[0].type).toBe("bandcamp");
  });

  it("labels unknown iframes as other", () => {
    const html = `<iframe src="https://widget.example.com/player"></iframe>`;
    expect(extractEmbeds(html)[0].type).toBe("other");
  });
});

// ─── extractNavLinks ─────────────────────────────────────────────────────────

describe("extractNavLinks", () => {
  it("extracts links from <nav>", () => {
    const html = `
      <nav>
        <a href="/about">About</a>
        <a href="/music">Music</a>
        <a href="https://instagram.com/artist">Instagram</a>
      </nav>
    `;
    const links = extractNavLinks(html, BASE);
    expect(links.map((l) => l.text)).toContain("About");
    expect(links.map((l) => l.text)).toContain("Music");
  });

  it("resolves relative hrefs", () => {
    const html = `<nav><a href="/contact">Contact</a></nav>`;
    const links = extractNavLinks(html, BASE);
    expect(links[0].href).toBe(`${BASE}/contact`);
  });

  it("skips fragment-only links", () => {
    const html = `<nav><a href="#section">Skip</a><a href="/about">About</a></nav>`;
    const links = extractNavLinks(html, BASE);
    expect(links.every((l) => !l.href.startsWith(BASE + "#"))).toBe(true);
  });
});

// ─── extractSocialLinks ──────────────────────────────────────────────────────

describe("extractSocialLinks", () => {
  it("detects Instagram link", () => {
    const html = `<a href="https://www.instagram.com/sarahchenmusic">Instagram</a>`;
    const links = extractSocialLinks(html, BASE);
    expect(links.some((l) => l.text === "Instagram")).toBe(true);
  });

  it("detects mailto link", () => {
    const html = `<a href="mailto:hello@sarahchen.com">Email me</a>`;
    const links = extractSocialLinks(html, BASE);
    expect(links.some((l) => l.href.startsWith("mailto:"))).toBe(true);
  });
});

// ─── resolveUrl ──────────────────────────────────────────────────────────────

describe("resolveUrl", () => {
  it("resolves relative paths", () => {
    expect(resolveUrl("/about", BASE)).toBe(`${BASE}/about`);
  });

  it("keeps absolute URLs", () => {
    expect(resolveUrl("https://other.com/page", BASE)).toBe("https://other.com/page");
  });

  it("returns null for non-http protocols", () => {
    expect(resolveUrl("javascript:void(0)", BASE)).toBeNull();
    expect(resolveUrl("mailto:x@y.com", BASE)).toBeNull();
  });
});

// ─── isSameDomain ────────────────────────────────────────────────────────────

describe("isSameDomain", () => {
  it("returns true for same hostname", () => {
    expect(isSameDomain("https://example.com/about", "example.com")).toBe(true);
  });

  it("returns false for different hostname", () => {
    expect(isSameDomain("https://other.com/page", "example.com")).toBe(false);
  });
});

// ─── inferArtistName ─────────────────────────────────────────────────────────

describe("inferArtistName", () => {
  it("strips common site-title suffixes", () => {
    expect(inferArtistName("Sarah Chen | Official Site")).toBe("Sarah Chen");
    expect(inferArtistName("The Jazz Quartet — Music")).toBe("The Jazz Quartet");
    expect(inferArtistName("Maria Lopez - Home")).toBe("Maria Lopez");
  });

  it("strips known role suffixes", () => {
    expect(inferArtistName("Alex Kim Musician")).toBe("Alex Kim");
    expect(inferArtistName("David Park Composer")).toBe("David Park");
  });

  it("returns the title untouched when no suffix matches", () => {
    expect(inferArtistName("The Rolling Stones")).toBe("The Rolling Stones");
  });
});
