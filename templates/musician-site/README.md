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
| `npm run test:smoke` | Run Playwright smoke tests |
| `npm run validate` | Run all validation (content + lint + typecheck + build) |

## Project Structure

```
src/
  assets/images/    Source images (optimized at build time)
  components/       Reusable .astro and .tsx components
  content/          Structured content (JSON, Markdown)
  layouts/          Page layouts
  lib/              Utilities and schemas
  pages/            Route files
  styles/           Global CSS
public/             Static assets (favicons, downloads)
tests/smoke/        Playwright smoke tests
```

## Editing Content

See [EDITING.md](./EDITING.md) for a guide to common content edits.

## Technology

- [Astro](https://astro.build) — static site framework
- [React](https://react.dev) — interactive component islands
- [TypeScript](https://www.typescriptlang.org) — type safety
- [Zod](https://zod.dev) — content schema validation
- [Playwright](https://playwright.dev) — smoke testing
- [Netlify](https://www.netlify.com) — hosting and deploy previews
