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

## Design tokens

Follows the monorepo-wide rule in the root `CLAUDE.md` §7. All visual
values (colors, fonts, spacing, sizes, radii, shadows) come from CSS
custom properties — no hardcoded hex, sizes, or weights in CSS, in
inline `style={...}` props, or in HTML returned from route handlers.

The token set is defined at `src/app/globals.css` (imported once from
`src/app/layout.tsx`). Naming follows the shared prefix conventions
(`--color-*`, `--font-size-*`, `--font-weight-*`, `--space-*`,
`--radius-*`) so it stays consistent with `apps/web/` and the legacy
template.

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
| `RESEND_API_KEY` + `MAGIC_LINK_FROM` | prod | Provisioned automatically by `/create` from the artist's own Resend account (connected at `/settings` on the platform). Each artist site uses its owner's account end-to-end — the platform never sees recipient addresses. Without these, magic links log to the dev server console. |

**Cookie:** `mc_session`, HttpOnly, SameSite=Lax, 7-day max age. `Secure` flag set in production.

Middleware (`src/middleware.ts`) gates `/admin/*` and `/api/save`. `/admin/login` is allowlisted. API routes return 401; pages redirect.

**Server-side session access:** `getSession()` from `@/lib/auth` reads the cookie and verifies it. Use it in Server Components and route handlers.

**Local setup:** copy `.env.example` to `.env.local` and fill in `MAGIC_LINK_SIGNING_SECRET` + `ADMIN_EMAIL`. With `RESEND_API_KEY` / `MAGIC_LINK_FROM` unset, magic links log to the dev server console. In dev only, the request handler also emits a `console.warn` when `ADMIN_EMAIL` is missing or the submitted email doesn't match — production stays silent to prevent enumeration.

**Logging out:** the editor header shows the signed-in email and a Sign out button that POSTs to `/api/auth/logout`. The endpoint is POST-only by design — a GET logout would be a CSRF foot-gun (any external `<img src>` could log everyone out).

## Images (ADR-007 §6)

**Pipeline.** `POST /api/upload-image` accepts a multipart form with `file`, `contentSlug`, and `alt`. The handler:

1. Validates MIME type (`jpeg`/`png`/`webp`/`avif`) and size (≤25 MB).
2. Computes a 16-char SHA-256 content hash → used as the image id.
3. If the original already exists at the target path, skips processing (dedup; ADR-007 §6).
4. Otherwise, runs `sharp().rotate()` (EXIF-correct) and emits variants `400/800/1600` in **webp + avif**, plus a tiny inline-base64 LQIP placeholder.
5. Returns `ImageMetadata` (zod-validated).

**On disk:**
```
public/images/<content-slug>/<image-id>/
  original.<ext>
  {400,800,1600}.{webp,avif}
```

**Rendering.** `<Image>` from `@/components/Image` consumes `ImageMetadata` and emits a `<picture>` with avif → webp `<source>` tags, lazy loading, async decoding, explicit width/height (CLS-safe), and the LQIP as `background-image` for instant paint. The component is intentionally a thin renderer — alt comes from the metadata, not a separate prop. ESLint's `jsx-a11y/alt-text` rule is overridden to allow this for our `Image` component (see `eslint.config.mjs`).

**Migration.** Variant scheme changes are out of band — a one-shot script that walks `public/images/`, reads each `original.<ext>`, and writes new variants. Not part of the live publish path.

**Editor integration.** The `Image` Puck block uses a custom field (`src/puck/ImagePickerField.tsx`) that wraps `/api/upload-image`: the artist picks a file, types alt text, hits Upload — the field stores the returned `ImageMetadata` as the block's value. The public render path passes that metadata straight to the `<Image>` component above. Editor-side state stays in the field component; the field is `"use client"` since Puck calls it inside the editor surface.

**Production vs dev:** when the platform env vars are configured (see Publishing below), the route commits the original + every variant to the artist's repo through the broker (one commit per upload). Without the env vars (local dev), it writes the same files to `public/images/` so the dev server can serve them.

**TODO (covered by stacked PRs):**
- GitHub-backed dedup check. Today both code paths recompute variants on every upload; the broker path produces a no-op tree for re-uploads (deterministic blob SHAs) but still creates a commit. A `getContent`-based pre-check would skip the commit entirely.

## Publishing (ADR-007 §5, ADR-008)

`POST /api/publish` accepts `{ pageSlug, data }`. Two modes:

**Production (platform configured):**
1. Validate magic-link session.
2. POST `STAGECRAFT_PLATFORM_URL/api/publish-token` with `{ siteId }` and `Authorization: Bearer STAGECRAFT_BROKER_SECRET`.
3. Broker mints a short-lived GitHub App installation token + returns `{ owner, repo }`.
4. Octokit Git Data API: blob → tree → commit → update ref. One commit, structured trailer `Stagecraft-Publish-Id: <uuid>`. Author is the artist's email; committer is the App.
5. Return `{ ok: true, commitSha }`.

**Dev fallback (platform not configured):** writes JSON directly to `src/content/pages/<slug>.json`. Detected by missing `STAGECRAFT_PLATFORM_URL`, `STAGECRAFT_SITE_ID`, or `STAGECRAFT_BROKER_SECRET`.

**Env vars:**

| Var | Required | Notes |
| --- | --- | --- |
| `STAGECRAFT_PLATFORM_URL` | prod | Base URL of the broker. Trailing slash tolerated. |
| `STAGECRAFT_SITE_ID` | prod | Platform's `Site.id` for this deployment. Namespaced because Netlify reserves `SITE_ID` for its own injected site identifier. |
| `STAGECRAFT_BROKER_SECRET` | prod | Per-site shared secret with the platform; sent as `Authorization: Bearer`. Generated by platform at install time. |
| `SITE_GIT_BRANCH` | no | Defaults to `main`. |

**Errors:** structured envelope `{ ok: false, code, error }` with codes `unauthorized`, `validation-failed`, `broker-unreachable`, `broker-rejected`, `github-failed`, `no-platform-configured`. Broker rejection → 502; GitHub failure → 500.

**Auth note (vs ADR-008 wording):** ADR-008 §2 sketches the broker auth as "forwarded magic-link cookie." That's not actually verifiable cross-service (the artist site signs sessions with its own secret, which the platform doesn't hold). Implementation uses a per-site `STAGECRAFT_BROKER_SECRET` provisioned at install. ADR-008 should be amended to reflect this; tracked as a follow-up.

## What's intentionally not here yet

- **Platform-side endpoints** (token broker, install callback, webhook) — separate PR; without them, publish runs in dev fallback.
- **Real block library** (releases, tour dates, posts — ported from legacy).

These ship in stacked PRs.
