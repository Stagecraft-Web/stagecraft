# CLAUDE.md — Instructions for AI Editing

This file guides Claude Code (or any AI agent) when making changes to this musician website.

## Architecture

- **Framework**: Astro + React + TypeScript (strict mode)
- **Rendering**: Static-first. Use `.astro` components for most UI. Use React only for interactive islands.
- **Content**: Structured files in `src/content/`. Page copy in Markdown, collections in JSON, config in JSON.
- **Styling**: CSS custom properties (design tokens) defined in `src/styles/global.css` with values from `src/content/config/theme.json`.
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

### `Image.tsx` (React)
Image component with loading/error state handling.
- Props: `src`, `alt`, `loading`, `aspectRatio`, `objectFit`
- Shows placeholder during load, fallback on error

### When to use each
- Use `Button` for all clickable actions (links, submit buttons, icon buttons)
- Use `FormGroup` for all form fields instead of raw `<input>`/`<label>`
- Use `Image` in React components (Lightbox, PhotoGallery). In `.astro` components, use native `<img>` with Astro image optimization.

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

### Adding a new page
1. Create a Markdown content file in `src/content/pages/`.
2. Create an Astro page file in `src/pages/`.
3. Use `parseFrontmatter` and `parseBody` from `src/lib/markdown.ts`.
4. Add navigation entry in `src/content/config/nav.json`.

### Adding images
1. Place source images in `src/assets/images/`.
2. Reference them from content files or components.
3. Use descriptive alt text for every image.

## Constraints
- Prefer `.astro` components over React unless stateful interactivity is needed.
- Use the generic component library (Button, FormGroup, Image) instead of raw HTML.
- Keep diffs small and focused.
- Do not introduce new dependencies without justification.
- Do not refactor code unrelated to the requested change.
- Maintain accessibility (semantic HTML, alt text, keyboard navigation, color contrast).
- Run `npm run validate` before committing to ensure content, types, and build pass.

## Validation Commands
```bash
npm run validate:content  # Validate JSON content against schemas
npm run typecheck         # TypeScript check
npm run build             # Full production build
npm run test              # Unit tests (vitest)
npm run test:smoke        # Playwright smoke tests (requires build first)
```
