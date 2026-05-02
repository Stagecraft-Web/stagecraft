# Musician Website

Your musician website, built with Astro + React + TypeScript.
Created and managed by [Stagecraft](https://stagecraft.dev).

## Setup

```bash
npm install
npm run dev
```

- Public site: <http://localhost:4321>
- Keystatic CMS: <http://localhost:4321/keystatic>

## Editing

All site content lives under `src/content/`. You can edit it
visually via the Keystatic CMS, or by changing files directly.
See [EDITING.md](./EDITING.md) for a walkthrough.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build (includes typecheck) |
| `npm run preview` | Preview production build locally |
| `npm run validate:content` | Check content files against schemas |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Unit tests (vitest) |
| `npm run test:smoke` | Playwright smoke tests (build first) |
| `npm run validate` | All of the above |

## Project structure

```
src/
  assets/images/   Source images (optimised at build)
  content/         Your site content — edit here
  components/      Astro + React components
  content-components/   Markdoc content blocks
  layouts/         Page layouts
  lib/             Utilities + schemas
  pages/           Routes
  styles/          Global CSS + design tokens
public/            Static files (favicons, downloads)
tests/smoke/       Playwright smoke tests
```

## Deployment

The site deploys to [Netlify](https://www.netlify.com). Pushes to
`main` trigger a production deploy; pull requests create preview
deploys automatically.

For production editing via Keystatic (GitHub OAuth + the live-preview
Appearance sidebar), follow the one-time setup in
[docs/keystatic-github-setup.md](./docs/keystatic-github-setup.md).

## Technology

- [Astro](https://astro.build) — static site framework
- [React](https://react.dev) — interactive islands
- [Keystatic](https://keystatic.com) — visual CMS
- [Zod](https://zod.dev) — content schema validation
- [TypeScript](https://www.typescriptlang.org) — type safety
- [Vitest](https://vitest.dev) — unit tests
- [Playwright](https://playwright.dev) — smoke tests
- [Netlify](https://www.netlify.com) — hosting
