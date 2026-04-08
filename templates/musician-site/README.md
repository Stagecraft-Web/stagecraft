# Musician Website

A static musician website built with Astro, React, and TypeScript. Created and managed by [Stagecraft](https://stagecraft.dev).

## Setup

```bash
npm install
npm run dev       # Start dev server at localhost:4321
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build (includes typecheck) |
| `npm run preview` | Preview production build locally |
| `npm run validate:content` | Validate content files against schemas |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run unit tests (vitest) |
| `npm run test:smoke` | Run Playwright smoke tests |
| `npm run validate` | Run all validation (content + lint + typecheck + build) |

## Project Structure

```
src/
  assets/images/    Source images (optimized at build time)
  components/       Reusable .astro and .tsx components
  content/          Structured content (JSON, Markdown)
  layouts/          Page layouts
  lib/              Utilities, schemas, and markdown helpers
  pages/            Route files
  styles/           Global CSS and design tokens
public/             Static assets (favicons, downloads)
tests/smoke/        Playwright smoke tests
```

## Design System

The site uses a token-based design system. All colors, font sizes, font weights, and layout values are defined as CSS custom properties in `src/styles/global.css`, sourced from `src/content/config/theme.json`.

### Component library

| Component | Type | Description |
|-----------|------|-------------|
| `Button` | Astro | Polymorphic button/link with variants (primary, outline) |
| `FormGroup` | Astro | Labeled form input/textarea with required indicator |
| `Image` | React | Image with loading placeholder and error fallback |

See [CLAUDE.md](./CLAUDE.md) for full component and editing conventions.

## Editing Content

See [EDITING.md](./EDITING.md) for a guide to common content edits.

## Technology

- [Astro](https://astro.build) — static site framework
- [React](https://react.dev) — interactive component islands
- [TypeScript](https://www.typescriptlang.org) — type safety
- [Zod](https://zod.dev) — content schema validation
- [Vitest](https://vitest.dev) — unit testing
- [Playwright](https://playwright.dev) — smoke testing
- [Netlify](https://www.netlify.com) — hosting and deploy previews
