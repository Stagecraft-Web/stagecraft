# CLAUDE.md — Monorepo Coding Standards

Code-quality rules for the Stagecraft monorepo. These override general
defaults. Musician-facing documentation for the `templates/musician-site/`
template lives inside that directory and is user-oriented; the
convention-level rules for how that template is built and edited live
in this file.

## Repo structure

```
apps/
  web/              Next.js platform app
packages/
  shared/           Cross-cutting types, enums, constants, utilities
  db/               Prisma schema + client
  queue/            Async job queue
templates/
  musician-site/    Astro musician-site template (user-facing docs inside)
claude/
  skills/           Repo-scoped skills (e.g. create-pr, artist-site-pipeline)
docs/
  adr/              Architecture decision records
  specs/            Product and technical specs
  runbook.md        Ops + env setup
```

---

## 1. Narrow types — never `string` for fixed value sets

Any prop, field, parameter, or variable that accepts a **fixed set of
values** MUST use a TypeScript union — never `string`.

```ts
// Wrong
status: string

// Right
status: JobStatus          // from @stagecraft/shared
provider: 'github' | 'netlify'
```

- Check `packages/shared/src/types.ts` first. `JobStatus`, `JobType`,
  `EditMode`, `ChangeRequestStatus`, `SiteStatus`, `BlueprintType`,
  `IntegrationProvider`, `AssetUploadStatus`, `PreviewStatus`, and
  others already exist — import them.
- A union used in one file only can live locally; if it ends up in
  two, promote it to `packages/shared` (see §4).

---

## 2. DRY — don't repeat yourself

### Check before defining

Before writing a new type, enum, constant, or utility:

1. Check `packages/shared/src/`.
2. Check the app where the code will live.
3. Import what already exists.

### Extract when shared

If the same type / enum / constant / utility is needed in **more than
one file**, it MUST live in `packages/shared` and be imported
everywhere. No copy-paste across files.

### Use the shared UI component library

Use existing components rather than reimplementing patterns inline:

| Component      | Use for                                              |
| -------------- | ---------------------------------------------------- |
| `Button`       | All clickable actions — links, submits, icon buttons |
| `FormGroup`    | All form fields — never raw `<input>` / `<label>`    |
| `Image` (React)| Images inside React components                       |

Only build a new component if none of the existing ones fit.

### Extract generic helpers

Generic helpers (date formatting, string manipulation, validation,
error handling) belong in `packages/shared/src/` as utilities, not
local to one file.

---

## 3. Test coverage

Every PR must include tests for:

- **New utility functions** — unit tests for all exports.
- **API route handlers** — tested directly; success + error paths.
- **Non-trivial logic branches** — a case per meaningful branch.

### What tests cover

- Happy path (expected in → expected out)
- Error and edge cases (invalid input, missing fields, out-of-range)
- Boundary conditions

### Conventions

- **vitest** with relative imports, matching existing patterns.
- Co-locate: `foo.ts` → `foo.test.ts`.
- Skip trivial pass-through code (simple getters, re-exports).

---

## 4. Shared package (`packages/shared`)

### When to add

- Any type, enum, or constant used in more than one package or app.
- Any utility generic enough to be useful outside its origin file.

### How to add

1. Add the export to `packages/shared/src/types.ts` (for types / enums)
   or a new file (for utilities).
2. Re-export from `packages/shared/src/index.ts`.
3. Import via `@stagecraft/shared`.

```ts
// packages/shared/src/index.ts
export * from "./types.js";
export * from "./your-new-module.js";

// elsewhere
import { JobStatus, JobType } from "@stagecraft/shared";
```

### Don't

- Define shared types locally and import across package boundaries.
- Duplicate a type that already exists in `packages/shared`.
- Forget to add new exports to `index.ts`.

---

## 5. Pull requests

PRs that change rendered UI (public site or Keystatic admin) must
embed screenshots from a public gist, since this repo is private and
in-tree / `raw.githubusercontent.com` URLs don't render anonymously.

Full workflow in the `create-pr` skill at
`claude/skills/create-pr/SKILL.md`: capture → upload to gist → embed
in PR body → verify URLs return 200. Refactor-only or backend-only
PRs may omit screenshots — note this explicitly in the PR body.

---

## 6. Musician-site template (`templates/musician-site/`)

The user-facing docs inside the template (`README.md`, `EDITING.md`,
`CLAUDE.md`) are for musicians editing their own site. The
conventions below are for working on the template itself within this
monorepo.

### Schema-first editing

Every editable piece of content has a named field in a Zod schema in
`src/lib/schemas.ts`, which maps to a specific file under
`src/content/`.

- For any content change, edit the file in `src/content/` — not
  `.astro` / `.tsx` components. Components render content; they don't
  define it.
- Run `npm run validate:content` after any content change.
- Do not add ad-hoc keys outside the schema. Do not remove required
  fields. To add a field, update the Zod schema first, then the
  content file.
- Image references in YAML use the `imageMetadataSchema` shape
  (required: `src`, `alt`). Paths are relative from the content file
  to `src/assets/images/` so Astro's image pipeline can optimise.

### Seed examples

Every seed file under `src/content/collections/<name>/` must populate
every required field with a real value or sensible placeholder.
When adding a required field to a collection schema, update the seed
example in the same commit — otherwise `npm run validate:content`
fails for anyone who pulls the change. Status-like enums are always
written out explicitly (e.g. `status: upcoming`); don't rely on
defaults.

### Enum single source of truth

Every string-literal enum has exactly **one** canonical declaration.
Zod schemas, Astro content collections, Keystatic selects, Markdoc
`matches` arrays, and TypeScript unions all derive from that const —
never redeclare the values.

**Where they live:**

- **Data-shape enums** (values persisted in content files) → canonical
  in `src/lib/schemas.ts`. Examples: `RELEASE_TYPES`, `VIDEO_TYPES`,
  `TOUR_DATE_STATUSES`, `POST_CATEGORIES`, `POST_STATUSES`,
  `STORE_ITEM_FORMATS`, `STORE_ITEM_STATUSES`, `IMAGE_USAGE_SLOTS`,
  `FONT_CATEGORIES`.
- **UI / attribute enums** (Markdoc tag attributes or Keystatic
  content-component selects only) → canonical in
  `src/content-components/_shared/types.ts`. Examples:
  `HEADING_LEVELS`, `BUTTON_VARIANTS`, `COLUMNS_LAYOUTS`,
  `TOUR_DATES_FILTERS`, `POSTS_LIST_LAYOUTS`, `EMBED_ASPECT_RATIOS`,
  `NEWSLETTER_SERVICES`, `VIDEO_URL_TYPES`.

When unsure, default to `schemas.ts`.

**The pattern.** Always `as const` + derived union — never a bare
`string[]`:

```ts
export const FOO_VALUES = ["a", "b", "c"] as const;
export type FooValue = (typeof FOO_VALUES)[number];

// When display labels differ from values, colocate a sibling record:
export const FOO_LABELS: Record<FooValue, string> = { a: "Alpha", ... };
```

**Consumers.** Import and derive; never paste the values again:

```ts
// Markdoc `matches`:
matches: FOO_VALUES as unknown as string[]

// Keystatic `fields.select`:
options: FOO_VALUES.map((v) => ({ label: FOO_LABELS[v] ?? v, value: v }))

// content.config.ts:
z.enum(FOO_VALUES)
```

**Adding a new enum:** (1) decide data-shape vs UI, (2) declare the
const + optional labels record, (3) reference it via the consumer
patterns above. Run `npm run check:markdoc-config` and `npm test` —
the cross-schema consistency test asserts Markdoc `matches` and
Keystatic `options` stay aligned.

**Intentional divergences** (don't "fix" these): currency codes
(permissive Zod, curated Keystatic select), social-link keys (record
shape, not enum), `parseColumnsLayout` regex (runtime-permissive;
authoring surfaces curate).

### Design tokens

All visual values (colors, fonts, spacing) use CSS custom properties.
Never hardcode hex colors, font sizes, or font weights in component
styles.

| Category      | Prefix              | Example                                          |
| ------------- | ------------------- | ------------------------------------------------ |
| Colors        | `--color-*`         | `var(--color-primary)`                           |
| Font sizes    | `--font-size-*`     | `var(--font-size-base)`                          |
| Font weights  | `--font-weight-*`   | `var(--font-weight-medium)`                      |
| Font families | `--font-*`          | `var(--font-heading)`, `var(--font-body)`        |
| Layout        | `--max-content`, `--max-text`, `--radius` |                            |
| Breakpoints   | `--breakpoint-*`    | Reference only — see below                       |

CSS custom properties cannot appear in `@media` queries. Use literal
pixel values with a comment:

```css
/* --breakpoint-md (768px) */
@media (max-width: 768px) { ... }
```

Token values flow: `src/content/config/appearance.json` (CMS-editable)
→ injected via `BaseLayout.astro` → consumed by `src/styles/global.css`.
Non-CMS tokens (font-size scale, spacing, breakpoints) live in
`src/content/config/theme.json`.

### Boolean props

Start all boolean props with `is`, `are`, `has` (e.g. `isExternal`,
`isRequired`, `isTextarea`).

### Styling in React components

CSS modules (`.module.css`). No CSS-in-JS.

### Rendering + routing

- Pages are prerendered by default via `@astrojs/netlify`.
- Only API endpoints set `export const prerender = false`.
- All pages route through `src/pages/[...slug].astro`. Page layout
  lives entirely in the `.mdoc` body via Markdoc layout tags
  (`{% section %}`, `{% fullscreen-section %}`, `{% columns %}`,
  `{% column %}`); the catch-all doesn't branch on slug.

### General constraints

- Prefer `.astro` components over React unless stateful interactivity
  is needed.
- Keep diffs small and focused; don't refactor unrelated code.
- Don't introduce new dependencies without justification.
- Maintain accessibility (semantic HTML, alt text, keyboard
  navigation, color contrast).

---

## Validation commands

```bash
npm run typecheck   # TypeScript across all packages
npm run test        # vitest
npm run build       # Full production build
npm run lint        # Lint all packages
```

Run `npm run typecheck` and `npm run test` before committing.
