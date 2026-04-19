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

## Content Map

Use this to find where any piece of content lives.

### Singletons

| What | File | Schema |
|------|------|--------|
| Artist name, site title, description | `src/content/config/site.json` | `siteConfigSchema` |
| Social links (Instagram, Spotify, etc.) | `src/content/config/site.json` → `socialLinks` | `siteConfigSchema` |
| Contact email | `src/content/config/site.json` → `contactEmail` | `siteConfigSchema` |
| Copyright line | `src/content/config/site.json` → `copyright` | `siteConfigSchema` |
| Navigation order + labels | `src/content/config/nav.json` → `items` | `navConfigSchema` |
| Colors + typography (Google Fonts) | `src/content/config/appearance.json` | `appearanceSchema` |
| Font-size scale, spacing, breakpoints (dev-level) | `src/content/config/theme.json` | `themeSchema` |
| Any page title | `src/content/pages/*.mdoc` | `pageFrontmatterSchema` |
| Homepage hero (fullscreen section, CTA) | `src/content/pages/home.mdoc` body → `{% fullscreen-section %}` + `{% button %}` | — |
| Homepage intro text (below hero) | `src/content/pages/home.mdoc` (body) | — |
| About page image + bio | `src/content/pages/about.mdoc` body → `{% section %}` + `{% columns %}` + `{% content-image %}` | — |
| Music releases grid | `src/content/pages/music.mdoc` body → `{% release-list %}` tag | — |
| Press EPK download link | `src/content/pages/press.mdoc` body → `{% button %}` tag (with EPK file URL) | — |
| Press quotes list | `src/content/pages/press.mdoc` body → `{% press-quotes %}` tag | — |
| Photos gallery | `src/content/pages/photos.mdoc` body → `{% photo-gallery %}` tag | — |
| Contact intro text | `src/content/pages/contact.mdoc` (body) | — |
| Contact form | `src/content/pages/contact.mdoc` body → `{% contact-form %}` tag | — |

### Collections

| What | Path | Schema | Format |
|------|------|--------|--------|
| Music releases (albums, singles, EPs) | `src/content/collections/releases/*.yaml` | `releaseSchema` | One YAML file per release |
| Photo gallery | `src/content/collections/photos/*.yaml` | `photoSchema` | One YAML file per photo |
| Videos | `src/content/collections/videos/*.yaml` | `videoSchema` | One YAML file per video |
| Press quotes | `src/content/collections/pressQuotes/*.yaml` | `pressQuoteSchema` | One YAML file per quote |
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
    pressQuotes/      ← one .yaml file per quote
    tourDates/        ← one .yaml file per date

src/content.config.ts   ← Astro content collection definitions (unified pages collection)
keystatic.config.ts     ← Keystatic CMS config (thin aggregator — singletons, collections, and content components pulled from src/content-components/)
markdoc.config.ts       ← Markdoc custom tag definitions (thin aggregator — pulls from src/content-components/)
src/content-components/ ← One folder per embeddable block. Each folder colocates its Astro renderer, markdoc tag def, keystatic block/wrapper, and optional admin preview
  _shared/              ← shared preview helpers (tokens, useBlobObjectUrl, parseColumnsLayout)
  Section/ FullscreenSection/ Button/ Columns/ Column/ Image/ ReleaseList/ PressQuotes/ PhotoGallery/ ContactForm/
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
- **Markdoc tags**: Custom tags are colocated per component under `src/content-components/<Name>/`. Each folder exports a `markdoc` tag def and (for blocks that need an in-editor preview) a `keystatic` block/wrapper, both consumed by thin aggregators `markdoc.config.ts` and `keystatic.config.ts`. **Layout tags**: `{% section %}`, `{% fullscreen-section %}`, `{% columns %}`, `{% column %}`. **Content tags**: `{% button %}`, `{% content-image %}`, `{% release-list %}`, `{% press-quotes %}`, `{% photo-gallery %}`, `{% contact-form %}`. Image tags use `resolveImage()` for build-time optimization. Data-fetching tags (release-list, press-quotes, photo-gallery) query their collections internally.
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

### `PressQuotes.astro` (Markdoc tag: `{% press-quotes %}`)
Self-closing data-fetching tag that displays all press quotes.
- Fetches the `pressQuotes` collection internally — no props needed
- Rendered by the `{% press-quotes /%}` Markdoc tag

### `content-components/PhotoGallery/PhotoGallery.astro` (Markdoc tag: `{% photo-gallery %}`)
Self-closing data-fetching tag that displays the photo gallery with lightbox.
- Fetches the `photos` collection internally, delegates rendering to `components/PhotoGallery.astro`
- Rendered by the `{% photo-gallery /%}` Markdoc tag

### `ContactForm.astro` (Markdoc tag: `{% contact-form %}`)
Self-closing tag that renders the contact form.
- Self-contained form with honeypot, FormGroup fields, client-side JS submit handler
- Rendered by the `{% contact-form /%}` Markdoc tag

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
- Use content Markdoc tags (`{% button %}`, `{% content-image %}`, `{% release-list %}`, `{% press-quotes %}`, `{% photo-gallery %}`, `{% contact-form %}`) for page-specific content blocks
- Use `Image.tsx` only inside React components that need loading/error state (Lightbox)

### Styling in React components
Use CSS modules (`.module.css`). No CSS-in-JS.

### Boolean prop naming
All boolean props must start with `is` or `has` (e.g. `isExternal`, `isRequired`, `isTextarea`).

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
4. Use layout tags (`{% section %}`, `{% fullscreen-section %}`, `{% columns %}`, `{% column %}`) to structure the page and content tags (`{% button %}`, `{% content-image %}`, `{% release-list %}`, `{% press-quotes %}`, `{% photo-gallery %}`, `{% contact-form %}`) for content blocks.
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
