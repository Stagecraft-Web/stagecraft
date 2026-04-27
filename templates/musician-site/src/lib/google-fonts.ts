// ============================================================
// Google Fonts — curated list + URL builder
//
// A manageable selection of popular Google Fonts, grouped by
// category. Each entry carries a sensible fallback stack so the
// browser has something reasonable to render before (or if) the
// Google Font loads. Keystatic's font pickers reference this
// file, and BaseLayout uses `buildGoogleFontsUrl` to request
// only the weights actually in use.
// ============================================================

export type GoogleFontCategory =
  | "sans-serif"
  | "serif"
  | "monospace"
  | "display"
  | "handwriting";

export interface GoogleFontEntry {
  /** Family name as used by Google Fonts (e.g. "Work Sans"). */
  family: string;
  /** CSS generic fallback category appended to the font stack. */
  fallback: "sans-serif" | "serif" | "monospace" | "cursive" | "system-ui";
}

export const GOOGLE_FONTS: Record<GoogleFontCategory, GoogleFontEntry[]> = {
  "sans-serif": [
    { family: "Inter", fallback: "sans-serif" },
    { family: "Roboto", fallback: "sans-serif" },
    { family: "Open Sans", fallback: "sans-serif" },
    { family: "Lato", fallback: "sans-serif" },
    { family: "Montserrat", fallback: "sans-serif" },
    { family: "Poppins", fallback: "sans-serif" },
    { family: "Raleway", fallback: "sans-serif" },
    { family: "Work Sans", fallback: "sans-serif" },
    { family: "Nunito", fallback: "sans-serif" },
    { family: "Source Sans 3", fallback: "sans-serif" },
    { family: "DM Sans", fallback: "sans-serif" },
    { family: "Rubik", fallback: "sans-serif" },
    { family: "Manrope", fallback: "sans-serif" },
    { family: "Plus Jakarta Sans", fallback: "sans-serif" },
    { family: "Outfit", fallback: "sans-serif" },
  ],
  serif: [
    { family: "Merriweather", fallback: "serif" },
    { family: "Playfair Display", fallback: "serif" },
    { family: "Lora", fallback: "serif" },
    { family: "PT Serif", fallback: "serif" },
    { family: "Cormorant Garamond", fallback: "serif" },
    { family: "Libre Baskerville", fallback: "serif" },
    { family: "EB Garamond", fallback: "serif" },
    { family: "Crimson Text", fallback: "serif" },
    { family: "Bitter", fallback: "serif" },
    { family: "Source Serif 4", fallback: "serif" },
    { family: "Spectral", fallback: "serif" },
  ],
  monospace: [
    { family: "JetBrains Mono", fallback: "monospace" },
    { family: "Fira Code", fallback: "monospace" },
    { family: "Source Code Pro", fallback: "monospace" },
    { family: "IBM Plex Mono", fallback: "monospace" },
    { family: "Roboto Mono", fallback: "monospace" },
    { family: "Inconsolata", fallback: "monospace" },
    { family: "Space Mono", fallback: "monospace" },
  ],
  display: [
    { family: "Abril Fatface", fallback: "serif" },
    { family: "Bebas Neue", fallback: "sans-serif" },
    { family: "Oswald", fallback: "sans-serif" },
    { family: "Fjalla One", fallback: "sans-serif" },
    { family: "Archivo Black", fallback: "sans-serif" },
    { family: "Anton", fallback: "sans-serif" },
    { family: "Alfa Slab One", fallback: "serif" },
    { family: "Righteous", fallback: "sans-serif" },
  ],
  handwriting: [
    { family: "Caveat", fallback: "cursive" },
    { family: "Dancing Script", fallback: "cursive" },
    { family: "Pacifico", fallback: "cursive" },
    { family: "Kalam", fallback: "cursive" },
    { family: "Shadows Into Light", fallback: "cursive" },
    { family: "Sacramento", fallback: "cursive" },
    { family: "Satisfy", fallback: "cursive" },
  ],
};

/** Flat lookup of every curated family → its entry. */
export const GOOGLE_FONTS_BY_FAMILY: Record<string, GoogleFontEntry> =
  Object.values(GOOGLE_FONTS)
    .flat()
    .reduce<Record<string, GoogleFontEntry>>((acc, entry) => {
      acc[entry.family] = entry;
      return acc;
    }, {});

/** Font weights we expose in Keystatic pickers. */
export const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export type FontWeight = (typeof FONT_WEIGHTS)[number];

/**
 * Build a CSS font stack given a family, wrapping multi-word names in quotes
 * and appending the generic fallback. Unknown families (user "custom" input)
 * default to the `sans-serif` fallback.
 *
 * `category` accepts the broader set from the appearance schema (including
 * "custom") so callers don't need to narrow before calling.
 */
export function buildFontStack(
  family: string,
  category?: GoogleFontCategory | "custom",
): string {
  const known = GOOGLE_FONTS_BY_FAMILY[family];
  const fallback = known?.fallback ?? categoryFallback(category);
  const quoted = family.includes(" ") ? `"${family}"` : family;
  return `${quoted}, ${fallback}`;
}

function categoryFallback(
  category?: GoogleFontCategory | "custom",
): GoogleFontEntry["fallback"] {
  switch (category) {
    case "serif":
    case "display":
      return "serif";
    case "monospace":
      return "monospace";
    case "handwriting":
      return "cursive";
    case "sans-serif":
    case "custom":
    default:
      return "sans-serif";
  }
}

/**
 * Build a Google Fonts v2 stylesheet URL for one or more families, each
 * with a specific set of weights. Weights are deduped and sorted. Families
 * with no weights are skipped. Returns null when nothing needs loading.
 *
 * @example
 *   buildGoogleFontsUrl([
 *     { family: "Inter", weights: [400, 700] },
 *     { family: "Merriweather", weights: [700] },
 *   ])
 *   // → "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Merriweather:wght@700&display=swap"
 */
export interface FontFamilyRequest {
  family: string;
  weights: number[];
}

export function buildGoogleFontsUrl(families: FontFamilyRequest[]): string | null {
  const clean = families
    .map((f) => ({
      family: f.family.trim(),
      weights: Array.from(new Set(f.weights)).filter((w) => Number.isFinite(w)).sort((a, b) => a - b),
    }))
    .filter((f) => f.family.length > 0 && f.weights.length > 0);

  if (clean.length === 0) return null;

  const params = clean
    .map((f) => `family=${encodeFamilyName(f.family)}:wght@${f.weights.join(";")}`)
    .join("&");

  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

/** Google Fonts expects spaces as `+` (not `%20`) in the `family` parameter. */
function encodeFamilyName(family: string): string {
  return family.replace(/\s+/g, "+");
}

// ============================================================
// Appearance → font requests
//
// Collapses an Appearance config down into the minimum set of
// (family, weights[]) requests needed to render the site. When
// mode is "single", heading selections are ignored. When mode is
// "split" and heading/body share a family, their weights are merged.
// ============================================================

interface AppearanceLike {
  typography: {
    mode: "single" | "split";
    primary: { family: string };
    /** `null` when mode === "single". */
    heading: { family: string } | null;
    bodyWeights: {
      body: number;
      bodyBold: number;
    };
    headingWeights: {
      h1: number;
      h2: number;
      h3: number;
      h4: number;
    };
  };
}

export function appearanceToFontRequests(
  appearance: AppearanceLike,
): FontFamilyRequest[] {
  const { mode, primary, heading, bodyWeights: bw, headingWeights: hw } = appearance.typography;
  const headingWeights = [hw.h1, hw.h2, hw.h3, hw.h4];
  const bodyWeights = [bw.body, bw.bodyBold];

  // Single mode (or split with no heading somehow) → one family, all weights.
  if (mode === "single" || !heading) {
    return [
      {
        family: primary.family,
        weights: [...bodyWeights, ...headingWeights],
      },
    ];
  }

  // Split mode but both picks resolved to the same family → collapse.
  if (primary.family === heading.family) {
    return [
      {
        family: primary.family,
        weights: [...bodyWeights, ...headingWeights],
      },
    ];
  }

  return [
    { family: primary.family, weights: bodyWeights },
    { family: heading.family, weights: headingWeights },
  ];
}
