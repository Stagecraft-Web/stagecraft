import { describe, it, expect } from "vitest";
import {
  detectPageRole,
  buildMarkdownBody,
  buildFrontmatter,
  buildMarkdownPage,
  buildNav,
  buildSiteConfig,
  mapExtractedContent,
} from "../migration/mapper";
import type { ExtractedPage, ExtractedSite } from "../migration/crawler";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePage(overrides: Partial<ExtractedPage> = {}): ExtractedPage {
  return {
    url: "https://example.com/",
    title: "Home",
    description: "",
    headings: [],
    paragraphs: [],
    images: [],
    embeds: [],
    navLinks: [],
    rawText: "",
    ...overrides,
  };
}

function makeSite(pages: ExtractedPage[]): ExtractedSite {
  return {
    rootUrl: "https://example.com",
    domain: "example.com",
    siteTitle: "Sarah Chen Music | Official Site",
    pages,
    socialLinks: [
      { href: "https://instagram.com/sarahchen", text: "Instagram" },
      { href: "mailto:hi@sarahchen.com", text: "Email" },
    ],
    inferredName: "Sarah Chen Music",
  };
}

// ─── detectPageRole ───────────────────────────────────────────────────────────

describe("detectPageRole", () => {
  it("detects home from root URL", () => {
    const page = makePage({ url: "https://example.com/", title: "Home" });
    expect(detectPageRole(page)).toBe("home");
  });

  it("detects about from URL path", () => {
    const page = makePage({ url: "https://example.com/about", title: "About Me" });
    expect(detectPageRole(page)).toBe("about");
  });

  it("detects music from title", () => {
    const page = makePage({ url: "https://example.com/listen", title: "Music & Releases" });
    expect(detectPageRole(page)).toBe("music");
  });

  it("detects press from URL", () => {
    const page = makePage({ url: "https://example.com/press", title: "Press Kit" });
    expect(detectPageRole(page)).toBe("press");
  });

  it("detects contact from heading", () => {
    const page = makePage({ url: "https://example.com/reach", title: "Reach Out", headings: ["Get in Touch"] });
    expect(detectPageRole(page)).toBe("contact");
  });

  it("detects tour from URL", () => {
    const page = makePage({ url: "https://example.com/shows", title: "Upcoming Shows" });
    expect(detectPageRole(page)).toBe("tour");
  });

  it("defaults unknown pages to home", () => {
    const page = makePage({ url: "https://example.com/random-page", title: "Whatever" });
    // First page with no keyword match gets "home" as a fallback
    expect(detectPageRole(page)).toBe("home");
  });
});

// ─── buildMarkdownBody ───────────────────────────────────────────────────────

describe("buildMarkdownBody", () => {
  it("includes paragraphs", () => {
    const body = buildMarkdownBody([], ["First paragraph about me and my music."]);
    expect(body).toContain("First paragraph about me and my music.");
  });

  it("includes secondary headings as h2", () => {
    const body = buildMarkdownBody(["Main Title", "About Section", "Experience"], []);
    expect(body).toContain("## About Section");
    expect(body).toContain("## Experience");
    // First heading (index 0) is skipped — it's the page title used in frontmatter
    expect(body).not.toContain("## Main Title");
  });

  it("returns empty string when no content", () => {
    expect(buildMarkdownBody([], [])).toBe("");
  });
});

// ─── buildFrontmatter ────────────────────────────────────────────────────────

describe("buildFrontmatter", () => {
  it("produces valid YAML frontmatter block", () => {
    const fm = buildFrontmatter({ title: "About Me", description: "My story." });
    expect(fm).toContain("---");
    expect(fm).toContain('title: "About Me"');
    expect(fm).toContain('description: "My story."');
  });

  it("skips empty values", () => {
    const fm = buildFrontmatter({ title: "Contact", description: "" });
    expect(fm).not.toContain("description:");
  });

  it("escapes internal double-quotes", () => {
    const fm = buildFrontmatter({ title: 'She said "hello"' });
    expect(fm).toContain('\\"hello\\"');
  });
});

// ─── buildMarkdownPage ───────────────────────────────────────────────────────

describe("buildMarkdownPage", () => {
  it("includes frontmatter and body", () => {
    const md = buildMarkdownPage(
      "About Me",
      "The story of my musical journey.",
      [],
      ["I started playing piano at age 5 and never looked back."]
    );
    expect(md).toContain("---");
    expect(md).toContain("About Me");
    expect(md).toContain("I started playing piano");
  });
});

// ─── buildNav ─────────────────────────────────────────────────────────────────

describe("buildNav", () => {
  it("always includes Home as first item", () => {
    const pages = [
      makePage({ url: "https://example.com/", title: "Home" }),
      makePage({ url: "https://example.com/about", title: "About" }),
    ];
    const nav = buildNav(pages);
    expect(nav[0].href).toBe("/");
    expect(nav[0].label).toBe("Home");
  });

  it("maps about, music, press, contact correctly", () => {
    const pages = [
      makePage({ url: "https://example.com/", title: "Home" }),
      makePage({ url: "https://example.com/about", title: "About Me" }),
      makePage({ url: "https://example.com/music", title: "My Music" }),
      makePage({ url: "https://example.com/press", title: "Press" }),
      makePage({ url: "https://example.com/contact", title: "Contact" }),
    ];
    const nav = buildNav(pages);
    const hrefs = nav.map((n) => n.href);
    expect(hrefs).toContain("/about");
    expect(hrefs).toContain("/music");
    expect(hrefs).toContain("/press");
    expect(hrefs).toContain("/contact");
  });

  it("deduplicates pages with the same role", () => {
    const pages = [
      makePage({ url: "https://example.com/about", title: "About" }),
      makePage({ url: "https://example.com/bio", title: "Bio" }),
    ];
    const nav = buildNav(pages);
    const aboutItems = nav.filter((n) => n.href === "/about");
    expect(aboutItems.length).toBe(1);
  });
});

// ─── buildSiteConfig ─────────────────────────────────────────────────────────

describe("buildSiteConfig", () => {
  it("sets artistName and siteTitle", () => {
    const site = makeSite([makePage()]);
    const config = buildSiteConfig(site, "Sarah Chen");
    expect(config.artistName).toBe("Sarah Chen");
    expect(config.siteTitle).toContain("Sarah Chen");
  });

  it("extracts email from socialLinks", () => {
    const site = makeSite([makePage()]);
    const config = buildSiteConfig(site, "Sarah Chen");
    expect(config.email).toBe("hi@sarahchen.com");
  });

  it("maps social links to socialLinks object", () => {
    const site = makeSite([makePage()]);
    const config = buildSiteConfig(site, "Sarah Chen");
    expect(config.socialLinks.instagram).toBe("https://instagram.com/sarahchen");
  });
});

// ─── mapExtractedContent ─────────────────────────────────────────────────────

describe("mapExtractedContent", () => {
  it("produces site.json, nav.json, and page files", () => {
    const pages = [
      makePage({ url: "https://example.com/", title: "Home", paragraphs: ["Welcome to my world of music and sound."] }),
      makePage({ url: "https://example.com/about", title: "About", paragraphs: ["I am a guitarist with 15 years of experience performing worldwide."] }),
    ];
    const site = makeSite(pages);
    const { files } = mapExtractedContent(site, "Sarah Chen");

    const paths = files.map((f) => f.path);
    expect(paths).toContain("src/content/config/site.json");
    expect(paths).toContain("src/content/config/nav.json");
    expect(paths.some((p) => p.startsWith("src/content/pages/"))).toBe(true);
  });

  it("site.json contains valid JSON with artistName", () => {
    const site = makeSite([makePage()]);
    const { files } = mapExtractedContent(site, "Test Artist");
    const siteJson = files.find((f) => f.path === "src/content/config/site.json");
    expect(siteJson).toBeDefined();
    const parsed = JSON.parse(siteJson!.content) as { artistName: string };
    expect(parsed.artistName).toBe("Test Artist");
  });

  it("nav.json contains valid JSON with items array", () => {
    const site = makeSite([makePage()]);
    const { files } = mapExtractedContent(site, "Test Artist");
    const navJson = files.find((f) => f.path === "src/content/config/nav.json");
    expect(navJson).toBeDefined();
    const parsed = JSON.parse(navJson!.content) as { items: unknown[] };
    expect(Array.isArray(parsed.items)).toBe(true);
  });

  it("detects social links in result", () => {
    const site = makeSite([makePage()]);
    const { detectedSocialLinks } = mapExtractedContent(site, "Test Artist");
    expect(detectedSocialLinks.Instagram).toBe("https://instagram.com/sarahchen");
  });
});
