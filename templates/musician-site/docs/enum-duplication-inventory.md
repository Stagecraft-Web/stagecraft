# Enum / String-Literal-Union Duplication Inventory

**Status:** _as-of_ state, captured before the cleanup pass on branch
`claude/enum-ssot-cleanup` (off `main` @ `3b647f0`). Follow-up PR consolidates
these into single-source constants.

**Path note:** this file would ordinarily live at repo-root
`.claude/plans/enum-duplication-inventory.md`, but the sandbox that produced
the cleanup blocked writes outside `templates/musician-site/`, so it lives
here alongside the template's other docs.

The musician-site template has accumulated a number of "enum"-shaped values
(string literal unions) that are re-declared in multiple places: the Zod
schema, the Astro content collection schema, the Keystatic select, and often
a Markdoc `matches` array plus an in-component `readonly […]` list for the TS
type. Each duplicate risks drift — adding a value to one copy silently leaves
the others behind.

This doc lists every duplicate and the chosen canonical home. Rules the
cleanup follows are in `templates/musician-site/CLAUDE.md`
(section **Enum single-source-of-truth convention**).

---

## Data-shape enums — canonical in `src/lib/schemas.ts`

These describe the _shape of content data_ (collections, frontmatter, config)
and are consumed by the Zod schemas used at content-validation time, by
Astro's content-collection schemas in `content.config.ts`, and by the
corresponding Keystatic `fields.select` options.

| Enum | Canonical name | Locations to update |
|---|---|---|
| Release type | `RELEASE_TYPES` | `schemas.ts` (inline → const), `src/content.config.ts` (inline), `keystatic.config.ts` (hand-rolled select) |
| Video platform | `VIDEO_TYPES` | same triple pattern |
| Tour date status | `TOUR_DATE_STATUSES` | same triple |
| Image usage slot (7 values: hero, about, release-cover, gallery, press, background, thumbnail) | `IMAGE_USAGE_SLOTS` | `schemas.ts`, `content.config.ts`, and 3 curated per-collection subsets in `keystatic.config.ts` that should use `.filter()` on the const |
| Font category | already `FONT_CATEGORIES` | keep; labels duplicated in `keystatic.config.ts` + `AppearanceSidebar.tsx` — add `FONT_CATEGORY_LABELS` record beside the const and import everywhere |

**Already canonical** (just verify `content.config.ts` uses them, not inlined arrays):
`POST_CATEGORIES`, `POST_STATUSES`, `STORE_ITEM_FORMATS`, `STORE_ITEM_STATUSES`.

---

## UI / attribute enums — canonical in `src/content-components/_shared/types.ts`

These describe the set of allowed values for a _Markdoc tag attribute_ or a
_Keystatic content-component select_. They're not part of the content-data
shape, so they live with the other content-component shared types rather
than with the Zod schemas.

| Enum | Canonical name | Locations to update |
|---|---|---|
| Heading level (h1–h4) | `HEADING_LEVELS` | `Section/schema.ts` + `FullscreenSection/schema.ts` local arrays, 2 hand-rolled selects |
| Button variant | `BUTTON_VARIANTS` | `Button/schema.ts` local + select |
| Columns layout (1-1, 1-2, 2-1, 1-1-1) | `COLUMNS_LAYOUTS` + `COLUMNS_LAYOUT_LABELS` record | `Columns/schema.ts` local + labelled select |
| Posts list layout (grid, list) | `POSTS_LIST_LAYOUTS` | `PostsList/schema.ts` local |
| Embed aspect ratio (auto, 16/9, 4/3, 1/1) | `EMBED_ASPECT_RATIOS` + labels record | `Embed/schema.ts` local + labelled select |
| Newsletter service (4 services) | `NEWSLETTER_SERVICES` + labels record | `NewsletterSignup/schema.ts` local + labelled select |
| Video URL type (youtube, vimeo) — **distinct** from `VIDEO_TYPES` which includes "other" | `VIDEO_URL_TYPES` | `Video/schema.ts` local + `resolveSource.ts` separate definition |

**Duplicates to clean up in `_shared/types.ts`:**

- `StoreItemFilter` + `StoreItemLayout` types currently in `_shared/types.ts`
  duplicate the `STORE_ITEM_LIST_FILTERS` / `STORE_ITEM_LIST_LAYOUTS` constants
  in `schemas.ts`. Remove from `_shared/types.ts`; `StoreItemList/schema.ts`
  imports the types directly from `schemas.ts`.

---

## Intentional divergences — **leave alone**

| Thing | Why |
|---|---|
| Currency codes | Zod schema is permissive (`z.string().length(3)`); Keystatic curates 6 codes for the dropdown. Keeping the Zod side permissive lets authors set any ISO 4217 code in a YAML file — a full list in code is overkill. |
| Social-link keys | Record shape (`Record<string, string>`) rather than an enum. The singleton's known keys are documented by the Keystatic singleton's field definitions; the Zod schema is deliberately open. |
| `parseColumnsLayout` regex | Permissive parser for runtime; accepts any `N-M-…` pattern. The Markdoc matches / Keystatic options lock the _authoring_ choices to the canonical four. |
| Theme `colorMode` | Two values used in exactly one place (`themeSchema`), no authoring surface. |

---

## Rules the cleanup applies

**Rule 1** — canonical constant pattern (always `as const` + derived union,
never a bare `string[]`):

```ts
export const FOO_VALUES = ["a", "b", "c"] as const;
export type FooValue = (typeof FOO_VALUES)[number];
```

**Rule 2** — Markdoc `matches` consumers:

```ts
import { FOO_VALUES } from "../_shared/types"; // or "../../lib/schemas"

// in schema.ts:
matches: FOO_VALUES as unknown as string[]
```

**Rule 3** — Keystatic `fields.select` consumers:

```ts
options: FOO_VALUES.map((v) => ({ label: FOO_LABELS[v] ?? v, value: v }))
```

If the display label differs from the value (e.g. `"H1"` vs `"h1"`), colocate
a sibling labels record next to the const:

```ts
export const FOO_LABELS: Record<FooValue, string> = {
  a: "Alpha",
  b: "Beta",
  c: "Gamma",
};
```

**Rule 4** — `content.config.ts` (Astro zod v4) consumers:

```ts
import { FOO_VALUES } from "./lib/schemas";

z.enum(FOO_VALUES)
```
