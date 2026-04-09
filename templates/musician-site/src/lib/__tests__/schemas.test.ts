import { describe, it, expect } from "vitest";
import {
  siteConfigSchema,
  themeSchema,
  releaseSchema,
  photoSchema,
  pressQuoteSchema,
  tourDateSchema,
  navSchema,
} from "../schemas";

describe("siteConfigSchema", () => {
  const valid = {
    artistName: "Jane Doe",
    siteTitle: "Jane Doe Music",
    siteDescription: "Official site",
    socialLinks: { instagram: "https://instagram.com/janedoe" },
    contactEmail: "jane@example.com",
    copyright: "2024 Jane Doe",
  };

  it("accepts a valid config", () => {
    expect(siteConfigSchema.parse(valid)).toEqual(valid);
  });

  it("rejects missing artistName", () => {
    expect(() => siteConfigSchema.parse({ ...valid, artistName: "" })).toThrow();
  });

  it("rejects invalid email", () => {
    expect(() => siteConfigSchema.parse({ ...valid, contactEmail: "not-email" })).toThrow();
  });
});

describe("themeSchema", () => {
  const valid = {
    colorMode: "light" as const,
    colors: { primary: "#1a1a2e", secondary: "#e94560" },
    typography: {
      headingFont: "'Georgia', serif",
      bodyFont: "'Inter', sans-serif",
      fontSize: { base: "1rem", lg: "1.125rem" },
      fontWeight: { normal: "400", bold: "700" },
    },
    spacing: { sm: "0.5rem", md: "1rem" },
    breakpoints: { md: "768px", lg: "1024px" },
    layout: {
      maxContentWidth: "1200px",
      maxTextWidth: "720px",
      borderRadius: "0.375rem",
    },
  };

  it("accepts a valid theme", () => {
    expect(themeSchema.parse(valid)).toMatchObject(valid);
  });

  it("defaults colorMode to light", () => {
    const { colorMode, ...noMode } = valid;
    expect(themeSchema.parse(noMode).colorMode).toBe("light");
  });

  it("accepts dark colorMode", () => {
    expect(themeSchema.parse({ ...valid, colorMode: "dark" }).colorMode).toBe("dark");
  });

  it("rejects invalid colorMode", () => {
    expect(() => themeSchema.parse({ ...valid, colorMode: "auto" })).toThrow();
  });

  it("accepts optional darkColors", () => {
    const withDark = { ...valid, darkColors: { primary: "#e2e8f0", background: "#0f172a" } };
    expect(themeSchema.parse(withDark).darkColors).toBeTruthy();
  });

  it("rejects missing typography.fontSize", () => {
    const { fontSize, ...noFontSize } = valid.typography;
    expect(() =>
      themeSchema.parse({ ...valid, typography: noFontSize })
    ).toThrow();
  });

  it("rejects missing breakpoints", () => {
    const { breakpoints, ...noBreakpoints } = valid;
    expect(() => themeSchema.parse(noBreakpoints)).toThrow();
  });
});

describe("releaseSchema", () => {
  const valid = {
    title: "Debut Album",
    type: "album" as const,
    releaseDate: "2024-03-15",
    coverImage: "/images/cover.jpg",
    description: "First album",
    links: { spotify: "https://open.spotify.com/..." },
  };

  it("accepts a valid release", () => {
    expect(releaseSchema.parse(valid)).toEqual(valid);
  });

  it("accepts optional tracks", () => {
    const withTracks = { ...valid, tracks: [{ title: "Song", duration: "3:42" }] };
    expect(releaseSchema.parse(withTracks).tracks).toHaveLength(1);
  });

  it("rejects invalid type", () => {
    expect(() => releaseSchema.parse({ ...valid, type: "mixtape" })).toThrow();
  });
});

describe("photoSchema", () => {
  it("accepts valid photo", () => {
    expect(photoSchema.parse({ src: "/img.jpg", alt: "Photo" })).toBeTruthy();
  });

  it("rejects empty src", () => {
    expect(() => photoSchema.parse({ src: "", alt: "Photo" })).toThrow();
  });

  it("accepts optional caption", () => {
    const photo = photoSchema.parse({ src: "/img.jpg", alt: "Photo", caption: "Nice" });
    expect(photo.caption).toBe("Nice");
  });
});

describe("pressQuoteSchema", () => {
  it("accepts valid quote", () => {
    expect(pressQuoteSchema.parse({ quote: "Amazing!", source: "Rolling Stone" })).toBeTruthy();
  });

  it("rejects empty source", () => {
    expect(() => pressQuoteSchema.parse({ quote: "Great", source: "" })).toThrow();
  });
});

describe("tourDateSchema", () => {
  const valid = {
    date: "2024-06-15",
    venue: "The Venue",
    city: "New York, NY",
    status: "upcoming" as const,
  };

  it("accepts a valid tour date", () => {
    expect(tourDateSchema.parse(valid)).toEqual(valid);
  });

  it("rejects invalid status", () => {
    expect(() => tourDateSchema.parse({ ...valid, status: "postponed" })).toThrow();
  });

  it("accepts optional ticketUrl", () => {
    const withUrl = { ...valid, ticketUrl: "https://tickets.example.com" };
    expect(tourDateSchema.parse(withUrl).ticketUrl).toBe("https://tickets.example.com");
  });
});

describe("navSchema", () => {
  it("accepts valid nav items", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Music", href: "/music" },
    ];
    expect(navSchema.parse(items)).toEqual(items);
  });

  it("rejects empty label", () => {
    expect(() => navSchema.parse([{ label: "", href: "/" }])).toThrow();
  });
});
