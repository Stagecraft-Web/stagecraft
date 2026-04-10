import { describe, it, expect, vi } from "vitest";
// @stagecraft/shared may not be linked in worktrees — load from source directly
vi.mock("@stagecraft/shared", async () => await import("../../../../../packages/shared/src/utils"));
import { stripHtml, inferArtistName } from "../../../../../packages/shared/src/utils";
import {
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
} from "../html-utils";

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

  it("removes HTML comments", () => {
    expect(stripHtml("<!-- comment --><p>text</p>")).toBe("text");
  });

  it("decodes common HTML entities", () => {
    // Note: &nbsp; becomes a space that gets collapsed and trimmed with surrounding whitespace
    expect(stripHtml("&amp; &lt; &gt; &quot; &#39;")).toBe("& < > \" '");
    expect(stripHtml("a&nbsp;b")).toBe("a b");
  });

  it("decodes dash entities", () => {
    expect(stripHtml("rock&mdash;roll")).toBe("rock—roll");
    expect(stripHtml("2020&ndash;2024")).toBe("2020–2024");
  });

  it("collapses multiple whitespace", () => {
    expect(stripHtml("<p>  too   much  space  </p>")).toBe("too much space");
  });

  it("returns empty string for empty input", () => {
    expect(stripHtml("")).toBe("");
  });
});

// ─── inferArtistName ─────────────────────────────────────────────────────────

describe("inferArtistName", () => {
  it("strips pipe-separated suffixes", () => {
    expect(inferArtistName("Sarah Chen | Official Site")).toBe("Sarah Chen");
  });

  it("strips dash-separated suffixes", () => {
    expect(inferArtistName("The Blue Notes - Home")).toBe("The Blue Notes");
  });

  it("strips em-dash-separated suffixes", () => {
    expect(inferArtistName("Maria Torres — Music")).toBe("Maria Torres");
  });

  it("strips trailing 'official' keyword", () => {
    expect(inferArtistName("Joe Doe Official")).toBe("Joe Doe");
  });

  it("returns name unchanged when no suffix", () => {
    expect(inferArtistName("The Rolling Stones")).toBe("The Rolling Stones");
  });

  it("trims surrounding whitespace", () => {
    expect(inferArtistName("  Band Name  ")).toBe("Band Name");
  });
});

// ─── extractTitle ─────────────────────────────────────────────────────────────

describe("extractTitle", () => {
  it("extracts <title> tag", () => {
    expect(extractTitle("<title>My Band</title>")).toBe("My Band");
  });

  it("prefers og:title over <title>", () => {
    const html = `<meta property="og:title" content="OG Title"><title>Page Title</title>`;
    expect(extractTitle(html)).toBe("OG Title");
  });

  it("returns empty string when no title", () => {
    expect(extractTitle("<html></html>")).toBe("");
  });
});

// ─── extractDescription ───────────────────────────────────────────────────────

describe("extractDescription", () => {
  it("extracts meta description", () => {
    const html = `<meta name="description" content="A great band">`;
    expect(extractDescription(html)).toBe("A great band");
  });

  it("prefers og:description over meta description", () => {
    const html = `<meta property="og:description" content="OG desc"><meta name="description" content="meta desc">`;
    expect(extractDescription(html)).toBe("OG desc");
  });

  it("returns empty string when no description", () => {
    expect(extractDescription("<html></html>")).toBe("");
  });
});

// ─── extractHeadings ─────────────────────────────────────────────────────────

describe("extractHeadings", () => {
  it("extracts h1-h3 headings", () => {
    const html = "<h1>Title</h1><h2>Subtitle</h2><h3>Sub-subtitle</h3><h4>Skip me</h4>";
    const headings = extractHeadings(html);
    expect(headings).toContain("Title");
    expect(headings).toContain("Subtitle");
    expect(headings).toContain("Sub-subtitle");
    expect(headings).not.toContain("Skip me");
  });

  it("strips HTML from headings", () => {
    expect(extractHeadings("<h1><strong>Bold Title</strong></h1>")).toEqual(["Bold Title"]);
  });

  it("returns empty array when no headings", () => {
    expect(extractHeadings("<p>No headings here</p>")).toEqual([]);
  });
});

// ─── extractParagraphs ────────────────────────────────────────────────────────

describe("extractParagraphs", () => {
  it("extracts non-trivial paragraphs", () => {
    const html = `<p>Short</p><p>This is a longer paragraph that should be included in results.</p>`;
    const paras = extractParagraphs(html);
    expect(paras).toContain("This is a longer paragraph that should be included in results.");
    expect(paras).not.toContain("Short");
  });

  it("strips HTML from paragraphs", () => {
    const html = `<p>Hello <em>beautiful</em> world, this is a test paragraph.</p>`;
    expect(extractParagraphs(html)).toEqual(["Hello beautiful world, this is a test paragraph."]);
  });
});

// ─── extractImages ────────────────────────────────────────────────────────────

describe("extractImages", () => {
  it("extracts image src and alt", () => {
    const html = `<img src="/photo.jpg" alt="Band photo">`;
    const images = extractImages(html, BASE);
    expect(images).toHaveLength(1);
    expect(images[0].src).toBe("https://example.com/photo.jpg");
    expect(images[0].alt).toBe("Band photo");
  });

  it("skips data: URIs", () => {
    const html = `<img src="data:image/png;base64,abc" alt="inline">`;
    expect(extractImages(html, BASE)).toHaveLength(0);
  });

  it("resolves relative URLs against base", () => {
    const html = `<img src="images/hero.jpg" alt="">`;
    const images = extractImages(html, BASE);
    expect(images[0].src).toContain("example.com");
  });
});

// ─── extractEmbeds ────────────────────────────────────────────────────────────

describe("extractEmbeds", () => {
  it("extracts YouTube iframes", () => {
    const html = `<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>`;
    const embeds = extractEmbeds(html);
    expect(embeds).toHaveLength(1);
    expect(embeds[0].type).toBe("youtube");
  });

  it("extracts Spotify iframes", () => {
    const html = `<iframe src="https://open.spotify.com/embed/album/123"></iframe>`;
    const embeds = extractEmbeds(html);
    expect(embeds[0].type).toBe("spotify");
  });

  it("classifies unknown iframes as other", () => {
    const html = `<iframe src="https://someother.site/embed"></iframe>`;
    const embeds = extractEmbeds(html);
    expect(embeds[0].type).toBe("other");
  });
});

// ─── extractNavLinks ─────────────────────────────────────────────────────────

describe("extractNavLinks", () => {
  it("extracts links from <nav> block", () => {
    const html = `<nav><a href="/about">About</a><a href="/contact">Contact</a></nav>`;
    const links = extractNavLinks(html, BASE);
    expect(links.map((l) => l.text)).toContain("About");
    expect(links.map((l) => l.text)).toContain("Contact");
  });

  it("resolves relative hrefs", () => {
    const html = `<nav><a href="/music">Music</a></nav>`;
    const links = extractNavLinks(html, BASE);
    expect(links[0].href).toBe("https://example.com/music");
  });

  it("skips anchor links", () => {
    const html = `<nav><a href="#section">Jump</a></nav>`;
    const links = extractNavLinks(html, BASE);
    expect(links).toHaveLength(0);
  });
});

// ─── extractSocialLinks ───────────────────────────────────────────────────────

describe("extractSocialLinks", () => {
  it("detects Instagram link", () => {
    const html = `<a href="https://www.instagram.com/sarahchen">Follow</a>`;
    const links = extractSocialLinks(html, BASE);
    const ig = links.find((l) => l.text === "Instagram");
    expect(ig?.href).toBe("https://www.instagram.com/sarahchen");
  });

  it("detects mailto links", () => {
    const html = `<a href="mailto:hi@example.com">Email</a>`;
    const links = extractSocialLinks(html, BASE);
    expect(links.some((l) => l.href === "mailto:hi@example.com")).toBe(true);
  });

  it("returns empty array when no social links", () => {
    expect(extractSocialLinks("<p>No links here</p>", BASE)).toHaveLength(0);
  });
});

// ─── resolveUrl ──────────────────────────────────────────────────────────────

describe("resolveUrl", () => {
  it("resolves relative paths", () => {
    expect(resolveUrl("/about", BASE)).toBe("https://example.com/about");
  });

  it("returns absolute URLs unchanged", () => {
    expect(resolveUrl("https://other.com/page", BASE)).toBe("https://other.com/page");
  });

  it("returns null for non-http protocols", () => {
    expect(resolveUrl("ftp://files.example.com", BASE)).toBeNull();
    expect(resolveUrl("javascript:void(0)", BASE)).toBeNull();
  });
});

// ─── isSameDomain ────────────────────────────────────────────────────────────

describe("isSameDomain", () => {
  it("returns true for same hostname", () => {
    expect(isSameDomain("https://example.com/page", "example.com")).toBe(true);
  });

  it("returns false for different hostname", () => {
    expect(isSameDomain("https://other.com/page", "example.com")).toBe(false);
  });

  it("returns false for invalid URL", () => {
    expect(isSameDomain("not-a-url", "example.com")).toBe(false);
  });
});
