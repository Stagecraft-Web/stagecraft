# CLAUDE.md — Instructions for AI Editing

This file guides Claude Code (or any AI agent) when making changes to this musician website.

## Architecture

- **Framework**: Astro + React + TypeScript (strict mode)
- **Rendering**: Static-first. Use `.astro` components for most UI. Use React only for interactive islands.
- **Content**: Structured files in `src/content/`. Page copy in Markdown, collections in JSON, config in JSON.
- **Styling**: Global CSS with CSS custom properties. Token values defined in `src/content/config/theme.json`.
- **Images**: Source images in `src/assets/images/`. Astro handles optimization at build time.

## Editing Rules

### Content changes (bio updates, new tour dates, etc.)
1. Edit the relevant file in `src/content/`. Do NOT edit component code for content changes.
2. Page copy: edit Markdown files in `src/content/pages/`.
3. Collection data: edit JSON files in `src/content/collections/`.
4. Site config: edit `src/content/config/site.json`.
5. Navigation: edit `src/content/config/nav.json`.

### Style/theme changes
1. Edit `src/content/config/theme.json` for token values.
2. Edit `src/styles/global.css` for structural CSS changes.
3. Edit component `<style>` blocks for component-specific changes.

### Adding a new page
1. Create a Markdown content file in `src/content/pages/`.
2. Create an Astro page file in `src/pages/`.
3. Add navigation entry in `src/content/config/nav.json`.

### Adding images
1. Place source images in `src/assets/images/`.
2. Reference them from content files or components.
3. Use descriptive alt text for every image.

## Constraints
- Prefer `.astro` components over React unless stateful interactivity is needed.
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
npm run test:smoke        # Playwright smoke tests (requires build first)
```
