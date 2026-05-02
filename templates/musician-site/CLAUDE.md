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

## Authentication (ADR-007 §4)

Single allowed email per site, gated by middleware. Magic-link flow:

1. Visit `/admin` → middleware redirects to `/admin/login`
2. Enter email → POST `/api/auth/request` → token emailed
3. Click email link → GET `/api/auth/verify?token=...` → session cookie set, redirect to `/admin`

**Env vars:**

| Var | Required | Notes |
| --- | --- | --- |
| `MAGIC_LINK_SIGNING_SECRET` | yes | Random string, ≥32 bytes. Used to sign JWTs (HS256). Rotate forces re-login. |
| `ADMIN_EMAIL` | yes | Single allowed email. Anything else gets the same "check your email" response (no enumeration). |
| `RESEND_API_KEY` | dev: no, prod: yes | Without it, magic links log to server console (dev fallback). |
| `MAGIC_LINK_FROM` | no | Sender email. Defaults to `noreply@example.com`. |

**Cookie:** `mc_session`, HttpOnly, SameSite=Lax, 7-day max age. `Secure` flag set in production.

Middleware (`src/middleware.ts`) gates `/admin/*` and `/api/save`. `/admin/login` is allowlisted. API routes return 401; pages redirect.

**Server-side session access:** `getSession()` from `@/lib/auth` reads the cookie and verifies it. Use it in Server Components and route handlers.

**Local setup:** copy `.env.example` to `.env.local` and fill in `MAGIC_LINK_SIGNING_SECRET` + `ADMIN_EMAIL`. With `RESEND_API_KEY` unset, magic links log to the dev server console. In dev only, the request handler also emits a `console.warn` when `ADMIN_EMAIL` is missing or the submitted email doesn't match — production stays silent to prevent enumeration.

**Logging out:** the editor header shows the signed-in email and a Sign out button that POSTs to `/api/auth/logout`. The endpoint is POST-only by design — a GET logout would be a CSRF foot-gun (any external `<img src>` could log everyone out).

## What's intentionally not here yet

- GitHub App publish flow (per ADR-008; current `/api/save` writes to local disk)
- Image upload pipeline with `sharp` (per ADR-007 §6)
- Image-metadata schema and `<Image>` render component
- Real block library (releases, tour dates, posts — ported from legacy)

These ship in stacked PRs.
