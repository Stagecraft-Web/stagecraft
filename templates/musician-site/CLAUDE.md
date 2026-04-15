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
| Colors, fonts, spacing, breakpoints | `src/content/config/theme.json` | `themeSchema` |
| Any page title + headline | `src/content/pages/*.mdoc` | `pageFrontmatterSchema` |
| Homepage hero (headline, CTA, image) | `src/content/pages/home.mdoc` body → `{% hero %}` tag | — |
| Homepage intro text (below hero) | `src/content/pages/home.mdoc` (body) | — |
| About page image + bio | `src/content/pages/about.mdoc` body → `{% page-image %}` wrapper | — |
| Music releases grid | `src/content/pages/music.mdoc` body → `{% release-list %}` tag | — |
| Press EPK download link | `src/content/pages/press.mdoc` body → `{% epk-download %}` tag | — |
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

Image references in **Markdoc tag attributes** (e.g. `{% hero image="..." %}`, `{% page-image src="..." %}`) are string paths resolved at render time by the `resolveImage()` utility (`src/lib/resolve-image.ts`), which uses `import.meta.glob` to map filenames to optimised `ImageMetadata` objects.

---

## File Path Conventions

```
src/content/
  config/
    site.json         ← singleton: site identity and social links
    nav.json          ← singleton: navigation menu
    theme.json        ← singleton: design tokens
  pages/
    home.mdoc         ← singleton: homepage content
    about.mdoc        ← singleton: about/bio page
    music.mdoc        ← singleton: music page intro
    photos.mdoc       ← singleton: photos page headline
    press.mdoc        ← singleton: press page content
    contact.mdoc      ← singleton: contact page intro
  collections/
    releases/         ← one .yaml file per release
    photos/           ← one .yaml file per photo
    videos/           ← one .yaml file per video
    pressQuotes/      ← one .yaml file per quote
    tourDates/        ← one .yaml file per date

src/content.config.ts   ← Astro content collection definitions (unified pages collection)
keystatic.config.ts     ← Keystatic CMS config (singletons, collections, content components)
markdoc.config.mjs      ← Markdoc custom tag definitions (hero, page-image, epk-download, release-list, press-quotes, photo-gallery, contact-form)
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
- **Content**: Astro content collections (`src/content.config.ts`). All pages share a unified `pages` collection with minimal frontmatter (title + optional headline). Page-specific structured content (hero, images, EPK links, release grids, photo galleries, contact forms) uses custom Markdoc tags in the body. Collections in YAML, config in JSON. Queried via `getEntry()`/`getCollection()` from `astro:content`.
- **Navigation**: The Navigation singleton (`nav.json`) is the single source of truth for both membership and order. It stores an ordered array of page slugs using Keystatic's relationship field (dropdown picker + drag-to-reorder). At build time, `buildNav()` resolves each slug to a label (from the page's title) and href. Slugs referencing deleted pages are silently dropped.
- **Dynamic pages**: The `[...slug].astro` catch-all renders **all** pages. Pages with a `headline` get the PageHeader + section/container layout; pages without (e.g. home) get bare `<Content />` for full-width layouts. The "home" page maps to `/` (slug: undefined). All page-specific rendering (release grid, press quotes, photo gallery, contact form) uses Markdoc content component tags insertable from any page.
- **Markdoc tags**: Custom tags defined in `markdoc.config.mjs` map to Astro components. Tags: `{% hero %}` (Hero.astro), `{% page-image %}` (PageImage.astro), `{% epk-download %}` (EpkDownload.astro), `{% release-list %}` (ReleaseList.astro), `{% press-quotes %}` (PressQuotes.astro), `{% photo-gallery %}` (PhotoGalleryBlock.astro), `{% contact-form %}` (ContactForm.astro). Image tags use `resolveImage()` for build-time optimization. Data-fetching tags (release-list, press-quotes, photo-gallery) query their collections internally.
- **CMS**: Keystatic (`keystatic.config.ts`) provides a web-based admin UI at `/keystatic`. Uses `local` storage mode (writes directly to the filesystem). Manages all page singletons, site config, and collections.
- **Styling**: CSS custom properties (design tokens) from `src/styles/global.css`. Token values come from `src/content/config/theme.json`.
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

Token values: `src/content/config/theme.json` → `src/styles/global.css`

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

### `Hero.astro` (Markdoc tag: `{% hero %}`)
Full-width hero section with headline, subheadline, CTA button, and optional image.
- Rendered by the `{% hero %}` Markdoc tag — do not instantiate directly
- Uses `resolveImage()` to convert string image paths to optimised `ImageMetadata`
- Self-contained styling (full-width background, centered text)

### `PageImage.astro` (Markdoc tag: `{% page-image %}`)
Image + text wrapper layout (e.g. about page).
- Rendered by the `{% page-image %}` Markdoc wrapper tag
- Props: `src`, `alt` (required), `position` ("left" or "right")
- Child content renders in a `.prose` wrapper beside the image
- Uses `resolveImage()` for optimised images

### `EpkDownload.astro` (Markdoc tag: `{% epk-download %}`)
Download button for EPK files.
- Rendered by the `{% epk-download %}` Markdoc tag
- Props: `path` (required), `label` (default: "Download EPK")

### `ReleaseList.astro` (Markdoc tag: `{% release-list %}`)
Self-closing data-fetching tag that displays all music releases in a grid.
- Fetches the `releases` collection internally — no props needed
- Rendered by the `{% release-list /%}` Markdoc tag

### `PressQuotes.astro` (Markdoc tag: `{% press-quotes %}`)
Self-closing data-fetching tag that displays all press quotes.
- Fetches the `pressQuotes` collection internally — no props needed
- Rendered by the `{% press-quotes /%}` Markdoc tag

### `PhotoGalleryBlock.astro` (Markdoc tag: `{% photo-gallery %}`)
Self-closing data-fetching tag that displays the photo gallery with lightbox.
- Fetches the `photos` collection internally, delegates rendering to `PhotoGallery.astro`
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
- Use Markdoc tags (`{% hero %}`, `{% page-image %}`, `{% epk-download %}`, `{% release-list %}`, `{% press-quotes %}`, `{% photo-gallery %}`, `{% contact-form %}`) in `.mdoc` content files for page-specific structured sections
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

1. Create a Markdoc file (`.mdoc`) in `src/content/pages/` with required frontmatter: `title`. Add optional `headline` for pages that need a PageHeader.
2. The `[...slug].astro` catch-all renders it automatically. Pages with `headline` get PageHeader + section/container; pages without get bare `<Content />` (full-width).
3. Use Markdoc content component tags in the body for structured sections: `{% hero %}`, `{% page-image %}`, `{% release-list %}`, `{% press-quotes %}`, `{% photo-gallery %}`, `{% contact-form %}`, `{% epk-download %}`.
4. To show the page in the nav, add it to the Navigation singleton in Keystatic (or add its slug to `nav.json` → `items` array).

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
