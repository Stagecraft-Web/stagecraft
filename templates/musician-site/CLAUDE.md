# CLAUDE.md — Instructions for AI Editing

This file guides Claude Code (or any AI agent) when making changes to this musician website.

## Architecture

- **Framework**: Astro + React + TypeScript (strict mode)
- **Rendering**: Static by default via `@astrojs/netlify` adapter. Pages are prerendered at build time. Server-rendered routes (API endpoints) opt out with `export const prerender = false`.
- **Content**: Structured files in `src/content/`. Page copy in Markdown, collections in JSON, config in JSON.
- **Styling**: CSS custom properties (design tokens) defined in `src/styles/global.css` with values from `src/content/config/theme.json`. Supports light/dark color modes.
- **Images**: Source images in `src/assets/images/`. Astro handles optimization at build time.

## Design Token System

All visual values (colors, fonts, spacing, etc.) must use CSS custom properties. Never use hardcoded hex colors, font sizes, or font weights in component styles.

### Token categories

| Category | Prefix | Example |
|----------|--------|---------|
| Colors | `--color-*` | `var(--color-primary)`, `var(--color-white)` |
| Font sizes | `--font-size-*` | `var(--font-size-base)`, `var(--font-size-2xl)` |
| Font weights | `--font-weight-*` | `var(--font-weight-medium)`, `var(--font-weight-bold)` |
| Font families | `--font-*` | `var(--font-heading)`, `var(--font-body)` |
| Layout | `--max-content`, `--max-text`, `--radius` | |
| Breakpoints | `--breakpoint-*` | Reference only — use literal values in `@media` with a comment |

### Token sources

- Token values: `src/content/config/theme.json`
- CSS custom properties: `src/styles/global.css`

## Component Library

Use the generic components instead of raw HTML elements:

### `Button.astro`
Polymorphic button/link component with variants.
- Renders `<a>` when `href` is provided, `<button>` otherwise
- Variants: `primary`, `outline`
- Supports `ariaLabel` for icon-only buttons
- Supports `isExternal` prop for target="_blank" links

### `FormGroup.astro`
Form field wrapper with label, input/textarea, and required indicator.
- Props: `label`, `name`, `type`, `isTextarea`, `rows`, `isRequired`, `autocomplete`
- Handles both `<input>` and `<textarea>` via the `isTextarea` prop

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
- Use CSS modules (`.module.css`) for React component styles — no CSS-in-JS.
- See `Lightbox.module.css` and `PhotoGallery.module.css` for examples.

### Boolean prop naming
All boolean props must start with `is` or `has` (e.g. `isExternal`, `isRequired`, `isTextarea`).

### Breakpoints in `@media` queries
CSS custom properties cannot be used in `@media` queries (spec limitation). When writing media queries, use the literal pixel value and add a comment linking back to the token name:
```css
/* --breakpoint-md (768px) */
@media (max-width: 768px) { ... }
```

## Utility Classes

- `.screenreader-only` — visually hidden, accessible to screen readers
- `.container` — centered max-width wrapper
- `.prose` — text content with comfortable line height
- `.section` / `.section-alt` — vertical section spacing
- `.grid`, `.grid-2`, `.grid-3` — responsive grid layouts

## Content Utilities

### `src/lib/markdown.ts`
- `parseFrontmatter(raw)` — extracts key-value pairs from `---` delimited frontmatter
- `parseBody(raw)` — strips frontmatter and splits into paragraphs

Use these when loading `.md?raw` content in pages. Do NOT inline markdown parsing logic.

## Editing Rules

### Content changes (bio updates, new tour dates, etc.)
1. Edit the relevant file in `src/content/`. Do NOT edit component code for content changes.
2. Page copy: edit Markdown files in `src/content/pages/`.
3. Collection data: edit JSON files in `src/content/collections/`.
4. Site config: edit `src/content/config/site.json`.
5. Navigation: edit `src/content/config/nav.json`.

### Style/theme changes
1. Edit `src/content/config/theme.json` for token values (colors, font sizes, etc.).
2. Update corresponding CSS custom properties in `src/styles/global.css`.
3. Edit component `<style>` blocks for component-specific layout changes.
4. **Never use hardcoded hex colors, px font sizes, or numeric font weights.** Always use `var(--token-name)`.

### Color mode (light/dark)
- `theme.json` has `colorMode: "light" | "dark"` and an optional `darkColors` palette.
- If `"light"`: site renders light by default, automatically switches to dark when the viewer's OS has `prefers-color-scheme: dark`.
- If `"dark"`: site always renders in dark mode.
- Dark overrides are in `global.css` under `[data-theme="dark"]`. An inline `<script>` in `BaseLayout.astro` sets the attribute before first paint to avoid a flash of wrong theme.
- To customize dark colors, edit `darkColors` in `theme.json` and update the corresponding CSS variables in the `[data-theme="dark"]` block.

### Adding a new page
1. Create a Markdown content file in `src/content/pages/`.
2. Create an Astro page file in `src/pages/`.
3. Use `parseFrontmatter` and `parseBody` from `src/lib/markdown.ts`. Render paragraphs with `.map((p) => <p>{p}</p>)` — never join with `\n\n`.
4. Add navigation entry in `src/content/config/nav.json`.

### Adding images
1. Place source images in `src/assets/images/`.
2. Reference them from content files or components.
3. Use descriptive alt text for every image.

## API Routes

### `POST /api/contact`
Sends a contact form email via Resend. Requires `RESEND_API_KEY` environment variable.
- Validates required fields (name, email, message)
- Honeypot spam prevention
- IP-based rate limiting (3 requests/minute)
- Sends to `contactEmail` from `site.json`
- The `from` address uses Resend's sandbox domain by default (`onboarding@resend.dev`). Update once a custom domain is verified in Resend.

## Constraints
- Prefer `.astro` components over React unless stateful interactivity is needed.
- Use the generic component library (Button, FormGroup, Image) instead of raw HTML.
- Keep diffs small and focused.
- Do not introduce new dependencies without justification.
- Do not refactor code unrelated to the requested change.
- Maintain accessibility (semantic HTML, alt text, keyboard navigation, color contrast).
- Run `npm run validate` before committing to ensure content, types, and build pass.
- Pages are prerendered by default. Only add `export const prerender = false` for server-rendered routes (API endpoints).

## Validation Commands
```bash
npm run validate:content  # Validate JSON content against schemas
npm run typecheck         # TypeScript check
npm run build             # Full production build
npm run test              # Unit tests (vitest)
npm run test:smoke        # Playwright smoke tests (requires build first)
```
