# CLAUDE.md — `templates/musician-site` (Next.js + Puck)

Conventions for the new musician-site template per ADR-007. The legacy
Astro + Keystatic template lives at `templates/musician-site-legacy/` —
its conventions don't apply here.

## Stack

- Next.js 15 (App Router)
- React 19
- Puck (`@measured/puck`) — visual block editor at `/admin`
- Files only; no database. Content lives in `src/content/`.

## Editor philosophy

Set up Puck on its happy path. Block configs are written natively as
Puck `Config` objects (`fields`, `defaultProps`, `render`). The
existing legacy template's tags are a reference for *what* artists need,
not a contract for *how* Puck is configured.

The Puck config at `src/puck/config.tsx` is the source of truth for
block schemas. Don't auto-generate it from Zod; don't share block
schemas with the legacy template. ADR-007 explicitly exempts Puck
block configs from the cross-system SSOT rule in the top-level
`CLAUDE.md` §1.

## Where things live

```
src/
  app/
    page.tsx              Public catch-all (renders Puck JSON via <Render>)
    admin/page.tsx        /admin server entry — loads JSON
    admin/Editor.tsx      Client component that hosts <Puck>
    api/save/route.ts     Dev save endpoint (writes to disk)
  puck/
    config.tsx            Puck Config — blocks, fields, render
  lib/
    content.ts            JSON read/write helpers
  content/
    pages/<slug>.json     Puck output for each page
```

## Content collections (releases, tour dates, posts, store items)

Not yet ported. When they land, structured content stays in JSON /
Markdown files validated by Zod schemas in `src/lib/schemas.ts` (per
ADR-007 §3 — collections keep the Zod SSOT discipline). Puck blocks
that consume those collections (e.g. a `TourDates` block listing
upcoming shows) read them at render time.

## Validation

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Run before committing.

## What's intentionally not here yet

- Magic-link auth (gated by env in v1; spike's `/admin` is unguarded for now)
- GitHub App publish flow (per ADR-008; spike's `/api/save` writes to local disk)
- Image upload pipeline with `sharp` (per ADR-007 §6)
- Image-metadata schema and `<Image>` render component
- Real block library (releases, tour dates, posts — ported from legacy)

These ship in stacked PRs after the spike merges.
