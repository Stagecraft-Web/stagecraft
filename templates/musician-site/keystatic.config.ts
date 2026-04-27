import { config, fields, collection, singleton } from "@keystatic/core";
import { GOOGLE_FONTS, FONT_WEIGHTS } from "./src/lib/google-fonts";
import { pageContentComponents } from "./src/lib/keystatic-blocks";
import {
  BODY_FONT_SIZE_BUCKETS,
  FONT_CATEGORIES,
  FONT_CATEGORY_LABELS,
  FONT_SIZE_BUCKET_LABELS,
  FONT_SIZE_PX_MAX,
  FONT_SIZE_PX_MIN,
  HEADER_LAYOUTS,
  HEADER_LAYOUT_LABELS,
  HEADER_MODES,
  HEADER_MODE_LABELS,
  HEADING_FONT_SIZE_BUCKETS,
  IMAGE_USAGE_SLOTS,
  IMAGE_USAGE_SLOT_LABELS,
  POST_CATEGORIES,
  POST_STATUSES,
  RELEASE_TYPES,
  RELEASE_TYPE_LABELS,
  SIZE_ADJUSTMENTS,
  SIZE_ADJUSTMENT_LABELS,
  STORE_ITEM_FORMATS,
  STORE_ITEM_STATUSES,
  TOUR_DATE_STATUSES,
  TOUR_DATE_STATUS_LABELS,
  VIDEO_TYPES,
  VIDEO_TYPE_LABELS,
  type FontCategory,
  type FontSizeBucket,
  type HeaderLayout,
  type HeaderMode,
  type ImageUsageSlot,
} from "./src/lib/schemas";

// ---------------------------------------------------------------------------
// Appearance singleton helpers
//
// A font picker is a conditional on category — pick "Sans-serif" and you get
// a dropdown of sans-serif Google Fonts; pick "Custom" and you get a free-text
// input so the user can name any family from fonts.google.com. Each category's
// font list is sourced from `src/lib/google-fonts.ts` so the Keystatic picker
// and the runtime Google Fonts URL builder share the same curated catalogue.
// ---------------------------------------------------------------------------

const toOptions = (families: { family: string }[]) =>
  families.map((f) => ({ label: f.family, value: f.family }));

const weightOptions = FONT_WEIGHTS.map((w) => ({ label: String(w), value: String(w) }));

// Pair each category (from schemas.FONT_CATEGORIES) with its display label
// (from schemas.FONT_CATEGORY_LABELS). Keystatic's select typing wants the
// literal-union preserved, so we build the tuple by mapping the canonical
// const rather than redeclaring the values here.
const CATEGORY_OPTIONS = FONT_CATEGORIES.map((v) => ({
  label: FONT_CATEGORY_LABELS[v],
  value: v,
})) as unknown as readonly { label: string; value: FontCategory }[];

const CATEGORY_DEFAULTS: Record<Exclude<FontCategory, "custom">, string> = {
  "sans-serif": "Inter",
  serif: "Merriweather",
  monospace: "JetBrains Mono",
  display: "Abril Fatface",
  handwriting: "Caveat",
};

/**
 * Font picker — a category selector that reveals the matching font list (or
 * a free-text input for "Custom"). Labels stay short: the picker label is
 * shown once as the category label; the font dropdown below reuses the same
 * label so it reads naturally.
 */
const fontPicker = (label: string, defaults: { category: FontCategory; family: string }) =>
  fields.conditional(
    fields.select({
      label: `${label} — category`,
      description:
        "Pick a category, then pick a font. Use 'Custom' to type any family from fonts.google.com.",
      options: [...CATEGORY_OPTIONS],
      defaultValue: defaults.category,
    }),
    {
      "sans-serif": fields.select({
        label,
        options: toOptions(GOOGLE_FONTS["sans-serif"]),
        defaultValue: defaults.category === "sans-serif" ? defaults.family : CATEGORY_DEFAULTS["sans-serif"],
      }),
      serif: fields.select({
        label,
        options: toOptions(GOOGLE_FONTS.serif),
        defaultValue: defaults.category === "serif" ? defaults.family : CATEGORY_DEFAULTS.serif,
      }),
      monospace: fields.select({
        label,
        options: toOptions(GOOGLE_FONTS.monospace),
        defaultValue: defaults.category === "monospace" ? defaults.family : CATEGORY_DEFAULTS.monospace,
      }),
      display: fields.select({
        label,
        options: toOptions(GOOGLE_FONTS.display),
        defaultValue: defaults.category === "display" ? defaults.family : CATEGORY_DEFAULTS.display,
      }),
      handwriting: fields.select({
        label,
        options: toOptions(GOOGLE_FONTS.handwriting),
        defaultValue: defaults.category === "handwriting" ? defaults.family : CATEGORY_DEFAULTS.handwriting,
      }),
      custom: fields.text({
        label: `${label} — custom family name`,
        description:
          "Type the family exactly as it appears on fonts.google.com (e.g. 'Space Grotesk'). Must start with a capital and contain only letters, digits, and spaces. Validated on save via 'npm run validate:content'.",
        defaultValue: defaults.category === "custom" ? defaults.family : "",
        validation: { length: { min: 1 } },
      }),
    },
  );

const weightField = (label: string, defaultValue: number) =>
  fields.select({
    label,
    options: weightOptions,
    defaultValue: String(defaultValue) as (typeof weightOptions)[number]["value"],
  });

// Per-bucket font-size editor. Renders as a `fields.object` of integer
// number-inputs (one per bucket) — Keystatic gives them browser-native +/−
// spinner buttons. Stored as pixels (1rem = 16px); `0` falls back to
// theme.json's baseline at render time. Used twice in the Appearance
// singleton — once for body buckets (xs/sm/base/lg), once for heading
// buckets (xl/2xl/3xl/4xl).
const sizesObject = <T extends FontSizeBucket>(
  buckets: readonly T[],
  label: string,
) =>
  fields.object(
    Object.fromEntries(
      buckets.map((b) => [
        b,
        fields.integer({
          label: FONT_SIZE_BUCKET_LABELS[b],
          description: "Pixels (16 = 1rem). 0 inherits the theme.json default.",
          defaultValue: 0,
          validation: { min: FONT_SIZE_PX_MIN, max: FONT_SIZE_PX_MAX },
        }),
      ]),
    ) as Record<T, ReturnType<typeof fields.integer>>,
    {
      label,
      description:
        "Per-bucket overrides on top of theme.json's font-size scale. Step the spinners or leave at 0 to inherit the default.",
    },
  );

// Optional image authored as a Keystatic conditional with a None / Image
// select. Pick "None" (the default) and nothing renders; pick "Image" and the
// inner object's required fields appear, so the editor blocks save until both
// src and alt are filled. Pass an inner `fields.object` whose `src`/`alt` set
// `validation: { isRequired: true }`.
//
// Why this exists: Keystatic can't natively express "alt is required only
// when src is present" — and a flat `fields.object` lets authors upload an
// image without alt, which breaks the site at content-validation time. The
// conditional shifts that requirement enforcement into the editor itself.
//
// On disk the field serialises as `{ discriminant, value }`; the matching
// Zod helper `optionalImageFromConditional` (src/lib/schemas.ts and
// src/content.config.ts) collapses it back to `T | undefined` so renderers
// don't need to know about the wrapper.
const optionalImage = <ImageObject extends Parameters<typeof fields.conditional>[1][string]>(
  label: string,
  description: string,
  imageObject: ImageObject,
) =>
  fields.conditional(
    fields.select({
      label,
      description,
      options: [
        { label: "None", value: "none" },
        { label: "Image", value: "image" },
      ],
      defaultValue: "none",
    }),
    {
      none: fields.empty(),
      image: imageObject,
    },
  );

// Build a curated "Usage Slot" select that exposes only the subset of
// IMAGE_USAGE_SLOTS relevant to a given collection (e.g. photos rarely need
// "release-cover"). Preserves the canonical order from IMAGE_USAGE_SLOTS and
// re-uses its label map so all callers stay in lock-step.
const usageSlotField = (
  allowed: readonly ImageUsageSlot[],
  defaultValue: ImageUsageSlot,
  label = "Usage Slot",
) =>
  fields.select({
    label,
    options: IMAGE_USAGE_SLOTS.filter((v) => allowed.includes(v)).map((v) => ({
      label: IMAGE_USAGE_SLOT_LABELS[v],
      value: v,
    })) as [
      { label: string; value: ImageUsageSlot },
      ...{ label: string; value: ImageUsageSlot }[],
    ],
    defaultValue,
  });

// ---------------------------------------------------------------------------
// Markdoc content components — these appear as insertable blocks in the
// Keystatic Markdoc editor. Tag names here match markdoc.config.ts.
//
// Each entry in `contentComponents` exports both a `keystatic` block/wrapper
// (consumed here) and a `markdoc` tag def (consumed by markdoc.config.ts),
// colocated with its renderer in src/content-components/<Name>/. The aggregated
// `pageContentComponents` map lives in src/lib/keystatic-blocks.ts so both
// pages AND other rich-body collections (e.g. posts) can reuse it — add new
// components in src/content-components/ and they'll appear everywhere.
// ---------------------------------------------------------------------------

// Storage mode is environment-driven so a single config serves both dev and
// prod:
//   - Unset (or "local")  → filesystem writes, no auth. Use `npm run dev`.
//   - "github"            → writes commit to GitHub via the user's OAuth
//                           token. Required env vars on the deploy:
//                             PUBLIC_KEYSTATIC_STORAGE=github
//                             PUBLIC_KEYSTATIC_REPO=owner/repo
//                             KEYSTATIC_GITHUB_CLIENT_ID=…
//                             KEYSTATIC_GITHUB_CLIENT_SECRET=…
//                             KEYSTATIC_SECRET=…            # any random 32+ bytes
//                           See docs/keystatic-github-setup.md for the
//                           GitHub App walkthrough.
//
// The sidebar on the public site uses the GitHub access token Keystatic sets
// as a cookie during sign-in, so the storage choice here gates whether the
// sidebar even renders in production.
const storageMode = import.meta.env.PUBLIC_KEYSTATIC_STORAGE === "github" ? "github" : "local";
const githubRepo = import.meta.env.PUBLIC_KEYSTATIC_REPO ?? "owner/repo";

export default config({
  storage:
    storageMode === "github"
      ? { kind: "github", repo: githubRepo as `${string}/${string}` }
      : { kind: "local" },

  singletons: {
    // -----------------------------------------------------------------
    // Config singletons
    // -----------------------------------------------------------------

    siteConfig: singleton({
      label: "Site Settings",
      path: "src/content/config/site",
      format: { data: "json" },
      schema: {
        artistName: fields.text({ label: "Artist Name", validation: { isRequired: true } }),
        // Optional site favicon (the icon shown in the browser tab). When
        // unset, BaseLayout falls back to /favicons/favicon.svg in public/.
        // Dedicated subdirectory so favicons don't mix with photo/cover
        // assets; publicPath walks back two levels from site.json's location
        // (src/content/config/) to reach src/assets/favicons/.
        favicon: fields.image({
          label: "Favicon",
          description:
            "Optional browser-tab icon. SVG recommended (scales crisply); PNG and JPG also supported. Leave blank to use the default favicon.",
          directory: "src/assets/favicons",
          publicPath: "../../assets/favicons/",
        }),
        // Site-wide default page-background image. Rendered as a fixed-position
        // layer behind all page content (below the overlay). Individual pages
        // can override this via their own `pageBackground` frontmatter.
        //
        // `src/assets/images/` with `../../assets/images/` matches the
        // wordmark's convention — site.json lives in `src/content/config/`,
        // so the publicPath walks back two levels.
        pageBackground: optionalImage(
          "Page Background",
          "Optional site-wide background photo shown behind every page's content. Individual pages can override this from their own settings. Pick 'Image' to set a background; pick 'None' for no site-wide background.",
          fields.object({
            src: fields.image({
              label: "Background Image",
              directory: "src/assets/images",
              publicPath: "../../assets/images/",
              validation: { isRequired: true },
            }),
            alt: fields.text({
              label: "Alt Text",
              description:
                "Short description of the background image. Required for accessibility even though the layer is marked aria-hidden — validators expect alt on any image reference.",
              validation: { isRequired: true },
            }),
          }),
        ),
        pageBackgroundOverlay: fields.object(
          {
            color: fields.text({
              label: "Overlay color",
              description:
                "Hex ('#000000') or rgb()/rgba() value painted over the background image. Darken the image to boost text contrast, or use a brand color for a tinted wash.",
              defaultValue: "#000000",
            }),
            opacity: fields.number({
              label: "Overlay opacity",
              description: "0 = transparent, 1 = fully opaque. Typical range 0.2 – 0.5.",
              validation: { min: 0, max: 1 },
              defaultValue: 0.3,
            }),
          },
          {
            label: "Page Background Overlay",
            description:
              "Tint painted over the site-wide background image for text legibility. Ignored when no background image is set.",
          },
        ),
        siteTitle: fields.text({ label: "Site Title", validation: { isRequired: true } }),
        siteDescription: fields.text({ label: "Site Description", multiline: true }),
        socialLinks: fields.object(
          {
            instagram: fields.text({ label: "Instagram URL" }),
            twitter: fields.text({ label: "Twitter / X URL" }),
            facebook: fields.text({ label: "Facebook URL" }),
            youtube: fields.text({ label: "YouTube URL" }),
            spotify: fields.text({ label: "Spotify URL" }),
            appleMusic: fields.text({ label: "Apple Music URL" }),
            bandcamp: fields.text({ label: "Bandcamp URL" }),
            soundcloud: fields.text({ label: "SoundCloud URL" }),
            tiktok: fields.text({ label: "TikTok URL" }),
          },
          { label: "Social Links" },
        ),
        contactEmail: fields.text({ label: "Contact Email", validation: { isRequired: true } }),
        copyrightName: fields.text({
          label: "Copyright holder",
          description:
            "Name shown in the footer's copyright line. Leave blank to use your artist name. Set this only when copyright is held under a different name (legal entity, civil name, etc.). The year and \"All rights reserved.\" boilerplate are filled in automatically.",
        }),
        isFooterHidden: fields.checkbox({
          label: "Hide footer site-wide",
          description:
            "When enabled, the site footer (social links + copyright) is hidden on every page. Individual pages can override this via their own 'Hide footer on this page' toggle.",
          defaultValue: false,
        }),
      },
    }),

    // -----------------------------------------------------------------
    // Header & Navigation — bundles the brand wordmark, header
    // appearance/position settings, and nav membership/order in a
    // single editor screen so all header authoring lives together.
    //
    // `multiRelationship` (items) renders two parts in the editor:
    //   1. A combobox at the top listing pages NOT yet in the nav
    //      (i.e. omitted pages). Pick one to add it.
    //   2. A drag-and-drop list below of the pages currently in the
    //      nav, in order.
    // -----------------------------------------------------------------

    headerAndNavigation: singleton({
      label: "Header & Navigation",
      path: "src/content/config/header",
      format: { data: "json" },
      schema: {
        // Optional brand wordmark image. When set, the Header renders this
        // image in place of the artist-name text. All other uses of
        // artistName (document <title>, meta tags, footer) are unaffected —
        // the wordmark only replaces the visible brand mark in the header.
        //
        // Directory is `src/assets/images/` (top-level, not a collection
        // subfolder) because the wordmark is a site-wide brand asset rather
        // than content belonging to a single release/photo/etc. publicPath
        // walks back two levels from header.json's location
        // (src/content/config/) to reach src/assets/images/.
        wordmark: optionalImage(
          "Wordmark",
          "Optional brand wordmark image shown in the header instead of the artist name text. PNG / SVG / JPG; transparency supported. Pick 'None' to use the artist-name text.",
          fields.object({
            src: fields.image({
              label: "Wordmark Image",
              directory: "src/assets/images",
              publicPath: "../../assets/images/",
              validation: { isRequired: true },
            }),
            alt: fields.text({
              label: "Alt Text",
              description:
                "Describes the wordmark for screen readers. Usually just the artist name.",
              validation: { isRequired: true },
            }),
          }),
        ),
        wordmarkSizeAdjust: fields.select({
          label: "Wordmark size",
          description:
            "Scales the wordmark image up or down from the default height. Only applies when a wordmark is uploaded above. −2 ≈ 0.72×, +2 ≈ 1.35×.",
          // Stringify: Keystatic select values must be strings.
          options: SIZE_ADJUSTMENTS.map((v) => ({
            label: SIZE_ADJUSTMENT_LABELS[String(v)],
            value: String(v),
          })) as [
            { label: string; value: string },
            ...{ label: string; value: string }[],
          ],
          defaultValue: "0",
        }),
        // -------------------------------------------------------------
        // Header mode — bundles header style + scroll behavior into one
        // pick. "Solid, sticky" (default) is the standard nav that
        // pins to the top on scroll. "Solid, scrolls with page" keeps
        // the surface paint but lets the header scroll away. "Trans-
        // parent, scrolls with page" lets a hero image / fullscreen
        // section read through and is meant to disappear as the
        // reader scrolls past — sticky is intentionally not offered
        // alongside transparent because content scrolling under a
        // partly-transparent pinned header flashes through.
        // -------------------------------------------------------------
        headerMode: fields.select({
          label: "Header mode",
          description:
            "Pick how the header looks and behaves as the page scrolls. Default is solid + sticky (the nav pins to the top). 'Transparent, scrolls with page' is meant to pair with a page that opens with a fullscreen-section or hero image — the nav sits over it and scrolls away.",
          options: HEADER_MODES.map((v) => ({
            label: HEADER_MODE_LABELS[v],
            value: v,
          })) as [
            { label: string; value: HeaderMode },
            ...{ label: string; value: HeaderMode }[],
          ],
          defaultValue: "solid-sticky",
        }),
        headerForegroundColor: fields.text({
          label: "Header foreground color",
          description:
            "Optional. Only applied when header mode is 'Transparent, scrolls with page'. Use to color nav/title for contrast against a page-background image. Hex / rgb() / rgba().",
          defaultValue: "",
        }),
        // -------------------------------------------------------------
        // Header style variations (§2.3)
        //
        // Three coarse style levers on top of the §2.2 structure knobs:
        //   - Uppercase applies CSS text-transform to `.site-title` only
        //     (wordmark images are unaffected — they're pre-rendered).
        //   - Header subtitle renders a muted second line under the
        //     artist name; hidden when a wordmark image is in use.
        //   - Header layout changes how logo + nav are arranged
        //     (default flex, centered-with-nav-below grid, centered-
        //     split grid). Mobile hamburger works across all three.
        // -------------------------------------------------------------
        isHeaderTextUppercase: fields.checkbox({
          label: "Uppercase header text",
          description:
            "Renders the artist name in uppercase with slight extra letter-spacing. Only affects the text variant; wordmark images are not transformed.",
          defaultValue: false,
        }),
        headerSubtitle: fields.text({
          label: "Header subtitle (optional)",
          description:
            "Small second line under the artist name — a tagline, location, or role. Hidden automatically when a wordmark image is set, since wordmarks usually carry their own hierarchy.",
          defaultValue: "",
        }),
        headerLayout: fields.select({
          label: "Header layout",
          description:
            "How logo and navigation are arranged. 'Logo left, nav right' is the default flex layout. The two centered variants are grid-based: 'nav below' stacks the nav under a centered logo; 'nav split' places the nav on both sides of a centered logo.",
          options: HEADER_LAYOUTS.map((v) => ({
            label: HEADER_LAYOUT_LABELS[v],
            value: v,
          })) as [
            { label: string; value: HeaderLayout },
            ...{ label: string; value: HeaderLayout }[],
          ],
          defaultValue: "logo-left-nav-right",
        }),
        items: fields.multiRelationship({
          label: "Navigation Items",
          collection: "pages",
          description:
            "Pick pages to include in the site navigation. Drag to reorder. Pages not in this list won't appear in the header nav.",
        }),
      },
    }),

    // -----------------------------------------------------------------
    // Appearance — colors and typography (Google Fonts).
    //
    // Typography is split into a Body group and a Headings group; each
    // owns its font family, per-bucket sizes, and weights. Per-bucket
    // size fields accept rem values ("1.25rem"); leave a field blank
    // to inherit from theme.json's baseline.
    //
    // The font picker is category-first: choose Sans-serif/Serif/
    // Monospace/Display/Handwriting to get a curated list, or choose
    // "Custom" to type any family name from fonts.google.com.
    //
    // Heading mode is single (same font as body) or split (own family);
    // weight pickers per heading level let the runtime fetch only the
    // exact weights actually in use.
    // -----------------------------------------------------------------

    appearance: singleton({
      label: "Appearance",
      path: "src/content/config/appearance",
      format: { data: "json" },
      schema: {
        colors: fields.object(
          {
            primary: fields.text({ label: "Primary (headings, logo)", defaultValue: "#1a1a2e" }),
            secondary: fields.text({ label: "Secondary (CTAs, accents)", defaultValue: "#b91c4a" }),
            accent: fields.text({ label: "Accent", defaultValue: "#0f3460" }),
            // Optional — leave blank to reuse Accent. Authors who want links to
            // read differently from the main accent/CTA color (e.g. a subdued
            // link color on a bold accent palette) set this explicitly.
            linkColor: fields.text({
              label: "Link color (optional)",
              description:
                "Distinct color for inline text links. Leave blank to use Accent.",
              defaultValue: "",
            }),
            background: fields.text({ label: "Page background", defaultValue: "#fafafa" }),
            surface: fields.text({ label: "Surface (cards, panels)", defaultValue: "#ffffff" }),
            text: fields.text({ label: "Body text", defaultValue: "#1a1a2e" }),
            textMuted: fields.text({ label: "Muted text", defaultValue: "#6b7280" }),
            border: fields.text({ label: "Borders & dividers", defaultValue: "#7c828b" }),
          },
          {
            label: "Colors",
            description:
              "Hex ('#1a1a2e') or rgb()/rgba() values. Keystatic doesn't render a color swatch inline — preview on the site after saving. Tip: use a tool like coolors.co or Google Material colors to build a palette, then paste the values here.",
          },
        ),
        typography: fields.object(
          {
            // Body font picker. The body's family is the fallback when
            // headings use "Same as body".
            primary: fontPicker("Body font", {
              category: "sans-serif",
              family: "Inter",
            }),
            // Body sizes — xs / sm / base / lg map to body / small body /
            // captions and h6 / h5 in global.css. Empty string means "use
            // theme.json baseline" (the default).
            bodySizes: sizesObject(BODY_FONT_SIZE_BUCKETS, "Body sizes"),
            bodyWeights: fields.object(
              {
                body: weightField("Body", 400),
                bodyBold: weightField("Body bold", 700),
              },
              {
                label: "Body weights",
                description:
                  "Only the weights you pick here are downloaded — unused weights aren't requested. Some fonts don't ship every weight; check fonts.google.com if a weight looks wrong.",
              },
            ),
            // `mode` is the discriminant: "single" hides the heading picker
            // entirely; "split" reveals it (Keystatic conditional UX).
            heading: fields.conditional(
              fields.select({
                label: "Heading font",
                description: "Use the same font as the body, or pick a different font for headings.",
                options: [
                  { label: "Same as body", value: "single" },
                  { label: "Different font for headings", value: "split" },
                ],
                defaultValue: "single",
              }),
              {
                single: fields.empty(),
                split: fontPicker("Heading font", {
                  category: "serif",
                  family: "Merriweather",
                }),
              },
            ),
            // Heading sizes — xl / 2xl / 3xl / 4xl map to h4..h1 in global.css.
            headingSizes: sizesObject(HEADING_FONT_SIZE_BUCKETS, "Heading sizes"),
            headingWeights: fields.object(
              {
                h1: weightField("H1", 700),
                h2: weightField("H2", 700),
                h3: weightField("H3", 700),
                h4: weightField("H4", 700),
              },
              {
                label: "Heading weights",
                description:
                  "Only the weights you pick here are downloaded. h5 and h6 inherit sensible defaults — edit theme.json directly if you need to change them.",
              },
            ),
          },
          {
            label: "Typography",
            description:
              "Body group then headings — each owns a font family, per-bucket sizes, and weights. Leave any size blank to inherit the theme.json default.",
          },
        ),
      },
    }),
  },

  collections: {
    // -----------------------------------------------------------------
    // Pages — one Markdoc file per page.
    //
    // All pages share minimal frontmatter (title only).
    // Navigation membership is controlled by the Navigation singleton,
    // not by page frontmatter. Page-specific structured content uses
    // Markdoc content components that appear as insertable blocks.
    // -----------------------------------------------------------------

    pages: collection({
      label: "Pages",
      slugField: "title",
      path: "src/content/pages/*",
      format: { contentField: "content" },
      schema: {
        title: fields.slug({ name: { label: "Page Title", validation: { isRequired: true } } }),
        isSplashPage: fields.checkbox({
          label: "Splash page",
          description:
            'When enabled, this page appears at "/" (the site root) and renders without the site header or footer. Your regular home page automatically moves to "/home". Link the "Enter Site" button in this page\'s body to /home. Only one page can be marked as a splash.',
          defaultValue: false,
        }),
        isFooterHidden: fields.checkbox({
          label: "Hide footer on this page",
          description: "Overrides the site-level setting for this page only.",
          defaultValue: false,
        }),
        // Per-page background override. Leave unset to inherit the site-wide
        // default from Site Settings → Page Background. Splash pages ignore
        // this entirely — they render their own full-bleed imagery via
        // FullscreenSection.
        //
        // pages live in `src/content/pages/*`, so publicPath walks back two
        // levels to reach src/assets/images/ — same as the wordmark from
        // src/content/config/.
        pageBackground: optionalImage(
          "Page Background (override)",
          "Pick 'None' to inherit the site-wide default. Pick 'Image' to override with this page's own background photo.",
          fields.object({
            src: fields.image({
              label: "Background Image",
              directory: "src/assets/images",
              publicPath: "../../assets/images/",
              validation: { isRequired: true },
            }),
            alt: fields.text({
              label: "Alt Text",
              description:
                "Short description of the background image. Required even though the layer is marked aria-hidden — validators expect alt on any image reference.",
              validation: { isRequired: true },
            }),
          }),
        ),
        pageBackgroundOverlay: fields.object(
          {
            color: fields.text({
              label: "Overlay color",
              description: "Hex ('#000000') or rgb()/rgba() value. Leave blank inputs to inherit defaults.",
              defaultValue: "#000000",
            }),
            opacity: fields.number({
              label: "Overlay opacity",
              description: "0 = transparent, 1 = fully opaque. Typical range 0.2 – 0.5.",
              validation: { min: 0, max: 1 },
              defaultValue: 0.3,
            }),
          },
          {
            label: "Page Background Overlay (override)",
            description:
              "Leave unset to inherit the site-wide overlay. Only applies when a background image is resolved for this page.",
          },
        ),
        content: fields.markdoc({
          label: "Body Content",
          components: pageContentComponents,
        }),
      },
    }),

    // -----------------------------------------------------------------
    // Music releases — one YAML file per release
    // -----------------------------------------------------------------

    releases: collection({
      label: "Releases",
      slugField: "title",
      path: "src/content/collections/releases/*",
      schema: {
        title: fields.slug({ name: { label: "Title", validation: { isRequired: true } } }),
        type: fields.select({
          label: "Type",
          options: RELEASE_TYPES.map((v) => ({
            label: RELEASE_TYPE_LABELS[v],
            value: v,
          })) as [
            { label: string; value: (typeof RELEASE_TYPES)[number] },
            ...{ label: string; value: (typeof RELEASE_TYPES)[number] }[],
          ],
          defaultValue: "album",
        }),
        releaseDate: fields.date({ label: "Release Date", validation: { isRequired: true } }),
        coverImage: fields.object(
          {
            src: fields.image({
              label: "Cover Image",
              directory: "src/assets/images",
              publicPath: "../../../assets/images/",
              validation: { isRequired: true },
            }),
            alt: fields.text({ label: "Alt Text", validation: { isRequired: true } }),
            caption: fields.text({ label: "Caption" }),
            credit: fields.text({ label: "Credit" }),
            usageSlot: usageSlotField(
              ["release-cover", "hero", "gallery", "thumbnail"],
              "release-cover",
            ),
          },
          { label: "Cover Image" },
        ),
        description: fields.text({ label: "Description", multiline: true }),
        links: fields.object(
          {
            spotify: fields.text({ label: "Spotify URL" }),
            appleMusic: fields.text({ label: "Apple Music URL" }),
            bandcamp: fields.text({ label: "Bandcamp URL" }),
          },
          { label: "Streaming Links" },
        ),
        tracks: fields.array(
          fields.object({
            title: fields.text({ label: "Title", validation: { isRequired: true } }),
            duration: fields.text({ label: "Duration", validation: { isRequired: true } }),
          }),
          {
            label: "Track List",
            itemLabel: (props) => props.fields.title.value || "Track",
          },
        ),
      },
    }),

    // -----------------------------------------------------------------
    // Photos — one YAML file per photo
    // -----------------------------------------------------------------

    photos: collection({
      label: "Photos",
      slugField: "alt",
      path: "src/content/collections/photos/*",
      schema: {
        src: fields.image({
          label: "Photo",
          directory: "src/assets/images",
          publicPath: "../../../assets/images/",
          validation: { isRequired: true },
        }),
        alt: fields.slug({ name: { label: "Alt Text", validation: { isRequired: true } } }),
        caption: fields.text({ label: "Caption" }),
        credit: fields.text({ label: "Credit" }),
        usageSlot: usageSlotField(
          ["gallery", "hero", "about", "press", "background", "thumbnail"],
          "gallery",
        ),
      },
    }),

    // -----------------------------------------------------------------
    // Videos — one YAML file per video
    // -----------------------------------------------------------------

    videos: collection({
      label: "Videos",
      slugField: "title",
      path: "src/content/collections/videos/*",
      schema: {
        title: fields.slug({ name: { label: "Title", validation: { isRequired: true } } }),
        url: fields.url({ label: "Video URL", validation: { isRequired: true } }),
        type: fields.select({
          label: "Platform",
          options: VIDEO_TYPES.map((v) => ({
            label: VIDEO_TYPE_LABELS[v],
            value: v,
          })) as [
            { label: string; value: (typeof VIDEO_TYPES)[number] },
            ...{ label: string; value: (typeof VIDEO_TYPES)[number] }[],
          ],
          defaultValue: "youtube",
        }),
        description: fields.text({ label: "Description", multiline: true }),
      },
    }),

    // -----------------------------------------------------------------
    // Tour dates — one YAML file per date
    // -----------------------------------------------------------------

    tourDates: collection({
      label: "Tour Dates",
      slugField: "venue",
      path: "src/content/collections/tourDates/*",
      // Show date + venue + city in the collection list so authors can
      // scan upcoming/past shows without opening each entry.
      columns: ["date", "city"],
      schema: {
        date: fields.date({ label: "Date", validation: { isRequired: true } }),
        venue: fields.slug({
          name: {
            label: "Venue",
            description:
              "The venue name. Doubles as the filename (slugified). If the same venue plays twice, Keystatic appends -1, -2.",
            validation: { isRequired: true },
          },
        }),
        city: fields.text({ label: "City", validation: { isRequired: true } }),
        ticketUrl: fields.url({ label: "Ticket URL" }),
        status: fields.select({
          label: "Status",
          options: TOUR_DATE_STATUSES.map((v) => ({
            label: TOUR_DATE_STATUS_LABELS[v],
            value: v,
          })) as [
            { label: string; value: (typeof TOUR_DATE_STATUSES)[number] },
            ...{ label: string; value: (typeof TOUR_DATE_STATUSES)[number] }[],
          ],
          defaultValue: "on_sale",
        }),
        category: fields.relationship({
          label: "Category",
          collection: "tourCategories",
          description:
            "Optional series or show type. Pick an existing category or add a new one in the Tour Categories collection.",
        }),
      },
    }),

    // -----------------------------------------------------------------
    // Tour categories — lightweight tag collection backing
    // `tourDates.category` and the `tour-dates` block's category filter.
    // -----------------------------------------------------------------

    tourCategories: collection({
      label: "Tour Categories",
      slugField: "name",
      path: "src/content/collections/tourCategories/*",
      schema: {
        name: fields.slug({
          name: {
            label: "Name",
            description:
              "Display name for the category (e.g. 'Winter Tour'). The slug links tour dates to this category.",
            validation: { isRequired: true },
          },
        }),
      },
    }),

    // -----------------------------------------------------------------
    // Posts / news — one `.mdoc` file per post with a rich Markdoc body.
    //
    // The body reuses `pageContentComponents` so posts can embed the
    // same blocks pages do (image, button, embed, …). The dynamic route
    // at src/pages/news/[slug].astro filters to status="published";
    // drafts become 404s in production builds but are visible in dev.
    // -----------------------------------------------------------------

    posts: collection({
      label: "Posts",
      slugField: "title",
      path: "src/content/collections/posts/*",
      format: { contentField: "content" },
      schema: {
        title: fields.slug({ name: { label: "Title", validation: { isRequired: true } } }),
        publishedDate: fields.date({ label: "Published Date", validation: { isRequired: true } }),
        category: fields.select({
          label: "Category",
          options: POST_CATEGORIES.map((c) => ({
            label: c.charAt(0).toUpperCase() + c.slice(1),
            value: c,
          })) as [{ label: string; value: (typeof POST_CATEGORIES)[number] }, ...{ label: string; value: (typeof POST_CATEGORIES)[number] }[]],
          defaultValue: "news",
        }),
        featuredImage: optionalImage(
          "Featured image (optional)",
          "Pick 'Image' to set a featured image for this post; pick 'None' to skip.",
          fields.object({
            src: fields.image({
              label: "Image",
              directory: "src/assets/images/posts",
              publicPath: "../../../assets/images/posts/",
              validation: { isRequired: true },
            }),
            alt: fields.text({
              label: "Alt text",
              validation: { isRequired: true },
            }),
            caption: fields.text({ label: "Caption" }),
            credit: fields.text({ label: "Credit" }),
          }),
        ),
        excerpt: fields.text({
          label: "Excerpt",
          description:
            "Short summary shown on post cards and in list previews. Max 300 characters.",
          multiline: true,
          validation: { length: { max: 300 } },
        }),
        externalUrl: fields.url({
          label: "External URL (optional)",
          description:
            "If set, post cards link to this URL instead of the internal /news/[slug] page.",
        }),
        status: fields.select({
          label: "Status",
          options: POST_STATUSES.map((s) => ({
            label: s.charAt(0).toUpperCase() + s.slice(1),
            value: s,
          })) as [{ label: string; value: (typeof POST_STATUSES)[number] }, ...{ label: string; value: (typeof POST_STATUSES)[number] }[]],
          defaultValue: "published",
        }),
        content: fields.markdoc({
          label: "Content",
          components: pageContentComponents,
        }),
      },
    }),

    // -----------------------------------------------------------------
    // Store items — one YAML file per sellable item (album, EP, single,
    // merch). Rendered by the `store-items` Markdoc block.
    //
    // Format options, statuses, and related enums are imported from
    // `src/lib/schemas.ts` — the single source of truth. Price is a
    // numeric amount with a separate ISO 4217 currency code (USD
    // default), formatted at render time via Intl.NumberFormat.
    // -----------------------------------------------------------------

    storeItems: collection({
      label: "Store Items",
      slugField: "title",
      path: "src/content/collections/storeItems/*",
      schema: {
        title: fields.slug({
          name: { label: "Item title", validation: { isRequired: true } },
        }),
        format: fields.select({
          label: "Format",
          description:
            "Coarse category. The buy link can point to a page offering " +
            "multiple physical/digital formats — mention that in the " +
            "description if it applies. Drives the colored badge on each card.",
          options: STORE_ITEM_FORMATS.map((f) => ({
            // "ep" → "EP"; others title-case.
            label: f === "ep" ? "EP" : f.charAt(0).toUpperCase() + f.slice(1),
            value: f,
          })) as [
            { label: string; value: (typeof STORE_ITEM_FORMATS)[number] },
            ...{ label: string; value: (typeof STORE_ITEM_FORMATS)[number] }[],
          ],
          defaultValue: "album",
        }),
        price: fields.integer({
          label: "Price (amount)",
          description:
            "Numeric amount in the item's currency — no symbol, no thousands " +
            "separators. Formatted at display time using the currency field.",
          validation: { min: 0 },
        }),
        currency: fields.select({
          label: "Currency (ISO 4217 code)",
          description:
            "Three-letter currency code. Used with `Intl.NumberFormat` to render " +
            "the price with the correct symbol and decimal placement.",
          options: [
            { label: "USD — US Dollar", value: "USD" },
            { label: "EUR — Euro", value: "EUR" },
            { label: "GBP — British Pound", value: "GBP" },
            { label: "CAD — Canadian Dollar", value: "CAD" },
            { label: "AUD — Australian Dollar", value: "AUD" },
            { label: "JPY — Japanese Yen", value: "JPY" },
          ],
          defaultValue: "USD",
        }),
        image: optionalImage(
          "Cover image",
          "Pick 'Image' to attach a cover image; pick 'None' to skip.",
          fields.object({
            src: fields.image({
              label: "Cover image",
              directory: "src/assets/images/store",
              publicPath: "../../../assets/images/store/",
              validation: { isRequired: true },
            }),
            alt: fields.text({
              label: "Alt text",
              validation: { isRequired: true },
            }),
            caption: fields.text({ label: "Caption" }),
            credit: fields.text({ label: "Credit" }),
            usageSlot: usageSlotField(
              ["release-cover", "gallery", "thumbnail"],
              "release-cover",
              "Usage slot",
            ),
          }),
        ),
        description: fields.text({
          label: "Description",
          multiline: true,
          description:
            "Optional short blurb shown under the title. Mention alternate " +
            "formats here (e.g. 'Available on CD, vinyl, and digital').",
        }),
        buyUrl: fields.url({
          label: "Buy URL",
          description:
            "External link (Bandcamp, Shopify, Big Cartel, etc.) — opens in a new tab.",
          validation: { isRequired: true },
        }),
        status: fields.select({
          label: "Status",
          description:
            "Available items appear by default; sold-out items are hidden unless the block's filter is set to 'All'; preorders show a highlighted badge.",
          options: STORE_ITEM_STATUSES.map((s) => ({
            // "sold-out" → "Sold out"; others title-case.
            label: s === "sold-out" ? "Sold out" : s.charAt(0).toUpperCase() + s.slice(1),
            value: s,
          })) as [
            { label: string; value: (typeof STORE_ITEM_STATUSES)[number] },
            ...{ label: string; value: (typeof STORE_ITEM_STATUSES)[number] }[],
          ],
          defaultValue: "available",
        }),
        order: fields.integer({
          label: "Sort order",
          description:
            "Lower numbers appear first. Items without a sort order fall to the end and are sorted alphabetically.",
        }),
      },
    }),
  },
});
