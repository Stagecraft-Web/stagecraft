import { describe, it, expect } from "vitest";
import {
  imageMetadataSchema,
  siteConfigSchema,
  themeSchema,
  appearanceSchema,
  pageFrontmatterSchema,
  releaseSchema,
  photoSchema,
  pressQuoteSchema,
  tourDateSchema,
  navConfigSchema,
} from "../schemas";

describe("imageMetadataSchema", () => {
  it("accepts minimal valid image (src + alt)", () => {
    expect(imageMetadataSchema.parse({ src: "/img.jpg", alt: "A photo" })).toBeTruthy();
  });

  it("rejects empty src", () => {
    expect(() => imageMetadataSchema.parse({ src: "", alt: "A photo" })).toThrow();
  });

  it("rejects empty alt", () => {
    expect(() => imageMetadataSchema.parse({ src: "/img.jpg", alt: "" })).toThrow();
  });

  it("accepts full metadata", () => {
    const full = {
      src: "/img.jpg",
      alt: "A photo",
      caption: "Caption text",
      credit: "Photo by Jane",
      focalPoint: { x: 0.5, y: 0.3 },
      usageSlot: "gallery" as const,
    };
    expect(imageMetadataSchema.parse(full)).toMatchObject(full);
  });

  it("rejects focalPoint values outside 0-1 range", () => {
    expect(() =>
      imageMetadataSchema.parse({ src: "/img.jpg", alt: "A", focalPoint: { x: 1.5, y: 0 } })
    ).toThrow();
  });
});

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

  // ---- Wordmark (5b replacement) -----------------------------------------
  it("parses without a wordmark (optional field)", () => {
    const result = siteConfigSchema.parse(valid);
    expect(result.wordmark).toBeUndefined();
  });

  it("accepts a valid wordmark (src + alt)", () => {
    const withWordmark = {
      ...valid,
      wordmark: { src: "../../assets/images/wordmark.svg", alt: "Jane Doe" },
    };
    const result = siteConfigSchema.parse(withWordmark);
    expect(result.wordmark).toEqual({
      src: "../../assets/images/wordmark.svg",
      alt: "Jane Doe",
    });
  });

  it("rejects a wordmark with an empty src", () => {
    expect(() =>
      siteConfigSchema.parse({
        ...valid,
        wordmark: { src: "", alt: "Jane Doe" },
      }),
    ).toThrow();
  });

  it("rejects a wordmark with an empty alt (screen-reader requirement)", () => {
    expect(() =>
      siteConfigSchema.parse({
        ...valid,
        wordmark: { src: "../../assets/images/wordmark.svg", alt: "" },
      }),
    ).toThrow();
  });
});

describe("themeSchema", () => {
  const valid = {
    colorMode: "light" as const,
    colors: { primary: "#1a1a2e", secondary: "#e94560" },
    typography: {
      headingFont: "'Georgia', serif",
      bodyFont: "'Inter', sans-serif",
      fontSize: { base: "1rem", lg: "1.25rem" },
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

describe("appearanceSchema", () => {
  const validColors = {
    primary: "#1a1a2e",
    secondary: "#e94560",
    accent: "#0f3460",
    background: "#fafafa",
    surface: "#ffffff",
    text: "#1a1a2e",
    textMuted: "#6b7280",
    border: "#e5e7eb",
  };

  const validBodyWeights = { body: 400, bodyBold: 700 };
  const validHeadingWeights = { h1: 700, h2: 700, h3: 700, h4: 700 };

  const splitInput = {
    colors: validColors,
    typography: {
      primary: { discriminant: "sans-serif" as const, value: "Inter" },
      bodyWeights: validBodyWeights,
      heading: {
        discriminant: "split" as const,
        value: { discriminant: "serif" as const, value: "Merriweather" },
      },
      headingWeights: validHeadingWeights,
    },
  };

  const singleInput = {
    colors: validColors,
    typography: {
      primary: { discriminant: "sans-serif" as const, value: "Inter" },
      bodyWeights: validBodyWeights,
      heading: { discriminant: "single" as const, value: null },
      headingWeights: validHeadingWeights,
    },
  };

  it("accepts a valid split-mode appearance", () => {
    const result = appearanceSchema.parse(splitInput);
    expect(result.colors.primary).toBe("#1a1a2e");
    expect(result.typography.mode).toBe("split");
    expect(result.typography.heading).toEqual({ category: "serif", family: "Merriweather" });
  });

  it("accepts a valid single-mode appearance (heading is null)", () => {
    const result = appearanceSchema.parse(singleInput);
    expect(result.typography.mode).toBe("single");
    expect(result.typography.heading).toBeNull();
  });

  it("transforms Keystatic's {discriminant, value} font shape into {category, family}", () => {
    const result = appearanceSchema.parse(splitInput);
    expect(result.typography.primary).toEqual({ category: "sans-serif", family: "Inter" });
    expect(result.typography.heading).toEqual({ category: "serif", family: "Merriweather" });
  });

  it("splits weights into bodyWeights and headingWeights blocks", () => {
    const result = appearanceSchema.parse(splitInput);
    expect(result.typography.bodyWeights).toEqual({ body: 400, bodyBold: 700 });
    expect(result.typography.headingWeights).toEqual({ h1: 700, h2: 700, h3: 700, h4: 700 });
  });

  it("coerces string weights (as Keystatic's select emits) into numbers", () => {
    const withStringWeights = {
      ...splitInput,
      typography: {
        ...splitInput.typography,
        bodyWeights: { body: "400", bodyBold: "700" },
        headingWeights: { h1: "700", h2: "700", h3: "700", h4: "700" },
      },
    };
    const result = appearanceSchema.parse(withStringWeights);
    expect(result.typography.bodyWeights.body).toBe(400);
    expect(result.typography.headingWeights.h1).toBe(700);
  });

  it("rejects weights outside the 100–900 range", () => {
    const withBadWeight = {
      ...splitInput,
      typography: {
        ...splitInput.typography,
        bodyWeights: { ...validBodyWeights, body: 50 },
      },
    };
    expect(() => appearanceSchema.parse(withBadWeight)).toThrow();
  });

  it("rejects weights that aren't multiples of 100", () => {
    const withBadWeight = {
      ...splitInput,
      typography: {
        ...splitInput.typography,
        bodyWeights: { ...validBodyWeights, body: 450 },
      },
    };
    expect(() => appearanceSchema.parse(withBadWeight)).toThrow();
  });

  it("rejects empty font family", () => {
    const withEmptyFamily = {
      ...splitInput,
      typography: {
        ...splitInput.typography,
        primary: { discriminant: "sans-serif" as const, value: "" },
      },
    };
    expect(() => appearanceSchema.parse(withEmptyFamily)).toThrow();
  });

  it("accepts 'custom' category with a well-formed family name", () => {
    const withCustom = {
      ...splitInput,
      typography: {
        ...splitInput.typography,
        primary: { discriminant: "custom" as const, value: "Space Grotesk" },
      },
    };
    const result = appearanceSchema.parse(withCustom);
    expect(result.typography.primary).toEqual({ category: "custom", family: "Space Grotesk" });
  });

  it("rejects custom font names that are lowercase (would 404 on Google Fonts)", () => {
    const withBadCustom = {
      ...splitInput,
      typography: {
        ...splitInput.typography,
        primary: { discriminant: "custom" as const, value: "space grotesk" },
      },
    };
    expect(() => appearanceSchema.parse(withBadCustom)).toThrow();
  });

  it("rejects custom font names with invalid characters", () => {
    const withBadCustom = {
      ...splitInput,
      typography: {
        ...splitInput.typography,
        primary: { discriminant: "custom" as const, value: "Space-Grotesk!" },
      },
    };
    expect(() => appearanceSchema.parse(withBadCustom)).toThrow();
  });

  it("does not apply the format regex to curated categories", () => {
    // Curated families come from a select list, so "Inter" (which lacks a
    // second word but is still valid) should parse fine even though the
    // custom-only regex check wouldn't affect it either.
    const result = appearanceSchema.parse(splitInput);
    expect(result.typography.primary.family).toBe("Inter");
  });

  it("rejects missing color fields", () => {
    const { primary, ...partialColors } = validColors;
    expect(() =>
      appearanceSchema.parse({ ...splitInput, colors: partialColors })
    ).toThrow();
  });

  // ---- 5a: linkColor fallback ---------------------------------------------
  it("falls back to accent when linkColor is unset (field missing)", () => {
    const result = appearanceSchema.parse(splitInput);
    expect(result.colors.linkColor).toBe(validColors.accent);
  });

  it("falls back to accent when linkColor is an empty string", () => {
    const withBlankLink = {
      ...splitInput,
      colors: { ...validColors, linkColor: "" },
    };
    const result = appearanceSchema.parse(withBlankLink);
    expect(result.colors.linkColor).toBe(validColors.accent);
  });

  it("preserves an explicit linkColor when set", () => {
    const withLink = {
      ...splitInput,
      colors: { ...validColors, linkColor: "#ff00aa" },
    };
    const result = appearanceSchema.parse(withLink);
    expect(result.colors.linkColor).toBe("#ff00aa");
  });

  // ---- per-bucket size overrides (integer pixels) ------------------------
  it("defaults bodySizes/headingSizes to all-zero when missing", () => {
    // Backwards-compat: pre-existing appearance.json files have no size
    // blocks. Each field defaults to 0, which computeFontSizes treats as
    // "use the theme.json baseline."
    const result = appearanceSchema.parse(splitInput);
    expect(result.typography.bodySizes).toEqual({ xs: 0, sm: 0, base: 0, lg: 0 });
    expect(result.typography.headingSizes).toEqual({
      xl: 0,
      "2xl": 0,
      "3xl": 0,
      "4xl": 0,
    });
  });

  it("accepts explicit per-bucket overrides as integer pixels", () => {
    const withSizes = {
      ...splitInput,
      typography: {
        ...splitInput.typography,
        bodySizes: { xs: 11, sm: 0, base: 18, lg: 0 },
        headingSizes: { xl: 26, "2xl": 0, "3xl": 0, "4xl": 64 },
      },
    };
    const result = appearanceSchema.parse(withSizes);
    expect(result.typography.bodySizes.xs).toBe(11);
    expect(result.typography.bodySizes.base).toBe(18);
    expect(result.typography.headingSizes.xl).toBe(26);
    expect(result.typography.headingSizes["4xl"]).toBe(64);
  });

  it("coerces string-valued sizes (as Keystatic's number input may emit)", () => {
    const withStringSizes = {
      ...splitInput,
      typography: {
        ...splitInput.typography,
        bodySizes: { base: "18", xs: 0, sm: 0, lg: 0 },
      },
    };
    const result = appearanceSchema.parse(withStringSizes);
    expect(result.typography.bodySizes.base).toBe(18);
  });

  it("rejects non-integer sizes", () => {
    const withFractional = {
      ...splitInput,
      typography: {
        ...splitInput.typography,
        bodySizes: { base: 16.5, xs: 0, sm: 0, lg: 0 },
      },
    };
    expect(() => appearanceSchema.parse(withFractional)).toThrow();
  });

  it("rejects sizes outside the [0, 96]px range", () => {
    const withTooBig = {
      ...splitInput,
      typography: {
        ...splitInput.typography,
        bodySizes: { base: 200, xs: 0, sm: 0, lg: 0 },
      },
    };
    expect(() => appearanceSchema.parse(withTooBig)).toThrow();
    const withNegative = {
      ...splitInput,
      typography: {
        ...splitInput.typography,
        bodySizes: { base: -1, xs: 0, sm: 0, lg: 0 },
      },
    };
    expect(() => appearanceSchema.parse(withNegative)).toThrow();
  });

  it("treats per-bucket fields as optional within the size blocks", () => {
    // Authors can supply a partial map (e.g. only `base`); the schema fills
    // the rest with defaults.
    const withPartial = {
      ...splitInput,
      typography: {
        ...splitInput.typography,
        bodySizes: { base: 17 },
      },
    };
    const result = appearanceSchema.parse(withPartial);
    expect(result.typography.bodySizes.base).toBe(17);
    expect(result.typography.bodySizes.xs).toBe(0);
  });
});

describe("pageFrontmatterSchema", () => {
  it("accepts valid page frontmatter", () => {
    const result = pageFrontmatterSchema.parse({ title: "Home" });
    expect(result.title).toBe("Home");
  });

  it("rejects missing title", () => {
    expect(() => pageFrontmatterSchema.parse({})).toThrow();
  });

  it("rejects empty title", () => {
    expect(() => pageFrontmatterSchema.parse({ title: "" })).toThrow();
  });

  it("ignores extra fields", () => {
    const result = pageFrontmatterSchema.parse({ title: "Home", extra: "field" });
    expect(result.title).toBe("Home");
  });
});

describe("releaseSchema", () => {
  const valid = {
    title: "Debut Album",
    type: "album" as const,
    releaseDate: "2024-03-15",
    coverImage: {
      src: "/src/assets/images/cover.jpg",
      alt: "Debut Album cover art",
      usageSlot: "release-cover" as const,
    },
    description: "First album",
    links: { spotify: "https://open.spotify.com/..." },
  };

  it("accepts a valid release", () => {
    expect(releaseSchema.parse(valid)).toMatchObject(valid);
  });

  it("accepts optional tracks", () => {
    const withTracks = { ...valid, tracks: [{ title: "Song", duration: "3:42" }] };
    expect(releaseSchema.parse(withTracks).tracks).toHaveLength(1);
  });

  it("rejects invalid type", () => {
    expect(() => releaseSchema.parse({ ...valid, type: "mixtape" })).toThrow();
  });

  it("rejects coverImage as a bare string", () => {
    expect(() =>
      releaseSchema.parse({ ...valid, coverImage: "/images/cover.jpg" })
    ).toThrow();
  });

  it("rejects coverImage with empty alt", () => {
    expect(() =>
      releaseSchema.parse({ ...valid, coverImage: { src: "/img.jpg", alt: "" } })
    ).toThrow();
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

describe("navConfigSchema", () => {
  it("accepts valid nav config (array of slugs)", () => {
    const config = { items: ["home", "about", "music"] };
    expect(navConfigSchema.parse(config)).toEqual(config);
  });

  it("accepts empty items array", () => {
    expect(navConfigSchema.parse({ items: [] })).toEqual({ items: [] });
  });

  it("rejects missing items field", () => {
    expect(() => navConfigSchema.parse({})).toThrow();
  });

  it("rejects empty slug strings", () => {
    expect(() => navConfigSchema.parse({ items: ["home", ""] })).toThrow();
  });

  it("rejects flat array (must be wrapped in items)", () => {
    expect(() => navConfigSchema.parse(["home", "about"])).toThrow();
  });
});
