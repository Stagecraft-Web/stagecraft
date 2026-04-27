import { describe, it, expect } from "vitest";
import {
  imageMetadataSchema,
  siteConfigSchema,
  themeSchema,
  appearanceSchema,
  pageFrontmatterSchema,
  pageBackgroundOverlaySchema,
  releaseSchema,
  photoSchema,
  tourDateSchema,
  headerAndNavSchema,
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
  };

  it("accepts a valid config", () => {
    // Use toMatchObject: the schema adds a default for isFooterHidden,
    // so the parsed result is a superset of the input.
    expect(siteConfigSchema.parse(valid)).toMatchObject(valid);
  });

  // ---- Copyright holder ---------------------------------------------------
  it("parses without copyrightName (optional)", () => {
    const result = siteConfigSchema.parse(valid);
    expect(result.copyrightName).toBeUndefined();
  });

  it("accepts an explicit copyrightName", () => {
    const result = siteConfigSchema.parse({ ...valid, copyrightName: "Jane Doe LLC" });
    expect(result.copyrightName).toBe("Jane Doe LLC");
  });

  it("rejects missing artistName", () => {
    expect(() => siteConfigSchema.parse({ ...valid, artistName: "" })).toThrow();
  });

  it("rejects invalid email", () => {
    expect(() => siteConfigSchema.parse({ ...valid, contactEmail: "not-email" })).toThrow();
  });

  // ---- Favicon ------------------------------------------------------------
  it("parses without a favicon (optional field)", () => {
    expect(siteConfigSchema.parse(valid).favicon).toBeUndefined();
  });

  it("accepts a favicon path string", () => {
    const withFavicon = {
      ...valid,
      favicon: "../../assets/favicons/favicon.svg",
    };
    const result = siteConfigSchema.parse(withFavicon);
    expect(result.favicon).toBe("../../assets/favicons/favicon.svg");
  });

  it("rejects an empty favicon string", () => {
    expect(() =>
      siteConfigSchema.parse({ ...valid, favicon: "" }),
    ).toThrow();
  });

  // ---- isFooterHidden -----------------------------------------------------
  it("defaults isFooterHidden to false when omitted", () => {
    expect(siteConfigSchema.parse(valid).isFooterHidden).toBe(false);
  });

  it("accepts an explicit isFooterHidden=true", () => {
    const result = siteConfigSchema.parse({ ...valid, isFooterHidden: true });
    expect(result.isFooterHidden).toBe(true);
  });

  // ---- Page background (1.2) ---------------------------------------------
  // Back-compat: existing site.json seeds don't set pageBackground, so the
  // field must remain optional and the parsed result must leave it undefined.
  it("parses without a pageBackground (back-compat for existing seeds)", () => {
    const result = siteConfigSchema.parse(valid);
    expect(result.pageBackground).toBeUndefined();
    expect(result.pageBackgroundOverlay).toBeUndefined();
  });

  it("accepts a full pageBackground + overlay", () => {
    const withBackground = {
      ...valid,
      pageBackground: {
        src: "../../assets/images/bg.jpg",
        alt: "Abstract texture",
      },
      pageBackgroundOverlay: { color: "#000000", opacity: 0.4 },
    };
    const result = siteConfigSchema.parse(withBackground);
    expect(result.pageBackground).toEqual({
      src: "../../assets/images/bg.jpg",
      alt: "Abstract texture",
    });
    expect(result.pageBackgroundOverlay).toEqual({
      color: "#000000",
      opacity: 0.4,
    });
  });

  it("rejects a pageBackground with an empty alt", () => {
    expect(() =>
      siteConfigSchema.parse({
        ...valid,
        pageBackground: { src: "../../assets/images/bg.jpg", alt: "" },
      }),
    ).toThrow();
  });

  it("applies overlay defaults when fields are absent", () => {
    const withPartialOverlay = {
      ...valid,
      pageBackground: {
        src: "../../assets/images/bg.jpg",
        alt: "Abstract texture",
      },
      pageBackgroundOverlay: {},
    };
    const result = siteConfigSchema.parse(withPartialOverlay);
    expect(result.pageBackgroundOverlay).toEqual({
      color: "#000000",
      opacity: 0.3,
    });
  });
});

describe("pageBackgroundOverlaySchema", () => {
  it("applies defaults for color and opacity when fields are absent", () => {
    const result = pageBackgroundOverlaySchema.parse({});
    expect(result).toEqual({ color: "#000000", opacity: 0.3 });
  });

  it("accepts an explicit color + opacity", () => {
    const result = pageBackgroundOverlaySchema.parse({ color: "#112233", opacity: 0.5 });
    expect(result).toEqual({ color: "#112233", opacity: 0.5 });
  });

  it("accepts opacity at the 0 and 1 boundaries", () => {
    expect(pageBackgroundOverlaySchema.parse({ opacity: 0 }).opacity).toBe(0);
    expect(pageBackgroundOverlaySchema.parse({ opacity: 1 }).opacity).toBe(1);
  });

  it("rejects opacity outside 0–1", () => {
    expect(() => pageBackgroundOverlaySchema.parse({ opacity: -0.1 })).toThrow();
    expect(() => pageBackgroundOverlaySchema.parse({ opacity: 1.1 })).toThrow();
  });

  it("rejects an empty color string", () => {
    expect(() => pageBackgroundOverlaySchema.parse({ color: "" })).toThrow();
  });
});

describe("headerAndNavSchema", () => {
  const valid = {
    items: ["home", "about", "music"],
  };

  it("accepts the minimal valid config (just items)", () => {
    const result = headerAndNavSchema.parse(valid);
    expect(result.items).toEqual(["home", "about", "music"]);
  });

  it("accepts an empty items array", () => {
    expect(headerAndNavSchema.parse({ items: [] }).items).toEqual([]);
  });

  it("rejects empty slug strings inside items", () => {
    expect(() => headerAndNavSchema.parse({ items: ["home", ""] })).toThrow();
  });

  // ---- Wordmark -----------------------------------------------------------
  it("parses without a wordmark (optional field)", () => {
    expect(headerAndNavSchema.parse(valid).wordmark).toBeUndefined();
  });

  it("accepts a valid wordmark (src + alt)", () => {
    const result = headerAndNavSchema.parse({
      ...valid,
      wordmark: { src: "../../assets/images/wordmark.svg", alt: "Jane Doe" },
    });
    expect(result.wordmark).toEqual({
      src: "../../assets/images/wordmark.svg",
      alt: "Jane Doe",
    });
  });

  it("rejects a wordmark with an empty src", () => {
    expect(() =>
      headerAndNavSchema.parse({
        ...valid,
        wordmark: { src: "", alt: "Jane Doe" },
      }),
    ).toThrow();
  });

  it("rejects a wordmark with an empty alt (screen-reader requirement)", () => {
    expect(() =>
      headerAndNavSchema.parse({
        ...valid,
        wordmark: { src: "../../assets/images/wordmark.svg", alt: "" },
      }),
    ).toThrow();
  });

  it("coerces an empty wordmark object to undefined (Keystatic save artifact)", () => {
    // Keystatic's fields.object writes `"wordmark": {}` when both the
    // image and text inputs are blank. The schema treats this as "no
    // wordmark set" rather than throwing.
    const result = headerAndNavSchema.parse({ ...valid, wordmark: {} });
    expect(result.wordmark).toBeUndefined();
  });

  // ---- Header mode --------------------------------------------------------
  it("defaults headerMode to solid-sticky when missing (back-compat)", () => {
    const result = headerAndNavSchema.parse(valid);
    expect(result.headerMode).toBe("solid-sticky");
    // headerForegroundColor is a plain optional — stays undefined until set.
    expect(result.headerForegroundColor).toBeUndefined();
  });

  it("round-trips an explicit transparent-static header config", () => {
    const result = headerAndNavSchema.parse({
      ...valid,
      headerMode: "transparent-static" as const,
      headerForegroundColor: "#ffffff",
    });
    expect(result.headerMode).toBe("transparent-static");
    expect(result.headerForegroundColor).toBe("#ffffff");
  });

  it("accepts solid-static", () => {
    const result = headerAndNavSchema.parse({ ...valid, headerMode: "solid-static" as const });
    expect(result.headerMode).toBe("solid-static");
  });

  it("rejects unknown headerMode values", () => {
    expect(() =>
      headerAndNavSchema.parse({ ...valid, headerMode: "frosted-fixed" }),
    ).toThrow();
  });

  it("rejects the impossible transparent-sticky combo", () => {
    expect(() =>
      headerAndNavSchema.parse({ ...valid, headerMode: "transparent-sticky" }),
    ).toThrow();
  });

  it("accepts an empty headerForegroundColor (common seed value)", () => {
    const result = headerAndNavSchema.parse({ ...valid, headerForegroundColor: "" });
    expect(result.headerForegroundColor).toBe("");
  });

  // ---- Header style variations (§2.3) -------------------------------------
  it("applies §2.3 defaults when new fields are missing (back-compat)", () => {
    const result = headerAndNavSchema.parse(valid);
    expect(result.wordmarkSizeAdjust).toBe(0);
    expect(result.isHeaderTextUppercase).toBe(false);
    expect(result.headerSubtitle).toBeUndefined();
    expect(result.headerLayout).toBe("logo-left-nav-right");
  });

  it("round-trips explicit §2.3 header style values", () => {
    const withStyles = {
      ...valid,
      wordmarkSizeAdjust: 2,
      isHeaderTextUppercase: true,
      headerSubtitle: "Singer / songwriter",
      headerLayout: "logo-center-nav-split" as const,
    };
    const result = headerAndNavSchema.parse(withStyles);
    expect(result.wordmarkSizeAdjust).toBe(2);
    expect(result.isHeaderTextUppercase).toBe(true);
    expect(result.headerSubtitle).toBe("Singer / songwriter");
    expect(result.headerLayout).toBe("logo-center-nav-split");
  });

  it("coerces a string wordmarkSizeAdjust (Keystatic select emits strings)", () => {
    // Keystatic's `fields.select` serializes its value as a string, so JSON
    // round-trips may carry "-1" rather than -1. z.coerce.number() normalizes
    // both to a number.
    const result = headerAndNavSchema.parse({ ...valid, wordmarkSizeAdjust: "-1" });
    expect(result.wordmarkSizeAdjust).toBe(-1);
  });

  it("rejects wordmarkSizeAdjust outside the [-2, 2] range", () => {
    expect(() =>
      headerAndNavSchema.parse({ ...valid, wordmarkSizeAdjust: 3 }),
    ).toThrow();
    expect(() =>
      headerAndNavSchema.parse({ ...valid, wordmarkSizeAdjust: -3 }),
    ).toThrow();
  });

  it("rejects non-integer wordmarkSizeAdjust values", () => {
    expect(() =>
      headerAndNavSchema.parse({ ...valid, wordmarkSizeAdjust: 0.5 }),
    ).toThrow();
  });

  it("rejects unknown headerLayout values", () => {
    expect(() =>
      headerAndNavSchema.parse({ ...valid, headerLayout: "logo-above-nav-around" }),
    ).toThrow();
  });

  it("rejects non-boolean isHeaderTextUppercase", () => {
    expect(() =>
      headerAndNavSchema.parse({ ...valid, isHeaderTextUppercase: "yes" }),
    ).toThrow();
  });

  it("accepts an empty headerSubtitle (common seed value)", () => {
    const result = headerAndNavSchema.parse({ ...valid, headerSubtitle: "" });
    expect(result.headerSubtitle).toBe("");
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
    secondary: "#b91c4a",
    accent: "#0f3460",
    background: "#fafafa",
    surface: "#ffffff",
    text: "#1a1a2e",
    textMuted: "#6b7280",
    border: "#7c828b",
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
      colors: { ...validColors, linkColor: "#c00077" },
    };
    const result = appearanceSchema.parse(withLink);
    expect(result.colors.linkColor).toBe("#c00077");
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

  it("accepts optional isFooterHidden", () => {
    const hidden = pageFrontmatterSchema.parse({ title: "Home", isFooterHidden: true });
    expect(hidden.isFooterHidden).toBe(true);
    const visible = pageFrontmatterSchema.parse({ title: "Home", isFooterHidden: false });
    expect(visible.isFooterHidden).toBe(false);
    const unset = pageFrontmatterSchema.parse({ title: "Home" });
    expect(unset.isFooterHidden).toBeUndefined();
  });

  // ---- Page background overrides (1.2) ------------------------------------
  it("parses without any pageBackground override (inherits site-wide default)", () => {
    const result = pageFrontmatterSchema.parse({ title: "About" });
    expect(result.pageBackground).toBeUndefined();
    expect(result.pageBackgroundOverlay).toBeUndefined();
  });

  it("accepts a per-page pageBackground + overlay override", () => {
    const result = pageFrontmatterSchema.parse({
      title: "About",
      pageBackground: {
        src: "../../assets/images/about-bg.jpg",
        alt: "Studio shot",
      },
      pageBackgroundOverlay: { color: "#112233", opacity: 0.55 },
    });
    expect(result.pageBackground).toEqual({
      src: "../../assets/images/about-bg.jpg",
      alt: "Studio shot",
    });
    expect(result.pageBackgroundOverlay).toEqual({
      color: "#112233",
      opacity: 0.55,
    });
  });

  it("rejects a per-page pageBackground with empty alt", () => {
    expect(() =>
      pageFrontmatterSchema.parse({
        title: "About",
        pageBackground: { src: "../../assets/images/about-bg.jpg", alt: "" },
      }),
    ).toThrow();
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

describe("tourDateSchema", () => {
  const valid = {
    date: "2024-06-15",
    venue: "The Venue",
    city: "New York, NY",
    status: "on_sale" as const,
  };

  it("accepts a valid tour date", () => {
    expect(tourDateSchema.parse(valid)).toEqual(valid);
  });

  it("rejects invalid status", () => {
    expect(() => tourDateSchema.parse({ ...valid, status: "postponed" })).toThrow();
  });

  it("rejects the legacy 'upcoming' status (collapsed into on_sale)", () => {
    expect(() => tourDateSchema.parse({ ...valid, status: "upcoming" })).toThrow();
  });

  it("rejects the legacy 'past' status (now derived from date)", () => {
    expect(() => tourDateSchema.parse({ ...valid, status: "past" })).toThrow();
  });

  it("accepts optional ticketUrl", () => {
    const withUrl = { ...valid, ticketUrl: "https://tickets.example.com" };
    expect(tourDateSchema.parse(withUrl).ticketUrl).toBe("https://tickets.example.com");
  });

  it("accepts optional category slug", () => {
    const withCategory = { ...valid, category: "winter-tour" };
    expect(tourDateSchema.parse(withCategory).category).toBe("winter-tour");
  });
});

describe("headerAndNavSchema — items requirements", () => {
  it("rejects missing items field", () => {
    expect(() => headerAndNavSchema.parse({})).toThrow();
  });

  it("rejects flat array (must be wrapped in items)", () => {
    expect(() => headerAndNavSchema.parse(["home", "about"])).toThrow();
  });
});
