import { config, fields, collection, singleton } from "@keystatic/core";
import { GOOGLE_FONTS, FONT_WEIGHTS } from "./src/lib/google-fonts";
import { pageContentComponents } from "./src/lib/keystatic-blocks";
import {
  POST_CATEGORIES,
  POST_STATUSES,
  STORE_ITEM_FORMATS,
  STORE_ITEM_STATUSES,
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

const CATEGORY_OPTIONS = [
  { label: "Sans-serif", value: "sans-serif" },
  { label: "Serif", value: "serif" },
  { label: "Monospace", value: "monospace" },
  { label: "Display", value: "display" },
  { label: "Handwriting", value: "handwriting" },
  { label: "Custom (any Google Font)", value: "custom" },
] as const;

type FontCategoryValue = (typeof CATEGORY_OPTIONS)[number]["value"];

const CATEGORY_DEFAULTS: Record<Exclude<FontCategoryValue, "custom">, string> = {
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
const fontPicker = (label: string, defaults: { category: FontCategoryValue; family: string }) =>
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
        // Optional brand wordmark image. When set, the Header renders this
        // image in place of the artist-name text. All other uses of
        // artistName (document <title>, meta tags, footer) are unaffected —
        // the wordmark only replaces the visible brand mark in the header.
        //
        // Directory is `src/assets/images/` (top-level, not a collection
        // subfolder) because the wordmark is a site-wide brand asset rather
        // than content belonging to a single release/photo/etc. publicPath
        // walks back two levels from site.json's location
        // (src/content/config/) to reach src/assets/images/.
        wordmark: fields.object(
          {
            src: fields.image({
              label: "Wordmark Image",
              directory: "src/assets/images",
              publicPath: "../../assets/images/",
            }),
            alt: fields.text({
              label: "Alt Text",
              description:
                "Describes the wordmark for screen readers. Usually just the artist name.",
            }),
          },
          {
            label: "Wordmark",
            description:
              "Optional brand wordmark image shown in the header instead of the artist name text. PNG / SVG / JPG; transparency supported. Leave Image blank to use the artist-name text.",
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
        copyright: fields.text({ label: "Copyright Line" }),
      },
    }),

    // -----------------------------------------------------------------
    // Navigation — owns both membership and order.
    // An ordered array of page references (relationship field).
    // Add a page here to show it in the nav; remove it to hide it.
    // Drag to reorder.
    // -----------------------------------------------------------------

    navigation: singleton({
      label: "Navigation",
      path: "src/content/config/nav",
      format: { data: "json" },
      schema: {
        items: fields.array(
          fields.relationship({ label: "Page", collection: "pages" }),
          {
            label: "Navigation Items",
            itemLabel: (props) => props.value ?? "Select a page",
          },
        ),
      },
    }),

    // -----------------------------------------------------------------
    // Appearance — colors and typography (Google Fonts).
    //
    // Typography picker is category-first: choose Sans-serif/Serif/
    // Monospace/Display/Handwriting to get a curated list, or choose
    // "Custom" to type any family name from fonts.google.com.
    //
    // By default the same font is used site-wide. Switching "Font
    // Strategy" to "Separate heading + body" activates the Heading
    // font picker.
    //
    // Weight pickers exist per heading level and for body/body-bold,
    // so the Google Fonts URL emitted at runtime requests ONLY the
    // weights actually in use (keeps page weight small).
    // -----------------------------------------------------------------

    appearance: singleton({
      label: "Appearance",
      path: "src/content/config/appearance",
      format: { data: "json" },
      schema: {
        colors: fields.object(
          {
            primary: fields.text({ label: "Primary (headings, logo)", defaultValue: "#1a1a2e" }),
            secondary: fields.text({ label: "Secondary (CTAs, accents)", defaultValue: "#e94560" }),
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
            border: fields.text({ label: "Borders & dividers", defaultValue: "#e5e7eb" }),
          },
          {
            label: "Colors",
            description:
              "Hex ('#1a1a2e') or rgb()/rgba() values. Keystatic doesn't render a color swatch inline — preview on the site after saving. Tip: use a tool like coolors.co or Google Material colors to build a palette, then paste the values here.",
          },
        ),
        typography: fields.object(
          {
            primary: fontPicker("Body font", {
              category: "sans-serif",
              family: "Inter",
            }),
            // `mode` is the discriminant: "single" hides the heading picker
            // entirely; "split" reveals it (Keystatic conditional UX). This
            // replaces the older parallel `mode` + `heading` fields.
            heading: fields.conditional(
              fields.select({
                label: "Headings",
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
            weights: fields.object(
              {
                body: weightField("Body", 400),
                bodyBold: weightField("Body bold", 700),
                h1: weightField("H1", 700),
                h2: weightField("H2", 700),
                h3: weightField("H3", 700),
                h4: weightField("H4", 700),
                h5: weightField("H5", 600),
                h6: weightField("H6", 600),
              },
              {
                label: "Font weights",
                description:
                  "Only the weights you pick here are downloaded — unused weights aren't requested. Some fonts don't ship every weight; check fonts.google.com if a weight looks wrong.",
              },
            ),
          },
          {
            label: "Typography",
            description:
              "Pick fonts and weights. Google Fonts are loaded with only the exact weights in use.",
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
          options: [
            { label: "Album", value: "album" },
            { label: "Single", value: "single" },
            { label: "EP", value: "ep" },
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
            usageSlot: fields.select({
              label: "Usage Slot",
              options: [
                { label: "Release Cover", value: "release-cover" },
                { label: "Hero", value: "hero" },
                { label: "Gallery", value: "gallery" },
                { label: "Thumbnail", value: "thumbnail" },
              ],
              defaultValue: "release-cover",
            }),
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
        usageSlot: fields.select({
          label: "Usage Slot",
          options: [
            { label: "Gallery", value: "gallery" },
            { label: "Hero", value: "hero" },
            { label: "About", value: "about" },
            { label: "Press", value: "press" },
            { label: "Background", value: "background" },
            { label: "Thumbnail", value: "thumbnail" },
          ],
          defaultValue: "gallery",
        }),
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
          options: [
            { label: "YouTube", value: "youtube" },
            { label: "Vimeo", value: "vimeo" },
            { label: "Other", value: "other" },
          ],
          defaultValue: "youtube",
        }),
        description: fields.text({ label: "Description", multiline: true }),
      },
    }),

    // -----------------------------------------------------------------
    // Press quotes — one YAML file per quote
    // -----------------------------------------------------------------

    pressQuotes: collection({
      label: "Press Quotes",
      slugField: "source",
      path: "src/content/collections/pressQuotes/*",
      schema: {
        quote: fields.text({ label: "Quote", multiline: true, validation: { isRequired: true } }),
        source: fields.slug({ name: { label: "Source", validation: { isRequired: true } } }),
        url: fields.text({ label: "URL" }),
        date: fields.date({ label: "Date" }),
      },
    }),

    // -----------------------------------------------------------------
    // Tour dates — one YAML file per date
    // -----------------------------------------------------------------

    tourDates: collection({
      label: "Tour Dates",
      slugField: "venue",
      path: "src/content/collections/tourDates/*",
      schema: {
        date: fields.date({ label: "Date", validation: { isRequired: true } }),
        venue: fields.slug({ name: { label: "Venue", validation: { isRequired: true } } }),
        city: fields.text({ label: "City", validation: { isRequired: true } }),
        ticketUrl: fields.url({ label: "Ticket URL" }),
        status: fields.select({
          label: "Status",
          options: [
            { label: "Upcoming", value: "upcoming" },
            { label: "Sold Out", value: "sold_out" },
            { label: "Canceled", value: "canceled" },
            { label: "Past", value: "past" },
          ],
          defaultValue: "upcoming",
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
        featuredImage: fields.object(
          {
            src: fields.image({
              label: "Image",
              directory: "src/assets/images/posts",
              publicPath: "../../../assets/images/posts/",
            }),
            alt: fields.text({ label: "Alt text" }),
            caption: fields.text({ label: "Caption" }),
            credit: fields.text({ label: "Credit" }),
          },
          { label: "Featured image (optional)" },
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
        image: fields.object(
          {
            src: fields.image({
              label: "Cover image",
              directory: "src/assets/images/store",
              publicPath: "../../../assets/images/store/",
            }),
            alt: fields.text({ label: "Alt text" }),
            caption: fields.text({ label: "Caption" }),
            credit: fields.text({ label: "Credit" }),
            usageSlot: fields.select({
              label: "Usage slot",
              options: [
                { label: "Release cover", value: "release-cover" },
                { label: "Gallery", value: "gallery" },
                { label: "Thumbnail", value: "thumbnail" },
              ],
              defaultValue: "release-cover",
            }),
          },
          { label: "Cover image" },
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
