# CLAUDE.md — Instructions for AI Editing

This file guides Claude Code (or any AI agent) when making changes to this musician website.

---

## Schema-First Editing Rules

**These are the most important rules. Read them before making any change.**

### 1. Identify the schema field before touching any file

Before editing anything, answer: **"Which named field in which content file holds this value?"**

- Every editable piece of content has a named field in a Zod schema in `src/lib/schemas.ts`.
- Every schema field maps to a specific file in `src/content/`.
- If you cannot identify the field and file, look it up in the Content Map below before proceeding.

### 2. Content files are the editing surface — not component code

For any content change (bio, headline, CTA text, tour date, release info, photo, quote):

1. Edit the file in `src/content/`. That is the editing surface.
2. Do **not** edit `.astro` or `.tsx` files for content changes. Components render content; they do not define it.
3. After editing a content file, run `npm run validate:content` to confirm the schema is satisfied.

### 3. Preserve schema conventions

- Do not add ad hoc keys to JSON files outside the defined schema.
- Do not remove required fields.
- Do not restructure a collection entry from an object to a string (or vice versa).
- If a new field is needed, add it to the Zod schema in `src/lib/schemas.ts` first, then to the content file.

### 4. Image references must carry metadata

Every image reference in a YAML content file must be an object with at minimum `src` and `alt`:

```yaml
src: ../../../assets/images/your-image.jpg
alt: Descriptive alt text — never leave blank
caption: Optional display caption
credit: Optional photographer credit
usageSlot: gallery
```

Image `src` paths are **relative** from the content file to `src/assets/images/`. This enables Astro's build-time image optimisation (format conversion, hashing, dimensions).

- From `src/content/collections/*/*.yaml`: use `../../../assets/images/filename.ext`
- From `src/content/pages/*.mdoc`: use `../../assets/images/filename.ext`

Do not use absolute `/images/` paths or reference `public/`. Markdoc frontmatter image fields are also relative paths (resolved by Astro's `image()` schema helper).

### 5. Run validate:content after any content change

```bash
npm run validate:content
```

This validates all singletons, all page frontmatter, and all collections against their Zod schemas. Fix any errors before committing.

---

## Enum single-source-of-truth convention

Every string-literal "enum" (release type, button variant, heading level,
etc.) has exactly **one** canonical declaration. Zod schemas, Astro content
collections, Keystatic selects, Markdoc `matches` arrays, and TypeScript
unions all derive from that const — never redeclare the values.

**Where each kind lives:**

- **Data-shape enums** → `src/lib/schemas.ts`. These describe the shape of
  content data (collections, frontmatter, config). Examples: `RELEASE_TYPES`,
  `VIDEO_TYPES`, `TOUR_DATE_STATUSES`, `POST_CATEGORIES`, `POST_STATUSES`,
  `STORE_ITEM_FORMATS`, `STORE_ITEM_STATUSES`, `IMAGE_USAGE_SLOTS`,
  `FONT_CATEGORIES`.
- **UI / attribute enums** → `src/content-components/_shared/types.ts`. These
  are allowed-value sets for a Markdoc tag attribute or Keystatic
  content-component select. Examples: `HEADING_LEVELS`, `BUTTON_VARIANTS`,
  `COLUMNS_LAYOUTS`, `POSTS_LIST_LAYOUTS`,
  `EMBED_ASPECT_RATIOS`, `NEWSLETTER_SERVICES`, `VIDEO_URL_TYPES`.

Labels that differ from values (e.g. `"H1"` vs `"h1"`, `"Sold Out"` vs
`"sold_out"`) live in a sibling `FOO_LABELS: Record<FooValue, string>`
record next to the const so every consumer can render a consistent label.

The duplication-audit doc lives at `docs/enum-duplication-inventory.md` —
it catalogues the cleanup that produced this convention and lists the
intentional divergences (currency codes, social-link keys, etc.) that
stay outside it.

### Rule 1 — Canonical constant pattern

Always `as const` + a derived union. Never a bare `string[]`.

```ts
export const FOO_VALUES = ["a", "b", "c"] as const;
export type FooValue = (typeof FOO_VALUES)[number];
```

### Rule 2 — Markdoc `matches` consumers

Cast to `string[]` at the point of use. The cast is localised to the schema
file so no bare-string-array types leak into the codebase.

```ts
import { FOO_VALUES } from "../_shared/types"; // or "../../lib/schemas"

export const markdoc = {
  attributes: {
    foo: {
      type: String,
      matches: FOO_VALUES as unknown as string[],
    },
  },
};
```

### Rule 3 — Keystatic `fields.select` consumers

```ts
options: FOO_VALUES.map((v) => ({ label: FOO_LABELS[v] ?? v, value: v })) as [
  { label: string; value: FooValue },
  ...{ label: string; value: FooValue }[],
]
```

The cast to a non-empty tuple satisfies Keystatic's select typing (which
wants the literal value union preserved). Where the display label differs
from the value, colocate a sibling `FOO_LABELS: Record<FooValue, string>`
record next to the const and import both.

### Rule 4 — `content.config.ts` (Astro zod v4)

```ts
import { FOO_VALUES } from "./lib/schemas";

z.enum(FOO_VALUES)
```

### Adding a new enum

1. Decide: is this a data-shape enum (add to `src/lib/schemas.ts`) or a UI
   enum (add to `src/content-components/_shared/types.ts`)?
2. Declare the const using Rule 1, plus a sibling labels record if labels
   differ from values.
3. Reference it via Rules 2–4 in every consumer (markdoc, keystatic,
   content.config, Zod schema). Never paste the values a second time.
4. If the new enum is for a content-component attribute, run
   `npm run check:markdoc-config` and `npm test` — the cross-schema
   consistency test asserts Markdoc `matches` and Keystatic `options` stay
   aligned.

---

## Content Map

Use this to find where any piece of content lives.

### Singletons

| What | File | Schema |
|------|------|--------|
| Artist name, site title, description | `src/content/config/site.json` | `siteConfigSchema` |
| Social links (Instagram, Spotify, etc.) | `src/content/config/site.json` → `socialLinks` | `siteConfigSchema` |
| Contact email | `src/content/config/site.json` → `contactEmail` | `siteConfigSchema` |
| Copyright holder name | `src/content/config/site.json` → `copyrightName` | `siteConfigSchema` |
| Navigation order + labels | `src/content/config/nav.json` → `items` | `navConfigSchema` |
| Colors + typography (Google Fonts) | `src/content/config/appearance.json` | `appearanceSchema` |
| Font-size scale, spacing, breakpoints (dev-level) | `src/content/config/theme.json` | `themeSchema` |
| Any page title | `src/content/pages/*.mdoc` | `pageFrontmatterSchema` |
| Homepage hero (fullscreen section, CTA) | `src/content/pages/home.mdoc` body → `{% fullscreen-section %}` + `{% button %}` | — |
| Homepage intro text (below hero) | `src/content/pages/home.mdoc` (body) | — |
| About page image + bio | `src/content/pages/about.mdoc` body → `{% section %}` + `{% columns %}` + `{% content-image %}` | — |
| Music releases grid | `src/content/pages/music.mdoc` body → `{% release-list %}` tag | — |
| Press EPK download link | `src/content/pages/press.mdoc` body → `{% button %}` tag (with EPK file URL) | — |
| Press quotes | `src/content/pages/press.mdoc` body → `{% quote %}` tags (one per quote) | — |
| Photos gallery | `src/content/pages/photos.mdoc` body → `{% photo-gallery %}` tag | — |
| Contact intro text | `src/content/pages/contact.mdoc` (body) | — |
| Contact form | `src/content/pages/contact.mdoc` body → `{% contact-form %}` tag | — |

### Collections

| What | Path | Schema | Format |
|------|------|--------|--------|
| Music releases (albums, singles, EPs) | `src/content/collections/releases/*.yaml` | `releaseSchema` | One YAML file per release |
| Photo gallery | `src/content/collections/photos/*.yaml` | `photoSchema` | One YAML file per photo |
| Videos | `src/content/collections/videos/*.yaml` | `videoSchema` | One YAML file per video |
| Tour dates | `src/content/collections/tourDates/*.yaml` | `tourDateSchema` | One YAML file per date |

### Images

Images live in `src/assets/images/` and are processed by Astro's build pipeline (optimised format, content-hashed URLs, automatic dimensions).

Image references in **YAML content files** use the `imageMetadataSchema` object shape (required: `src`, `alt`). The `src` field is a relative path from the YAML file to `src/assets/images/`.

Image references in **Markdoc tag attributes** (e.g. `{% fullscreen-section image="..." %}`, `{% content-image src="..." %}`) are string paths resolved at render time by the `resolveImage()` utility (`src/lib/resolve-image.ts`), which uses `import.meta.glob` to map filenames to optimised `ImageMetadata` objects.

---

## File Path Conventions

```
src/content/
  config/
    site.json         ← singleton: site identity and social links
    nav.json          ← singleton: navigation menu
    appearance.json   ← singleton: colors + typography (Keystatic "Appearance")
    theme.json        ← singleton: dev-level design tokens
  pages/
    home.mdoc         ← singleton: homepage content
    about.mdoc        ← singleton: about/bio page
    music.mdoc        ← singleton: music page intro
    photos.mdoc       ← singleton: photos page
    press.mdoc        ← singleton: press page content
    contact.mdoc      ← singleton: contact page intro
  collections/
    releases/         ← one .yaml file per release
    photos/           ← one .yaml file per photo
    videos/           ← one .yaml file per video
    tourDates/        ← one .yaml file per date

src/content.config.ts   ← Astro content collection definitions (unified pages collection)
keystatic.config.ts     ← Keystatic CMS config (thin aggregator — singletons, collections, and content components pulled from src/content-components/)
markdoc.config.ts       ← Markdoc custom tag definitions (thin aggregator — pulls from src/content-components/)
src/content-components/ ← One folder per embeddable block. Each folder colocates its Astro renderer, markdoc tag def, keystatic block/wrapper, and optional admin preview
  _shared/              ← shared preview helpers (tokens, useBlobObjectUrl, parseColumnsLayout)
  Section/ FullscreenSection/ Button/ Columns/ Column/ Image/ ReleaseList/ PhotoGallery/ ContactForm/ Quote/ CenteredBlock/
src/lib/
  schemas.ts            ← all Zod schemas (source of schema truth)
  content.ts            ← validated config loaders (getSiteConfig, buildNav, getTheme)
  resolve-image.ts      ← resolveImage() utility for Markdoc tag components
src/pages/
  [...slug].astro       ← catch-all route for ALL pages (home maps to /, others to /slug/)
src/assets/images/      ← optimised images (processed by Astro at build time)
```

Do not place content files outside these locations.

---

## Architecture

- **Framework**: Astro + React + TypeScript (strict mode)
- **Rendering**: Static by default via `@astrojs/netlify` adapter. Pages are prerendered at build time. API routes use `export const prerender = false`.
- **Content**: Astro content collections (`src/content.config.ts`). All pages share a unified `pages` collection with minimal frontmatter (`title` only). All page layout structure lives in the Markdoc body using layout tags (Section, FullscreenSection, Columns, Column) and content tags (ContentImage, Button, EPK links, release grids, photo galleries, contact forms). Collections in YAML, config in JSON. Queried via `getEntry()`/`getCollection()` from `astro:content`.
- **Navigation**: The Navigation singleton (`nav.json`) is the single source of truth for both membership and order. It stores an ordered array of page slugs using Keystatic's relationship field (dropdown picker + drag-to-reorder). At build time, `buildNav()` resolves each slug to a label (from the page's title) and href. Slugs referencing deleted pages are silently dropped.
- **Dynamic pages**: The `[...slug].astro` catch-all renders **all** pages as `<BaseLayout><Content /></BaseLayout>` with no conditional layout logic. Pages are fully self-contained: all layout structure (sections, columns, fullscreen areas) is defined in the `.mdoc` content files using Markdoc tags. The "home" page maps to `/` (slug: undefined).
- **Markdoc tags**: Custom tags are colocated per component under `src/content-components/<Name>/`. Each folder exports a `markdoc` tag def and (for blocks that need an in-editor preview) a `keystatic` block/wrapper, both consumed by thin aggregators `markdoc.config.ts` and `keystatic.config.ts`. **Layout tags**: `{% section %}`, `{% fullscreen-section %}`, `{% columns %}`, `{% column %}`, `{% centered-block %}`. **Content tags**: `{% button %}`, `{% content-image %}`, `{% release-list %}`, `{% quote %}`, `{% photo-gallery %}`, `{% contact-form %}`. Image tags use `resolveImage()` for build-time optimization. Data-fetching tags (release-list, photo-gallery) query their collections internally.
- **CMS**: Keystatic (`keystatic.config.ts`) provides a web-based admin UI at `/keystatic`. Uses `local` storage mode (writes directly to the filesystem). Manages all page singletons, site config, and collections.
- **Styling**: CSS custom properties (design tokens) from `src/styles/global.css` provide defaults. BaseLayout reads `src/content/config/appearance.json` (colors + typography) and injects overrides via an inline `<style>` block in `<head>`, plus a Google Fonts `<link>` that requests only the weights actually in use.
- **Images**: Images in `src/assets/images/`, processed by Astro's asset pipeline at build time (format conversion, content-hashed URLs, automatic dimensions). Referenced via relative paths from content files. Components use Astro's `<Image>` from `astro:assets`.

---

## Design Token System

All visual values (colors, fonts, spacing) must use CSS custom properties. Never use hardcoded hex colors, font sizes, or font weights in component styles.

| Category | Prefix | Example |
|----------|--------|---------|
| Colors | `--color-*` | `var(--color-primary)`, `var(--color-secondary)` |
| Font sizes | `--font-size-*` | `var(--font-size-base)`, `var(--font-size-2xl)` |
| Font weights | `--font-weight-*` | `var(--font-weight-medium)`, `var(--font-weight-bold)` |
| Font families | `--font-*` | `var(--font-heading)`, `var(--font-body)` |
| Layout | `--max-content`, `--max-text`, `--radius` | |
| Breakpoints | `--breakpoint-*` | Reference only — use literal values in `@media` with a comment |

Token values: `src/content/config/appearance.json` (colors + typography, CMS-editable) → injected via `BaseLayout.astro` → consumed by `src/styles/global.css`. Remaining tokens (font-size scale, spacing, breakpoints) live in `src/content/config/theme.json` and are not exposed in the CMS.

### Google Fonts

`src/lib/google-fonts.ts` is the single source of the curated font catalogue (per category) and the URL builder. Both the Keystatic picker (`keystatic.config.ts`) and the runtime request (`BaseLayout.astro` via `appearanceToFontRequests` + `buildGoogleFontsUrl`) consume from it — add a font once, it shows up in both. `buildGoogleFontsUrl` dedupes weights, collapses matching-family split-mode configs into a single request, and skips families with no weights.

### Appearance sidebar (in-page live editor)

`src/components/appearance-sidebar/` is a React drawer that renders on the public site for authenticated editors. It lets them edit colors + typography with live CSS-variable preview and commits `appearance.json` directly to GitHub via the `createCommitOnBranch` GraphQL mutation.

- **Auth**: reads Keystatic's non-httpOnly `keystatic-gh-access-token` cookie. No cookie → only a small "Sign in to edit" link renders (redirects to `/keystatic` for OAuth). No Stagecraft-side token storage.
- **Dual save path** via `saveMode` in `SidebarConfig`:
  - `github-graphql` — prod or dev with `PUBLIC_KEYSTATIC_STORAGE=github`; commits via GitHub GraphQL using the user's cookie.
  - `local-api` — dev with local storage; POSTs to `src/pages/api/stagecraft/appearance.ts` which writes the file to disk. The endpoint 404s in production builds (`import.meta.env.DEV` check), so it can't be reached from a real deploy.
  - `disabled` — prod + local storage (invalid combo, writes would be lost on Netlify's ephemeral filesystem); sidebar hides itself.
- **Branch**: the sidebar exposes a branch selector fetched via GitHub GraphQL. Commits target the selected branch — same branch Keystatic would target if the user were editing in its UI. Users open PRs via Keystatic's own "create PR" flow.
- **`live-preview.ts`**: pure functions that write CSS variables on `:root` and inject/update a Google Fonts `<link>` in `<head>`. No React, fully unit-testable with a stub DOM.
- **`serialize.ts`**: projects the runtime `Appearance` shape back into Keystatic's on-disk `{discriminant, value}` JSON so commits round-trip cleanly. Also builds the commit message by diffing the pre-edit and post-edit states.
- **`github-client.ts`**: thin GitHub GraphQL client covering repo info, branch head lookup, and the commit mutation. `AuthExpiredError` triggers a silent token refresh via Keystatic's `/api/keystatic/github/refresh-token` endpoint.

Setup for production (one-time GitHub App registration + Netlify env vars): see `docs/keystatic-github-setup.md`.

The Appearance schema nests two Keystatic `fields.conditional`s:

- Outer `heading` conditional — discriminant is `"single"` or `"split"`. When `"single"` the heading font picker is hidden entirely; when `"split"` it reveals a full font picker. The Zod schema transforms this into a flat `{ mode, heading }` pair (heading is `null` in single mode).
- Inner `primary` / `heading.value` — each is a category-first font picker (Sans-serif / Serif / Monospace / Display / Handwriting / Custom). Choosing "Custom" reveals a free-text input for any Google Fonts family.

Custom font names get two layers of validation: a format regex in `appearanceSchema` (starts with capital, letters/digits/spaces only), and a network check in `scripts/validate-content.ts` that pings `fonts.googleapis.com/css2` (400 = unknown family → error; network failure → warning, doesn't block).

---

## Component Library

Use these components instead of raw HTML:

### `Button.astro`
Polymorphic button/link with variants.
- Renders `<a>` when `href` is provided, `<button>` otherwise
- Variants: `primary`, `outline`
- Supports `ariaLabel` for icon-only buttons, `isExternal` for `target="_blank"` links

### `FormGroup.astro`
Form field wrapper with label, input/textarea, and required indicator.
- Props: `label`, `name`, `type`, `isTextarea`, `rows`, `isRequired`, `autocomplete`

### `<Image>` from `astro:assets`
Astro's built-in optimised image component. Use in all `.astro` files.
- Accepts `ImageMetadata` objects (from content collections with `image()` schema) or imported images
- Automatically provides `width`, `height`, format conversion, content-hashed URLs
- Use `import { Image } from "astro:assets";`

### `Section.astro` (Markdoc tag: `{% section %}`)
Wrapper tag that creates a `<section>` with optional title and `.container` wrapper.
- Rendered by the `{% section %}` Markdoc wrapper tag
- Props: `title` (optional heading text), `headingLevel` (1-4, default 2), `isTitleHidden` (boolean, visually hides the title while keeping it accessible)
- Child content renders inside a `.container` wrapper
- Use to wrap all standard page content sections

### `FullscreenSection.astro` (Markdoc tag: `{% fullscreen-section %}`)
Full-viewport section with background image and content overlay.
- Rendered by the `{% fullscreen-section %}` Markdoc wrapper tag
- Minimum 100vw x 100vh dimensions
- Props: `image` (string path resolved via `resolveImage()`), `alt` (required)
- Shows a missing-image placeholder when no image is provided
- Child content renders in a centered overlay on top of the background

### `Button.astro` (also Markdoc tag: `{% button %}`)
Polymorphic button/link with variants. Also used directly as a self-closing Markdoc tag.
- In Astro templates: `<Button href="/path">Label</Button>` (label via slot)
- In Markdoc content: `{% button label="Label" href="/path" /%}` (label via prop)
- Props: `label` (for Markdoc), `href`, `variant` (`primary` | `outline`), `isExternal`

### `Columns.astro` (Markdoc tag: `{% columns %}`)
Wrapper tag that creates a CSS grid side-by-side layout.
- Rendered by the `{% columns %}` Markdoc wrapper tag
- Props: `layout` (string pattern like "1-1", "1-2", "2-1" controlling column proportions)
- Collapses to vertical stacking on mobile
- Children should be `{% column %}` tags

### `Column.astro` (Markdoc tag: `{% column %}`)
Wrapper tag for individual columns inside a Columns layout.
- Rendered by the `{% column %}` Markdoc wrapper tag
- Must be used inside `{% columns %}`

### `content-components/Image/Image.astro` (Markdoc tag: `{% content-image %}`)
Self-closing tag that renders an optimised image via `resolveImage()`.
- Rendered by the `{% content-image /%}` Markdoc tag
- Props: `src` (required, string path), `alt` (required)
- Use inside `{% column %}` for image+text layouts

### `ReleaseList.astro` (Markdoc tag: `{% release-list %}`)
Self-closing data-fetching tag that displays all music releases in a grid.
- Fetches the `releases` collection internally — no props needed
- Rendered by the `{% release-list /%}` Markdoc tag

### `Quote.astro` (Markdoc tag: `{% quote %}`)
Self-closing block that renders a featured pull-quote with optional attribution.
- Props: `text` (required, the quote body), `attribution` (optional, rendered as `<cite>` below)
- Centered, larger, italic — the right primitive for press quotes, testimonials, and pull-quotes. Author inline on the page rather than via a collection.

### `content-components/PhotoGallery/PhotoGallery.astro` (Markdoc tag: `{% photo-gallery %}`)
Self-closing data-fetching tag that displays the photo gallery with lightbox.
- Fetches the `photos` collection internally, delegates rendering to `components/PhotoGallery.astro`
- Rendered by the `{% photo-gallery /%}` Markdoc tag

### `ContactForm.astro` (Markdoc tag: `{% contact-form %}`)
Self-closing tag that renders the contact form.
- Self-contained form with honeypot, FormGroup fields, client-side JS submit handler
- Rendered by the `{% contact-form /%}` Markdoc tag

### `Embed.astro` (Markdoc tag: `{% embed %}`)
Plain sanitized iframe — renders an author-pasted embed snippet at its native dimensions.
- Props: `code` (required, raw `<iframe …>` HTML), `title` (optional a11y label)
- Iframe is allowlist-sanitized (see `Embed/extractIframe.ts`); only safe attributes survive
- No aspect-ratio handling, no max-width cap beyond `max-width: 100%`
- Use when you want the embed at its source dimensions; use `{% embed-responsive %}` to scale

### `EmbedResponsive.astro` (Markdoc tag: `{% embed-responsive %}`)
Aspect-ratio-wrapped embed that scales to fill its column.
- Props: `code` (required), `aspectRatio` (default `"auto"` — derived from intrinsic iframe dims), `title`, `maxWidth` (optional cap), `minHeight`
- Shares `extractIframe` + `buildIframeAttrs` with `Embed`; the iframe is positioned absolute inside a `width: 100%; aspect-ratio: <ratio>` wrapper
- `aspectRatio="auto"` falls back to plain rendering when intrinsic dimensions can't be derived (e.g. Spotify's `width="100%"` snippet)
- Named `EmbedResponsive/` (not `ResponsiveEmbed/`) so it sorts adjacent to `Embed/` in the source tree and in the Keystatic insert menu

### `Image.tsx` (React)
Image component with loading/error state handling and fade-in effect.
- Props: `src` (string URL), `alt`, `className`, `loading`, `aspectRatio`, `objectFit`
- Shows placeholder during load, fallback on error
- Used only inside `Lightbox.tsx` where dynamic image loading state is needed
- Cannot use Astro's `<Image>` in React — this component handles client-side image state

### `PhotoGallery.astro`
Photo grid with lightbox support.
- Props: `photos` (array of `{ src: ImageMetadata, alt, caption? }`)
- Renders a static thumbnail grid using Astro's `<Image>` (zero hydration cost)
- Passes resolved string URLs to `Lightbox` (React island, `client:only="react"`)
- Communicates with Lightbox via `open-lightbox` custom event

### When to use each
- Use `Button` for all clickable actions (links, submit buttons, icon buttons)
- Use `FormGroup` for all form fields instead of raw `<input>`/`<label>`
- Use `<Image>` from `astro:assets` in `.astro` components for all images
- Use layout Markdoc tags (`{% section %}`, `{% fullscreen-section %}`, `{% columns %}`, `{% column %}`) to structure page layout in `.mdoc` content files
- Use content Markdoc tags (`{% button %}`, `{% content-image %}`, `{% release-list %}`, `{% quote %}`, `{% photo-gallery %}`, `{% contact-form %}`) for page-specific content blocks
- Use `Image.tsx` only inside React components that need loading/error state (Lightbox)

### Styling in React components
Use CSS modules (`.module.css`). No CSS-in-JS.

### Boolean prop naming
All boolean props must start with `is`, `are`, `has` (e.g. `isExternal`, `isRequired`, `isTextarea`).

### Breakpoints in @media queries
CSS custom properties cannot be used in `@media` queries. Use literal pixel values with a comment:
```css
/* --breakpoint-md (768px) */
@media (max-width: 768px) { ... }
```

---

## Utility Classes

- `.screenreader-only` — visually hidden, accessible to screen readers
- `.container` — centered max-width wrapper
- `.prose` — text content with comfortable line height
- `.section` / `.section-alt` — vertical section spacing
- `.grid`, `.grid-2`, `.grid-3` — responsive grid layouts

---

## Adding a New Page

1. Create a Markdoc file (`.mdoc`) in `src/content/pages/` with required frontmatter: `title`.
2. The `[...slug].astro` catch-all renders it automatically as `<BaseLayout><Content /></BaseLayout>`.
3. Wrap all page content in `{% section title="Page Title" %}` (or `{% fullscreen-section %}` for hero-style pages). Pages are fully self-contained -- all layout structure lives in the `.mdoc` body.
4. Use layout tags (`{% section %}`, `{% fullscreen-section %}`, `{% columns %}`, `{% column %}`) to structure the page and content tags (`{% button %}`, `{% content-image %}`, `{% release-list %}`, `{% quote %}`, `{% photo-gallery %}`, `{% contact-form %}`) for content blocks.
5. To show the page in the nav, add it to the Navigation singleton in Keystatic (or add its slug to `nav.json` → `items` array).

---

## Adding a New Collection Type

1. Define the item schema in `src/lib/schemas.ts`.
2. Create the collection directory under `src/content/collections/{name}/`.
3. Add a content collection definition in `src/content.config.ts`.
4. Add a Keystatic collection definition in `keystatic.config.ts`.
5. Add validation for the collection to `scripts/validate-content.ts`.
6. Add sample YAML data files (one file per entry). Quote date strings in YAML to prevent auto-parsing (e.g. `date: "2026-05-15"`).

---

## Seed Example Conventions

Every seed example in `src/content/collections/<name>/` must populate every
required field with either a real value or a sensible placeholder. The
purpose: when an author clones this template and opens the admin for the
first time, they see concrete, valid examples — they don't discover required
fields through build errors.

Rules:

1. **Every required schema field is present in every seed file.** Optional
   fields can be omitted; required fields never are.
2. **Prefer empty strings over absent keys** for optional fields you want to
   surface in the Keystatic UI as an obvious "fill this in" slot (common for
   `ticketUrl`, `url`, `credit`).
3. **When adding a new required field to a collection's schema, update the
   seed example in the same commit.** Otherwise `npm run validate:content`
   fails for anyone who pulls the change.
4. **Status-like enums must always be set explicitly.** Don't rely on
   defaults; write the value out (e.g. `status: upcoming` on a tour date)
   so readers of the seed see the shape.

`npm run validate:content` enforces this loosely — it runs on every build
and CI job and fails the moment a required field is missing from any seed
or authored file.

---

## Enum DRYness Convention

String-literal unions and enum option arrays are defined **exactly once** in
the template. Every other site of use imports and derives from that
canonical definition. Duplicated enum values drift silently; a single source
of truth prevents that.

### Where enums live

- **Data-shape enums** — values persisted in content files, validated by
  Zod. Live in `src/lib/schemas.ts` as a `const` array + derived `z.enum(...)` + type alias.
  Examples: `RELEASE_TYPES`, `VIDEO_TYPES`, `TOUR_DATE_STATUSES`,
  `IMAGE_USAGE_SLOTS`, `POST_CATEGORIES`, `STORE_ITEM_FORMATS`,
  `STORE_ITEM_STATUSES`.

- **Content-component attribute enums** — values that only appear in
  markdoc block attributes + keystatic select options, never in collection
  data. Live in `src/content-components/_shared/types.ts` as a `const`
  array + derived type.
  Examples: `HEADING_LEVELS`, `BUTTON_VARIANTS`, `COLUMNS_LAYOUTS`,
  `EMBED_ASPECT_RATIOS`, `NEWSLETTER_SERVICES`, `VIDEO_URL_TYPES`.

When unsure whether an enum is data-shape or attribute, default to
`schemas.ts` — the more conservative choice.

### The pattern

Define the canonical constant once:

```ts
export const HEADING_LEVELS = ["h1", "h2", "h3", "h4"] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];

// Optional: a sibling labels record when display labels differ from values.
export const HEADING_LEVEL_LABELS: Record<HeadingLevel, string> = {
  h1: "H1", h2: "H2", h3: "H3", h4: "H4",
};
```

Consumers import and derive:

```ts
// Markdoc schema (`matches` array):
import { HEADING_LEVELS } from "../_shared/types";
matches: HEADING_LEVELS as unknown as string[]

// Keystatic select (`options` array):
import { HEADING_LEVELS, HEADING_LEVEL_LABELS } from "../_shared/types";
options: HEADING_LEVELS.map((v) => ({ label: HEADING_LEVEL_LABELS[v], value: v }))

// Astro content config (`content.config.ts`, zod v4):
import { HEADING_LEVELS } from "./lib/schemas";  // or _shared/types path
z.enum(HEADING_LEVELS)
```

### Rules

1. **Never inline a string-literal array in more than one place.** If you
   find yourself typing the same `["a", "b", "c"]` in a second file, import
   from the canonical source instead.
2. **Keystatic `fields.select` options must be derived via `.map()`** from
   the canonical constant. Never hand-roll the `[{ label, value }]` array
   with literal strings.
3. **Markdoc `matches` arrays must reference the constant** with the
   `as unknown as string[]` cast (Markdoc's type requires a plain
   `string[]`).
4. **`content.config.ts` `z.enum(...)` calls must receive the constant**,
   not an inline array literal.
5. **Sibling `_LABELS` records live next to the constant** when display
   labels differ from values (e.g. "Primary" button label for a `primary`
   value). Keeps presentation metadata DRY too.

### Intentional divergences (documented — don't treat as violations)

- **Currency codes** on `storeItems` — zod schema is permissive
  (`z.string().length(3)`); Keystatic shows a curated select of common
  codes. The zod layer allows any valid ISO 4217 code authored directly in
  yaml; Keystatic curates to reduce admin typos. These are intentionally
  distinct surfaces.
- **Social-link keys** — a record shape, not an enum.
- **`parseColumnsLayout` regex** — deliberately permissive (accepts any
  `N-M` or `N-M-K` layout string), not enumerated.

---

## PR Screenshots Convention

When opening or revising a pull request, include screenshots of the main
details of your changes in the PR description. Examples of what to capture:

- **Artist site renders** — the page where a new content component shows
  up, or the before/after for a theme/layout change.
- **Keystatic editor views** — the admin UI for a new collection, block,
  or singleton field; the "insert block" menu if a new block appears there.
- **CLI / terminal output** for tooling changes (new scripts, validation
  errors, etc.).

The goal: reviewers understand what changed visually in seconds, without
having to pull the branch and run the dev server.

### How to include screenshots

**Preferred:** upload images directly to the PR description via GitHub's
web UI (drag-and-drop). GitHub stores them on its image CDN
(`user-images.githubusercontent.com/...`), so the images live outside the
repo and the URLs persist independently.

**Alternative when automating:** commit the screenshots to the PR branch,
reference them from the PR body via relative paths, and **delete them in a
follow-up commit** once the PR description's uploaded versions have been
verified to render. Screenshots should not accumulate in the repo
long-term.

When committing screenshots to a branch temporarily, place them under
`templates/musician-site/docs/screenshots/pr-<N>/` with descriptive names:

- `site-<page>.png` for rendered-site views
- `admin-<collection-or-page>.png` for Keystatic admin views
- Keep each file under 500 KB (use JPEG for photos, PNG for admin UI)

The `docs/screenshots/` directory is expected to be empty or near-empty in
main at any given time — it's a staging area, not a permanent archive.

### When screenshots don't apply

For pure refactors, type-system changes, build-tooling changes with no
visible UI delta, or backend-only changes: **document explicitly in the PR
body** that no screenshots apply and why. Don't force synthetic screenshots
for changes that have nothing to show.

---

## API Routes

### `POST /api/contact`
Sends contact form email via Resend. Requires `RESEND_API_KEY` env var.
- Validates required fields, applies honeypot spam prevention, IP rate limiting (3 req/min)
- Sends to `contactEmail` from `site.json`
- `from` uses Resend's sandbox domain by default. Update once a custom domain is verified.

---

## Constraints

- Prefer `.astro` components over React unless stateful interactivity is needed.
- Use the generic component library (Button, FormGroup, Image) instead of raw HTML.
- Keep diffs small and focused.
- Do not introduce new dependencies without justification.
- Do not refactor code unrelated to the requested change.
- Maintain accessibility (semantic HTML, alt text, keyboard navigation, color contrast).
- Pages are prerendered by default. Only add `export const prerender = false` for API endpoints.

---

## Validation Commands

```bash
npm run validate:content  # Validate all content files against Zod schemas
npm run typecheck         # TypeScript check
npm run build             # Full production build
npm run test              # Unit tests (vitest)
npm run test:smoke        # Playwright smoke tests (requires build first)
npm run validate          # Run all checks: content + lint + typecheck + build
```

---

## PR screenshots convention

Every pull request that changes rendered UI — public site, Keystatic
admin, or both — must include screenshots in the PR body. Reviewers
shouldn't need to check out the branch and boot the dev server to see
what changed.

**Full workflow + copy-pastable commands: `docs/screenshots/README.md`.**

### Rules

1. **Host on a public gist, not in-tree.** This repo is private, so
   `raw.githubusercontent.com` URLs 404 for unauthenticated viewers
   and images committed in-tree don't render in the PR body. Upload
   the screenshots to a public gist and embed `gist.githubusercontent.com`
   URLs instead.
2. **Two views per change**: one `site-*` view showing the rendered
   public page, one `admin-*` view showing the Keystatic admin
   surface. If a change only affects one surface (e.g. admin-only
   schema tweak), one view is fine — document why in the PR body.
3. **Naming**:
   - `site-<page-name>.jpg` for public site views (JPEG).
   - `admin-<collection-or-page>.png` for Keystatic admin views (PNG).
4. **Size budget**: aim for < 500 KB per image.
5. **Refactor-only PRs** (no visible UI change at all) can omit
   screenshots. Document that in the PR body: _"No screenshots — pure
   refactor, no visible UI change."_ If the refactor touches a
   Keystatic admin surface (e.g. derived `fields.select` options),
   still capture the admin view to show options render correctly.

### Capturing + uploading

Capture to a local temp dir, then upload to a public gist:

```bash
# 1) Capture (with dev server running in another terminal)
node scripts/capture-pr-screenshots.mjs http://localhost:4321 \
     /tmp/pr-<N>-screenshots

# 2) Seed a public gist
echo "stagecraft PR #<N> screenshots" > /tmp/pr-<N>-readme.md
gh gist create --public --desc "stagecraft PR #<N> screenshots" \
  /tmp/pr-<N>-readme.md
# → https://gist.github.com/<user>/<GIST_ID>

# 3) Clone, copy images in, push with token (gist's default clone
#    URL can't auth from CLI)
git clone https://gist.github.com/<GIST_ID>.git /tmp/pr-<N>-gist
cp /tmp/pr-<N>-screenshots/*.{png,jpg} /tmp/pr-<N>-gist/
cd /tmp/pr-<N>-gist
git add -A && git commit -m "Add PR #<N> screenshots"
git remote set-url origin \
  "https://<user>:$(gh auth token)@gist.github.com/<GIST_ID>.git"
git push
```

### Embed in the PR body

```markdown
## Screenshots

### Site
![Press page](https://gist.githubusercontent.com/<user>/<GIST_ID>/raw/site-press.jpg)

### Admin
![Keystatic press editor](https://gist.githubusercontent.com/<user>/<GIST_ID>/raw/admin-pages.png)
```

Verify each URL returns `HTTP 200` anonymously before submitting:

```bash
curl -sI "https://gist.githubusercontent.com/<user>/<GIST_ID>/raw/site-press.jpg" | head -1
```

If Keystatic admin requires auth in your setup and the script can't
reach it headlessly, capture those frames manually from a signed-in
browser and drop them into the same `/tmp/pr-<N>-screenshots/` dir
before uploading.
