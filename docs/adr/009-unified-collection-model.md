# ADR-009: Unified Collection model for musician-site

## Status
Proposed

## Context

ADR-007 established the musician-site template as Next.js + Puck, with two
parallel data systems:

- **Pages.** Stored as Puck JSON at `src/content/pages/<slug>.json`. Each
  page has a fixed root-level schema (title, isSplashPage, isFooterHidden)
  and a body of dragged-and-dropped blocks.
- **Singletons.** Stored as JSON at `src/content/config/{site,header,appearance}.json`,
  edited via dedicated forms at `/admin/{settings,navigation,appearance}`.
- **Collections** (releases, tour dates, posts, store items, photos, videos)
  were planned to remain Zod-validated files, with block configs in Puck
  consuming them. ADR-007 §3 made block configs an exception to the
  cross-system SSOT rule.

Three product requirements emerged while planning the collection editors
that the original split can't accommodate cleanly:

1. **Artists should be able to fully edit every collection's schema** — add
   fields, remove fields, rename, reorder, change types. A "Tour dates"
   collection ships with a sensible default schema (date / venue / city /
   status / ticketUrl), but the artist can rework it to fit their site.
   Prebaked schemas are conveniences, not contracts.
2. **The visual layout of how a collection item renders should itself be
   editable** in the same Puck-style direct-manipulation surface as page
   bodies — drag blocks, position elements, set sizes — with block props
   bindable to item fields (a Text block whose content is `{{venue}}`).
3. **Every collection item should get a per-item detail URL** at a
   collection-configured prefix (`/shows/<slug>`, `/news/<slug>`, etc.).

Pursuing those three jointly surfaced an architectural opportunity: **a
page is structurally the same as a collection item.** A page has a slug, a
title, a Puck-edited body, and a URL. A collection item has a slug, named
field values, and a URL. If we generalise, Pages becomes one collection
among many — special only in the admin UI affordances it gets, not in the
data layer.

This ADR records that generalisation and the design decisions that follow
from it.

## Decision

Introduce a single `Collection` abstraction. Every editable surface on a
musician site — pages, singletons, tour dates, releases, posts, store
items, photos, videos — is a collection. Each collection owns its own
schema, items, and per-item rendering template. Cross-cutting features
(storage, validation, publish, routing, editor UI) are implemented once
against the generic abstraction.

### 1. Core types

```ts
// Stable identity for fields so renames don't break item references.
type FieldId = string;        // UUID-ish; never visible to the artist
type FieldKey = string;       // current name; renameable

type FieldDef =
  | { id: FieldId; key: FieldKey; type: "text"; required: boolean; maxLength?: number }
  | { id: FieldId; key: FieldKey; type: "longText"; required: boolean }
  | { id: FieldId; key: FieldKey; type: "richText"; required: boolean }       // Tiptap JSON
  | { id: FieldId; key: FieldKey; type: "number"; required: boolean; min?: number; max?: number; step?: number }
  | { id: FieldId; key: FieldKey; type: "boolean"; default?: boolean }
  | { id: FieldId; key: FieldKey; type: "select"; required: boolean; options: SelectOption[] }
  | { id: FieldId; key: FieldKey; type: "multiSelect"; options: SelectOption[] }
  | { id: FieldId; key: FieldKey; type: "date"; required: boolean; includeTime?: boolean }
  | { id: FieldId; key: FieldKey; type: "url"; required: boolean }
  | { id: FieldId; key: FieldKey; type: "email"; required: boolean }
  | { id: FieldId; key: FieldKey; type: "color"; required: boolean }
  | { id: FieldId; key: FieldKey; type: "image"; required: boolean }          // uses existing image pipeline
  | { id: FieldId; key: FieldKey; type: "file"; required: boolean; mimeFilter?: string[] }   // covers audio, PDF, etc.
  | { id: FieldId; key: FieldKey; type: "collectionRef"; required: boolean; targetCollection: string }
  | { id: FieldId; key: FieldKey; type: "puckContent" };                      // full Puck block layout

type CollectionDef = {
  slug: string;                  // "pages" | "tourDates" | "releases" | …
  singularName: string;          // "page" | "tour date"
  pluralName: string;            // "pages" | "tour dates"
  urlPrefix: string | null;      // "/", "/shows", "/news"; null = no public URLs
  fields: FieldDef[];
  slugSourceFieldId: FieldId | null;   // field used to derive slugs from; null = manual
  defaultSort: { fieldId: FieldId; direction: "asc" | "desc" } | null;
  itemTemplate: PuckData | null;   // compact rendering for list contexts; excludes view blocks (§4)
  detailTemplate: PuckData | null; // detail-page rendering at <urlPrefix>/<slug>; view blocks allowed
  listTemplate: PuckData | null;   // optional default list-page layout (the wrapper around items)
  isSingleton: boolean;            // true for settings/header/appearance: hides item-list UI
};

type FieldValue =
  | { type: "text"; value: string }
  | { type: "longText"; value: string }
  | { type: "richText"; value: TiptapJSON }
  | { type: "number"; value: number }
  | { type: "boolean"; value: boolean }
  | { type: "select"; value: string }
  | { type: "multiSelect"; value: string[] }
  | { type: "date"; value: string }                  // ISO 8601
  | { type: "url"; value: string }
  | { type: "email"; value: string }
  | { type: "color"; value: string }                 // #rrggbb
  | { type: "image"; value: ImageMetadata }
  | { type: "file"; value: { src: string; mimeType: string; originalName: string; sizeBytes: number } }
  | { type: "collectionRef"; value: { collection: string; itemId: string } }
  | { type: "puckContent"; value: PuckData };

type Item = {
  id: string;                     // stable; never reused
  slug: string;                   // URL slug; unique within collection
  values: Record<FieldId, FieldValue>;
};
```

`FieldDef` and `FieldValue` are exhaustive discriminated unions: every
consumer that walks fields or values gets compile-time exhaustiveness
checks. `Item.values` is `Record<FieldId, FieldValue>` — type-safe at the
*kind* level but not at the *which-fields-are-present* level (see §10).

### 2. Pages as a collection

Pages stop being a special data path. The "pages" collection ships with:

```ts
{
  slug: "pages",
  singularName: "page",
  pluralName: "pages",
  urlPrefix: "/",
  isSingleton: false,
  fields: [
    { id: "fld_title",       key: "title",          type: "text",       required: true },
    { id: "fld_isSplash",    key: "isSplashPage",   type: "boolean" },
    { id: "fld_hideFooter",  key: "isFooterHidden", type: "boolean" },
    { id: "fld_showInNav",   key: "showInNav",      type: "boolean" },   // Goal 2 (nav→pages) folds in here
    { id: "fld_navOrder",    key: "navOrder",       type: "number" },    // ordering for nav
    { id: "fld_body",        key: "body",           type: "puckContent" },
  ],
  slugSourceFieldId: "fld_title",
  defaultSort: { fieldId: "fld_navOrder", direction: "asc" },
  itemTemplate: <compact "page link" card for sitemap-style listings>,   // optional
  detailTemplate: <Puck-edited surface that renders the body field>,
}
```

Pages today edit the body directly in a full Puck workspace. In the new
model, the workspace is the detailTemplate editor with the body field
"pinned" as its content surface — same UX, generic implementation
underneath. The itemTemplate is optional: Pages rarely appear inside view
blocks, but providing one (title + excerpt, say) enables a "Recent pages"
or "Site map" view block if the artist wants one.

The Pages collection retains its sidebar entry and its specialised "add
page" affordance because it's the foundational surface — but it executes
on the generic stack. The `/admin/pages` route becomes a thin
view-customiser over `/admin/collections/pages`.

### 3. Singletons as 1-item collections

`site`, `header`, `appearance` become collections with `isSingleton: true`.
A singleton collection hides the item-list UI and routes
`/admin/collections/<slug>` directly to the single item's editor. The
existing `/admin/{settings,navigation,appearance}` routes survive as
aliases backed by the generic editor — same code path as every other
collection — keeping muscle memory and search-engine-style discoverability
in the admin sidebar.

A future "Settings" surface can group several singleton collections under
one screen without changing the storage model.

### 4. Item template, detail template, and data binding

Every collection has up to two Puck-edited templates, both composed from
the *display block library* whose blocks support data binding:

- **`itemTemplate`** — how one item renders in **list contexts** (inside a
  view block on another page; in the default list-page rendering). This
  is the compact card / row layout. Display blocks only.
- **`detailTemplate`** — how one item renders on its **detail page** at
  `<urlPrefix>/<slug>`. Display blocks **plus** view blocks. This is
  where the artist composes the full per-item page layout (the body of a
  tour-date detail page, the layout of a release detail page, the body
  of a Pages page).

The display block library:

- **Layout blocks**: Section, Stack (vertical / horizontal), Spacer, Columns
- **Display blocks**: Text, RichText, Image, Button, Link, Embed, Audio
- **Composition**: implicit hide-if-empty on bindable props (no explicit
  Conditional block in v1)

Every bindable prop accepts either a literal value or a binding:

```ts
type Bindable<T> =
  | { kind: "literal"; value: T }
  | { kind: "binding"; fieldId: FieldId };
```

Concretely: a Text block's `content` is `Bindable<string>`. The artist
toggles a small switch in the block's inspector between "literal" and
"bind to field"; "bind to field" surfaces a dropdown of available fields
of compatible type. An Image block's `src` is `Bindable<ImageMetadata>`,
restricted to image fields. A "Render field" composition block resolves a
`puckContent` or `richText` field at the chosen position. And so on.

The **template renderer** walks the Puck JSON tree, resolves bindings
against the item's `values`, and renders the result. A bound prop whose
field is empty causes the block to render nothing (implicit conditional
rendering) — explicit `Conditional` blocks for richer rules can come
later.

The item-template and detail-template editors are both Puck `<Puck>`
instances with template-specific configs. They live at
`/admin/collections/<slug>/template/item` and `…/template/detail`.
Editing either re-renders a preview against a representative item (the
first item, or a placeholder if the collection is empty).

**Cycle safety by structural rule.** The cycle worry is real (a tour-date
itemTemplate that embeds a TourDatesView, which renders tour-date items
via the same itemTemplate, recurses infinitely). The structural rule is
simple:

> **`itemTemplate` cannot contain view blocks. `detailTemplate` and any
> rendered `puckContent` field can.**

This makes cycles impossible by construction:

- A view block always renders its source items via the source collection's
  `itemTemplate`, which by rule cannot contain view blocks. Recursion
  terminates after one level.
- A `puckContent` field's contents are rendered only when the renderer is
  in detail-template context (i.e. via a "Render field" block placed in a
  detailTemplate, or via the body of the Pages collection's
  detailTemplate). View blocks inside that puckContent recurse one level
  into itemTemplates, which are again view-block-free.
- An `itemTemplate` may bind a `puckContent` field — view blocks inside
  that puckContent value are stripped at render time (runtime guard for
  the niche case where someone constructs this configuration).
- Cross-collection collectionRef chains that form a runtime cycle (release
  A references release B references release A) are detected at render
  time and rendered as a placeholder.

Collections are **fully universal**: any collection can have items with
puckContent fields edited in a full Puck workspace, any item can have a
rich detail-page layout that embeds other collections' items, and per-item
bodies behave the same on pages and on releases or shows or anywhere else.

### 5. View blocks on pages

A page's `body` (a PuckContent field) is edited in the existing
`/admin/pages/<slug>` Puck editor, whose config registers — in addition to
the display block library — one **view block per existing collection**.
A view block embeds a collection on the page:

```ts
TourDatesView: {
  fields: {
    sourceCollection: { type: "internal", value: "tourDates" },
    filter: { type: "object", objectFields: { … per-field filters … } },
    sort: { type: "select", options: [ … fields and directions … ] },
    limit: { type: "number" },
    hideFields: { type: "array", arrayFields: { fieldId: { type: "select", options: [ … field list … ] } } },
    styleOverrides: { type: "custom", render: StyleOverrideField },  // light knobs only
  },
  defaultProps: { … },
  render: (props) => <RenderCollectionView {...props} />,
}
```

`<RenderCollectionView>` loads items from the source collection, applies
filter / sort / limit / hideFields, and renders each item through that
collection's item template. The artist gets a "Manage tour dates →"
button in the view block's inspector that navigates to
`/admin/collections/tourDates`.

View blocks are registered dynamically: at editor mount, the admin reads
the list of collections from disk and injects one view block per
collection into the page-body Puck config. Adding a new collection
automatically makes it embeddable on any page.

### 6. Field-type palette (v1)

| Type           | Storage                                                          | Notes                                    |
| -------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| `text`         | `string`                                                         | optional `maxLength`                     |
| `longText`     | `string`                                                         | multi-line plain text                    |
| `richText`     | Tiptap JSON                                                      | inline formatting only — no block layout |
| `number`       | `number`                                                         | optional `min` / `max` / `step`          |
| `boolean`      | `boolean`                                                        |                                          |
| `select`       | `string`                                                         | options on the field def                 |
| `multiSelect`  | `string[]`                                                       | options on the field def                 |
| `date`         | ISO 8601 `string`                                                | optional `includeTime`                   |
| `url`          | `string`                                                         | validated as URL                         |
| `email`        | `string`                                                         | validated as email                       |
| `color`        | `#rrggbb` `string`                                               |                                          |
| `image`        | `ImageMetadata` (uses existing pipeline)                         |                                          |
| `file`         | `{ src, mimeType, originalName, sizeBytes }`                     | `mimeFilter` covers audio / PDF / etc.   |
| `collectionRef`| `{ collection, itemId }`                                         | resolved on read                         |
| `puckContent`  | Puck `Data`                                                      | full block layout — only on Pages        |

`richText` is distinct from `puckContent`: richText is inline prose
formatting *within one field* (bold, italic, links, lists), puckContent is
block-level layout composition. A puckContent surface internally uses
richText for its Text blocks. Composition, not duplication.

### 7. Storage layout

```
src/content/collections/<collection-slug>/
  _collection.json          # CollectionDef (schema, item + detail + list templates, settings)
  items/<item-slug>.json    # one Item per file
```

Both the collection definition AND the items are committed to git.
Artists own everything end-to-end; the prebaked collections ship as
default `_collection.json` files the artist can freely modify.

Singletons store their single item at `items/_singleton.json`.

The existing pages directory (`src/content/pages/`) moves to
`src/content/collections/pages/items/` as part of the foundation PR
(§13). Existing singletons (`src/content/config/*.json`) move to
`src/content/collections/{site,header,appearance}/items/_singleton.json`.

### 8. Routing

Each collection's `urlPrefix` determines its public routes:

- `urlPrefix: "/"` — items render at `/<itemSlug>`. The Pages collection
  uses this.
- `urlPrefix: "/shows"` — items render at `/shows/<itemSlug>`. List view
  at `/shows` (rendered via the collection's `listTemplate` or a default
  template if null).
- `urlPrefix: null` — no public routes. Useful for collections that exist
  only to feed view blocks (e.g. a "Quotes" collection embedded on the
  About page but with no detail pages).

Next.js dynamic routes are generated at build time from the collection
list. A single `[...slug]` catch-all at the public root dispatches by
walking the collection registry, matching `urlPrefix` + `itemSlug`.

### 9. Editor surfaces

```
/admin
  /collections                            Index: list of all collections
  /collections/<slug>                     List view (or item editor if singleton)
  /collections/<slug>/items/new           New item form
  /collections/<slug>/items/<itemSlug>    Item editor
  /collections/<slug>/schema              Schema editor (fields)
  /collections/<slug>/template/item       Item template editor (Puck, display blocks only)
  /collections/<slug>/template/detail     Detail template editor (Puck, display + view blocks)
  /pages                                  Pages list — view alias over /collections/pages
  /pages/<slug>                           Page editor — view alias over /collections/pages/items/<slug>
  /settings                               Settings — view alias over /collections/site/items/_singleton
  /navigation                             Header & Nav — view alias over /collections/header
  /appearance                             Appearance — view alias over /collections/appearance
```

The **generic item editor** inspects the collection's field list and
renders the appropriate input per field via the existing admin form
primitives (TextField, SelectField, NumberField, etc.) plus new primitives
for the v1 types (DateField, ColorField, FileField, RichTextField,
CollectionRefField). If any field is `puckContent`, that field renders as
a full Puck workspace (the canvas); other fields move into the right-hand
inspector alongside Puck's per-block inspector. Pages get the same
workspace they have today, automatically, because they're a collection
with a `puckContent` body — and the same applies to any other collection
the artist gives a `puckContent` field (e.g. a Release with a free-form
notes body, a Tour-date with show notes).

The **schema editor** lists fields with add / remove / rename / reorder /
edit-type. It enforces guardrails (§11) for destructive changes.

The **template editors** are two Puck instances per collection, sharing
the display block library. The item-template editor's config excludes
view blocks (per §4); the detail-template editor's config includes them.
Both edit fields on `_collection.json`.

### 10. Type-safety stance

The system is **statically typed at the framework level, runtime-typed at
the data level**:

- `FieldDef`, `FieldValue`, `CollectionDef`, `Item` are discriminated
  unions. Every renderer that walks them gets exhaustiveness from
  TypeScript.
- `Item.values` is `Record<FieldId, FieldValue>` at compile time —
  TypeScript can't know which fields a given collection has, because the
  schema is editable at runtime by the artist. This is the same trade
  Notion, Airtable, Sanity, and similar dynamic-schema systems make.
- **Runtime validation is strong.** When an item is read or written, a
  Zod schema is built dynamically from the collection's `fields` via
  `buildZodSchema(fields: FieldDef[]): ZodSchema`, and the item is parsed
  against it. Invalid items cannot be saved.
- **Runtime-narrowing accessors give ergonomic consumer code**:
  ```ts
  const venue = getText(item, collection, "fld_venue");
  // venue: string  — throws if the field doesn't exist or isn't text
  ```
  This is how hand-coded blocks consume specific fields.
- **Codegen is available as an escape hatch but not v1.** Because both
  prebaked AND artist-edited schemas live in git, a build-time step could
  walk every `_collection.json` and emit `.d.ts` files giving each
  collection a static row type. We defer this until the v1 runtime
  accessors prove insufficient for the kinds of hand-coded blocks we end
  up writing — for the generic template renderer (the 90% case) they are.

### 11. Schema-change guardrails

The schema editor enforces:

- **Stable field IDs.** Renaming a field changes only its `key`. The `id`
  is permanent. Item values reference fields by `id`, so renames are
  zero-migration.
- **Add field**: allowed freely. Existing items get `undefined` for the
  new field; required-field validation kicks in only for new items until
  the artist backfills.
- **Remove field**: warns "N items have data in this field; removal will
  delete it." Requires an explicit confirm.
- **Change required**: from optional → required is allowed only if all
  existing items have a value; otherwise the schema editor surfaces a
  "Fix N items first" link to a bulk-edit view.
- **Change type**: blocked. Type changes are almost always lossy; the
  artist must remove and recreate. Future versions may allow safe
  coercions (text ↔ longText, select option additions) with explicit
  opt-in.
- **Reorder fields**: free; affects display order in the item editor and
  in the default item template only.

### 12. Publish flow

The existing `publish.ts` is extended with new target kinds — collection
item upsert, collection item delete, collection definition upsert — all
routed through the same broker → GitHub → commit path with dev-disk
fallback. The Puck `onPublish` flow that today writes page JSON is
generalised to write any item.

Collection definitions and items publish independently: editing a tour
date doesn't republish the collection's schema, and editing the schema
doesn't republish items. Each is a separate commit on save.

### 13. Migration plan

The musician-site template is pre-1.0 and has few real-world users (the
template ships a seed site only). A clean cutover is preferable to a
feature flag.

The foundation PR (see §15) performs the migration:

1. Move `src/content/pages/*.json` → `src/content/collections/pages/items/*.json`
2. Move `src/content/config/{site,header,appearance}.json` →
   `src/content/collections/{site,header,appearance}/items/_singleton.json`
3. Generate `_collection.json` for each migrated collection from the
   existing Zod schemas (`siteConfigSchema`, etc. in
   `src/lib/site-config-types.ts`).
4. The old `lib/content.ts` page reader becomes a thin adapter over the
   collection store and is removed once all callers are migrated.
5. The existing `/admin/pages`, `/admin/settings`, `/admin/navigation`,
   `/admin/appearance` routes survive as aliases, calling the generic
   editor under the hood — no admin-UI regression.

External-facing API routes (`/api/publish`, `/api/pages`,
`/api/save-config`) keep their paths for back-compat in the same PR.

### 14. Goal 2 (navigation menu into Pages) folded in

The previously-separate Goal 2 ("remove the Navigation menu control and
fold reordering + visibility into the Pages list") is subsumed by this
ADR. The Pages collection ships with `showInNav: boolean` and
`navOrder: number` fields; the Pages list view supports drag-to-reorder
(updating `navOrder`) and an eye-icon toggle (updating `showInNav`). The
`/admin/navigation` route shrinks to header-style-only controls
(wordmark, mode, layout) and may merge into `/admin/settings` once the
nav-menu UI lives entirely in `/admin/pages`.

### 15. Shipping plan

Eight PRs, each independently reviewable and (where possible) mergeable:

1. **Foundation: types, storage, publish.** `CollectionDef`, `FieldDef`,
   `Item`, `FieldValue` types in a new package (or in
   `src/lib/collections/`). Zod builder. Item store (read / write / list /
   delete). Publish target kinds. No UI.
2. **Item template renderer + data binding primitives.** Display block
   library. Binding resolution. Renderer that takes a template + item and
   produces React. Unit-tested without the editor.
3. **Pages migration.** Move pages and singletons to the collection
   storage layout. Existing routes still work via aliases.
4. **Generic item editor.** Field-type-aware item editor. Pages start
   using it. (Pages-specific Puck editor stays inside it as the
   puckContent surface.)
5. **Schema editor UI.** Add / remove / rename / reorder / type changes
   with guardrails. Existing pages collection becomes editable.
6. **Template Puck editors.** Per-collection layout designers for both
   `itemTemplate` (display blocks only) and `detailTemplate` (display +
   view blocks). Shared editor shell with config differing only in which
   blocks are registered.
7. **First non-pages collection: tour dates.** Validates the full stack.
   Includes the `TourDatesView` block on pages, with the "Manage" button
   for navigation.
8. **Prebaked collections: releases, posts, store items, photos, videos.**
   Each adds a `_collection.json` and seed items. Small PRs at this point.

PRs 1–2 are foundation with no UI; 3–7 each ship a usable slice; 8 is
breadth on the same foundation.

## Rejected alternatives

- **Keep Pages and singletons separate from collections.** Original
  approach in ADR-007 §3. Rejected because the three new requirements
  (editable schemas, Puck-edited item templates, per-item URLs) apply to
  every editable surface — building them twice (once for Pages, once for
  collections) is wasteful, and unifying later is harder than unifying
  now while the template is pre-1.0.
- **Static per-collection schemas in Zod, no artist editing.** What
  ADR-007 §3 prescribed. Simpler to implement and gives compile-time type
  safety on item shape. Rejected because the artist's freedom to evolve
  the schema is a stated requirement, and our customer base (musicians
  with idiosyncratic site needs) benefits more from flexibility than from
  framework-side IntelliSense on field names.
- **Collection items as Puck slot children of a parent block.** Tour dates
  rendered as a Puck `TourDatesList` block with a slot, each child a
  `TourDateItem` block. Editing is native Puck drag-and-drop. Rejected
  because it precludes cross-page data sharing (items live in one page's
  JSON), per-item URLs, and centralised editing — all stated requirements.
- **Codegen of static row types in v1.** Build-time generation of `.d.ts`
  files from each `_collection.json`, giving each collection a typed
  `Item<TourDates>`. Defensible, but deferred to keep the v1 build simple
  and because runtime-narrowing accessors cover the generic-renderer case
  that dominates this codebase. Revisit if a critical mass of bespoke
  blocks emerges that benefit from compile-time field-name checking.
- **Built-in conditional / expression blocks in the v1 item template.**
  Considered an `If` / `Switch` block with a small expression language for
  the template. Rejected for v1 in favour of implicit hide-if-empty
  rendering, which covers the common case (don't show the ticket button
  if there's no ticket URL) without an expression language.
- **External CMS engine (Sanity, Tina, Keystatic) as the data layer.**
  Sanity is hosted and proprietary (fails the file-based requirement).
  Tina and Keystatic have static schemas (fail the editable-schema
  requirement). Rolling our own keeps full control over the artist's
  authoring experience, which is the product differentiator.

## Consequences

- **ADR-007 §3 is superseded.** Collections no longer use static Zod
  schemas in `src/lib/schemas.ts`; the schema is dynamic, per
  `_collection.json`, validated at runtime via a Zod schema built from
  `FieldDef[]`. The existing Zod schemas in `site-config-types.ts` move
  into collection definitions during the foundation PR and are then
  removed.
- **Most of the existing admin code becomes thin aliases.** The
  `useSettingsForm` hook, the bespoke `SiteSettingsForm` /
  `NavigationForm` / `AppearanceForm` components, and the
  `/admin/pages/PagesPanel` evolve into generated equivalents that the
  generic item editor renders. The existing files become routing aliases
  with minimal logic. Net code reduction over time despite the new
  abstraction layer.
- **One Puck config per surface, all dynamically composed.** The page-body
  Puck config registers display blocks + view blocks (one per existing
  collection). The item-template Puck config registers display blocks
  with binding controls. The two configs are derived from the collection
  registry at render time, not hand-maintained.
- **Foundational refactor of the publish layer.** Page-specific publish
  targets are replaced with collection-item targets. Migration logic
  inside the publish layer covers the cutover for in-flight artists.
- **Build-time route generation depends on the collection registry.**
  Next.js's static export reads the collection list at build time to
  generate dynamic routes. A misconfigured collection (e.g. two
  collections claiming `urlPrefix: "/"`) is caught at build, not runtime.
- **No SSR for the public site (carry-over from ADR-007).** Item template
  rendering happens at build time. A collection with frequently-changing
  items requires a rebuild on each change; current artist scale makes
  this acceptable. Revisit if a collection emerges whose items change
  faster than a rebuild cycle (~minutes).
- **Schema editing is powerful and corruptive.** Guardrails (§11) mitigate
  but don't eliminate the risk of an artist accidentally damaging their
  data. v1 protects with confirmations and blocks the riskiest changes
  (type changes); future evolution may add an undo / version log on top
  of the existing git history.
- **The legacy template is unaffected.** This ADR applies only to
  `templates/musician-site/`. The legacy Astro + Keystatic template at
  `templates/musician-site-legacy/` keeps its static Zod schemas and
  Keystatic-driven editor.
- **Codegen remains a future option.** Layer-3 type safety (compile-time
  row types) can be added later without breaking the runtime model. The
  runtime accessors and the codegen output would be drop-in replacements
  for each other in consumer code.

## Supersedes

- **ADR-007 §3** ("Schema split: Puck-native blocks, Zod for collections")
  in full. ADR-007 §1, §2, §4-§8 remain in force.
