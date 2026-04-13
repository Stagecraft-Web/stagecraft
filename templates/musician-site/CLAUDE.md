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

Every image reference in a JSON content file must be an object with at minimum `src` and `alt`:

```json
{
  "src": "/images/your-image.jpg",
  "alt": "Descriptive alt text — never leave blank",
  "caption": "Optional display caption",
  "credit": "Optional photographer credit",
  "usageSlot": "gallery"
}
```

Do not use bare strings for image fields in JSON content files. Markdoc frontmatter image fields are strings (see limitation note below).

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
| Navigation menu | `src/content/config/nav.json` | `navSchema` |
| Colors, fonts, spacing, breakpoints | `src/content/config/theme.json` | `themeSchema` |
| Homepage headline, subheadline, CTA | `src/content/pages/home.mdoc` | `homeFrontmatterSchema` |
| Homepage intro text (below hero) | `src/content/pages/home.mdoc` (body) | — |
| About page headline | `src/content/pages/about.mdoc` | `aboutFrontmatterSchema` |
| Artist bio | `src/content/pages/about.mdoc` (body) | — |
| Music page headline | `src/content/pages/music.mdoc` | `musicFrontmatterSchema` |
| Music page intro text | `src/content/pages/music.mdoc` (body) | — |
| Photos page headline | `src/content/pages/photos.mdoc` | `photosFrontmatterSchema` |
| Press page headline, EPK download link | `src/content/pages/press.mdoc` | `pressFrontmatterSchema` |
| Press reviews section heading | `src/content/pages/press.mdoc` → `reviewsHeadline` | `pressFrontmatterSchema` |
| Press intro text | `src/content/pages/press.mdoc` (body) | — |
| Contact page headline | `src/content/pages/contact.mdoc` | `contactFrontmatterSchema` |
| Contact intro text | `src/content/pages/contact.mdoc` (body) | — |

### Collections

| What | Path | Schema | Format |
|------|------|--------|--------|
| Music releases (albums, singles, EPs) | `src/content/collections/releases/*.json` | `releaseSchema` | One JSON file per release |
| Photo gallery | `src/content/collections/photos/gallery.json` | `photoSchema` (array) | Array of image metadata objects |
| Videos | `src/content/collections/videos/videos.json` | `videoSchema` (array) | Array |
| Press quotes | `src/content/collections/pressQuotes/quotes.json` | `pressQuoteSchema` (array) | Array |
| Tour dates | `src/content/collections/tourDates/dates.json` | `tourDateSchema` (array) | Array |

### Images

Static images live in `public/images/`. Reference as `/images/filename.ext` from content and components.

Image references in **JSON content files** use the `imageMetadataSchema` object shape (required: `src`, `alt`).

Image references in **Markdoc frontmatter** are plain path strings.

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
    releases/         ← one .json file per release
    photos/           ← gallery.json (array)
    videos/           ← videos.json (array)
    pressQuotes/      ← quotes.json (array)
    tourDates/        ← dates.json (array)

src/content.config.ts   ← Astro content collection definitions
src/lib/
  schemas.ts            ← all Zod schemas (source of schema truth)
  content.ts            ← validated config loaders (getSiteConfig, getNav, getTheme)
public/images/          ← static images (served as-is)
```

Do not place content files outside these locations.

---

## Architecture

- **Framework**: Astro + React + TypeScript (strict mode)
- **Rendering**: Static by default via `@astrojs/netlify` adapter. Pages are prerendered at build time. API routes use `export const prerender = false`.
- **Content**: Astro content collections (`src/content.config.ts`). Page copy in Markdoc (`.mdoc`), collections in JSON, config in JSON. Queried via `getEntry()`/`getCollection()` from `astro:content`.
- **Styling**: CSS custom properties (design tokens) from `src/styles/global.css`. Token values come from `src/content/config/theme.json`.
- **Images**: Static images in `public/images/`. Served as-is; reference as `/images/filename.ext`.

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

### `Image.astro`
Zero-JS image component with consistent styling.
- Props: `src`, `alt` (required), `class`, `loading`, `aspectRatio`, `objectFit`
- Lazy loading by default, no client-side hydration needed

### `Image.tsx` (React)
Image component with loading/error state handling and fade-in effect.
- Props: `src`, `alt`, `className`, `loading`, `aspectRatio`, `objectFit`
- Shows placeholder during load, fallback on error
- Used only inside `Lightbox.tsx` where dynamic image loading state is needed

### `PhotoGallery.astro`
Photo grid with lightbox support.
- Props: `photos` (array of `{ src, alt, caption? }`)
- Renders a static thumbnail grid using `Image.astro` (zero hydration cost)
- Includes `Lightbox` as a React island (`client:only="react"`) for full-size viewing
- Communicates with Lightbox via `open-lightbox` custom event

### When to use each
- Use `Button` for all clickable actions (links, submit buttons, icon buttons)
- Use `FormGroup` for all form fields instead of raw `<input>`/`<label>`
- Use `Image.astro` in `.astro` components for all images
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

1. Create a Markdoc file (`.mdoc`) in `src/content/pages/` with required frontmatter (`title`, `headline`).
2. Add a frontmatter schema for the new page to `src/lib/schemas.ts`.
3. Add a content collection definition in `src/content.config.ts`.
4. Create an Astro page file in `src/pages/`. Use `getEntry()` and `render()` from `astro:content`.
5. Add a navigation entry in `src/content/config/nav.json`.

---

## Adding a New Collection Type

1. Define the item schema in `src/lib/schemas.ts`.
2. Create the collection directory under `src/content/collections/{name}/`.
3. Add a content collection definition in `src/content.config.ts`.
4. Add validation for the collection to `scripts/validate-content.ts`.
5. Add sample data files. Array-based JSON files require an `id` field on each entry.

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
