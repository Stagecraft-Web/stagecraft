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

## Glossary

Defined here once; used throughout the rest of the ADR.

- **Collection.** A named type of content (`pages`, `tourDates`,
  `releases`, …). Owns a schema, a set of items, and one or more
  templates. Configured by a `CollectionDef` stored at
  `src/content/collections/<slug>/_collection.json`.
- **CollectionDef.** The TypeScript shape that describes a collection:
  identity (slug, names), schema (fields), templates (item / detail /
  list), routing (detail URL prefix), ordering, and feature flags
  (`isSingleton`).
- **Item.** One entry in a collection — one tour date, one release, one
  page. Stored at `src/content/collections/<slug>/items/<itemSlug>.json`.
- **Schema.** The set of `FieldDef`s on a collection. Editable by the
  artist via the schema editor (§11 guardrails apply).
- **Field.** One configurable attribute on items in a collection — for
  tour dates, that's "date", "venue", "city", "status", "ticketUrl".
- **FieldDef.** The TypeScript shape describing one field — its id, key,
  type, required-ness, and any type-specific config (options, mime
  filters, etc.).
- **FieldId.** Internal stable identity of a field (UUID-ish). Never
  visible to the artist. Item values reference fields by id, so renaming
  is free.
- **FieldKey.** Artist-facing name of a field ("venue"). Renameable
  without breaking item values, because the id stays put.
- **FieldValue.** A typed value held by an item for one field — a
  discriminated union over the field types.
- **Primitive block.** A building-block React component used to compose
  templates and page bodies. Three sub-kinds:
  - **Layout primitive**: `Section`, `Stack`, `Columns`, `Spacer`.
  - **Content primitive**: `Text`, `RichText`, `Image`, `Button`,
    `Link`, `Embed`, `Audio`.
  - **Field-render primitive**: `RichTextRender`, `PuckContentRender` —
    placeholder blocks whose only purpose is to render a richText or
    puckContent field at this position in a template.
- **Collection block.** A block that embeds an entire collection on a
  page or detail template — `TourDatesView`, `ReleasesView`, etc. At
  render time, it loads items from its source collection and renders
  each via the source collection's **itemTemplate**.
- **Template.** A piece of Puck JSON describing a per-item layout.
  Three kinds, all optional per collection:
  - **itemTemplate** — how an item renders when listed inside a
    Collection block (compact card / row). Built from Primitive blocks
    only. No Collection blocks (§4 cycle safety).
  - **detailTemplate** — how an item renders on its own detail page at
    `<detailUrlPrefix>/<slug>`. Built from Primitive blocks plus
    Collection blocks.
  - **listTemplate** — optional default layout for an auto-generated
    list page (e.g. an automatic `/shows` index). When null, the artist
    builds the list page as a regular Page that contains the
    appropriate Collection block.
- **Bindable\<T\>.** A prop value that can be either a literal of type
  `T` or a binding to a field of compatible type. Resolved at render
  time. Only meaningful inside templates (§4).
- **Binding.** The specific case of a `Bindable` whose value comes from
  a field rather than a literal.
- **Detail page.** The per-item public URL at
  `<detailUrlPrefix>/<itemSlug>`. Optional — a collection can have items
  with no detail pages (e.g. a "Quotes" collection that only exists to
  feed Collection blocks).
- **Singleton.** A collection with exactly one item, used for site-level
  settings (`site`, `header`, `appearance`). The admin UI hides item-list
  affordances and routes the collection's URL straight to the editor for
  its single item.
- **collectionRef / multiCollectionRef.** Field types whose value is a
  reference (or ordered list of references) to items in another
  collection. The target collection is fixed on the `FieldDef`; the
  value stores just item id(s). See §6 for the three-way distinction
  between `collectionRef`, `multiCollectionRef`, and a filtered
  Collection block.
- **Current-item context.** The item being rendered by the surrounding
  template. Threaded through the renderer so that Collection-block
  filters can reference the current item via
  `{ kind: "currentItem", field: … }` (§5.1). For Pages, the page
  itself is the current item; for any other collection's
  detailTemplate, the item being shown.
- **systemLocked.** Flag on a `FieldDef` marking it as non-editable by
  the artist (cannot be deleted, renamed, or retyped via the schema
  editor). Used for prebaked fields the renderer or routing depends on,
  e.g. `Pages.title` and `Pages.body`.

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

// Every variant carries these in addition to its type-specific fields:
//   id          stable internal identifier
//   key         artist-facing name
//   systemLocked? `true` on prebaked fields the artist must not delete,
//                 rename, or retype (e.g. Pages.title, Pages.body).
//                 Enforced in the schema editor (PR 5); code-driven
//                 template migrations can still rewrite these by
//                 editing the JSON directly.
type FieldDef =
  | { /* base */ type: "text"; required: boolean; maxLength?: number }
  | { /* base */ type: "longText"; required: boolean }
  | { /* base */ type: "richText"; required: boolean }       // Tiptap JSON
  | { /* base */ type: "number"; required: boolean; min?: number; max?: number; step?: number }
  | { /* base */ type: "boolean"; default?: boolean }
  | { /* base */ type: "select"; required: boolean; options: SelectOption[] }
  | { /* base */ type: "multiSelect"; options: SelectOption[] }
  | { /* base */ type: "date"; required: boolean; includeTime?: boolean }
  | { /* base */ type: "url"; required: boolean }
  | { /* base */ type: "email"; required: boolean }
  | { /* base */ type: "color"; required: boolean }
  | { /* base */ type: "image"; required: boolean }          // uses existing image pipeline
  | { /* base */ type: "file"; required: boolean; mimeFilter?: string[] }   // covers audio, PDF, etc.
  | { /* base */ type: "collectionRef"; required: boolean; targetCollection: string }
  | { /* base */ type: "multiCollectionRef"; targetCollection: string; minItems?: number; maxItems?: number }
  | { /* base */ type: "puckContent" };                      // full Puck block layout

type CollectionDef = {
  slug: string;                       // "pages" | "tourDates" | "releases" | …
  singularName: string;               // "page" | "tour date"
  pluralName: string;                 // "pages" | "tour dates"

  // ── Schema ──────────────────────────────────────────────────────
  fields: FieldDef[];
  slugSourceFieldId: FieldId | null;  // field used to derive slugs from; null = manual

  // ── Routing ─────────────────────────────────────────────────────
  // Detail pages are independent of listTemplate. A collection can be
  // embedded in Collection blocks without having public detail pages
  // (e.g. a Quotes collection), and can have detail pages without an
  // auto-generated list page (the artist builds the list page as a
  // regular Page that hosts the relevant Collection block).
  detailUrlPrefix: string | null;     // "/", "/shows", "/news"; null = no detail pages

  // ── Ordering ────────────────────────────────────────────────────
  defaultSort:
    | { mode: "manual" }                                          // see §7 _order.json
    | { mode: "fieldSort"; fieldId: FieldId; direction: "asc" | "desc" }
    | null;                                                       // null = filesystem order

  // ── Templates (all optional) ────────────────────────────────────
  itemTemplate: PuckData | null;      // compact rendering inside Collection blocks; Primitives only (§4)
  detailTemplate: PuckData | null;    // detail-page rendering; Primitives + Collection blocks
  listTemplate: PuckData | null;      // optional auto-generated list page; null = author as a Page

  // ── Flags ───────────────────────────────────────────────────────
  isSingleton: boolean;               // true for settings/header/appearance: hides item-list UI
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
  | { type: "collectionRef"; value: { itemId: ItemId } }         // target collection comes from FieldDef
  | { type: "multiCollectionRef"; value: ItemId[] }              // ordered; target collection comes from FieldDef
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
  detailUrlPrefix: "/",                                                // each page at /<slug>
  isSingleton: false,
  fields: [
    { id: "fld_title",       key: "title",          type: "text",       required: true },
    { id: "fld_isSplash",    key: "isSplashPage",   type: "boolean" },
    { id: "fld_hideFooter",  key: "isFooterHidden", type: "boolean" },
    { id: "fld_showInNav",   key: "showInNav",      type: "boolean" },  // Goal 2 (nav→pages) folds in here
    { id: "fld_body",        key: "body",           type: "puckContent" },
  ],
  slugSourceFieldId: "fld_title",
  defaultSort: { mode: "manual" },                                     // artist drags pages in /admin/pages
  itemTemplate: <compact "page link" card for sitemap-style listings>, // optional
  detailTemplate: <Puck template rendering the body field>,
  listTemplate: null,                                                  // pages list is admin-only, no public list page
}
```

Pages today edit the body directly in a full Puck workspace. In the new
model, the workspace is the detailTemplate editor with the body field
"pinned" as its content surface — same UX, generic implementation
underneath. The itemTemplate is optional: Pages rarely appear inside view
blocks, but providing one (title + excerpt, say) enables a "Recent pages"
or "Site map" Collection block if the artist wants one.

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

### 4. Templates and data binding

Every collection has up to three templates (all optional, see Glossary):
**itemTemplate**, **detailTemplate**, **listTemplate**. All are Puck JSON
authored in a Puck editor specifically for templates.

The two block kinds — **Primitive blocks** and **Collection blocks** —
are also defined in the Glossary. Recapping the relationship:

- itemTemplate may use **Primitive blocks only**.
- detailTemplate and listTemplate may use **Primitive blocks plus
  Collection blocks**.

#### 4.1 Bindings: how a Primitive block knows what to render

A template is rendered many times against different items (the
itemTemplate renders once per item in a Collection block; the
detailTemplate renders for each item visiting its detail page). The
artist authors the template once; the renderer fills in field values per
item. The mechanism is **bindings**.

Every Primitive block's content-bearing prop is typed `Bindable<T>`:

```ts
type Bindable<T> =
  | { kind: "literal"; value: T }
  | { kind: "binding"; fieldId: FieldId };
```

The artist controls this prop's `kind` from the block's inspector in the
template editor. The inspector shows a small toggle (literal ↔ field)
above each bindable input.

**Worked example.** Artist is editing the tour-dates `itemTemplate` at
`/admin/collections/tourDates/template/item`. They drop a Stack and add
two Text blocks inside it.

For the first Text block ("Venue label"), they want the same word on
every card:

```
Inspector → Text block
─────────────────────────────────────
Content:    [● Literal]  [○ From field]

            ┌─────────────────────────┐
            │ Where:                  │
            └─────────────────────────┘
```

For the second Text block ("Venue value"), they want each card to show
its tour-date's venue:

```
Inspector → Text block
─────────────────────────────────────
Content:    [○ Literal]  [● From field]

            ┌─────────────────────────┐
            │ ▼ venue   (text)        │
            └─────────────────────────┘
              Choices: title, venue,
              city, ticketUrl
              (only text-typed fields
              of this collection)
```

The stored template snippet for the two blocks:

```json
[
  { "type": "Text", "props": { "content": { "kind": "literal", "value": "Where:" } } },
  { "type": "Text", "props": { "content": { "kind": "binding", "fieldId": "fld_venue" } } }
]
```

When the renderer encounters a `kind: "binding"` prop, it looks up
`item.values[fieldId]` and uses that value. A binding to an empty /
missing field renders nothing (implicit hide-if-empty; explicit
conditional blocks can come later).

The field-picker dropdown is type-filtered: a Text block's `Bindable<string>`
prop offers only `text` / `longText` / `select` / `url` / `email` fields.
An Image block's `Bindable<ImageMetadata>` prop offers only `image`
fields. Type-incompatible bindings can't be authored.

**Bindings exist only in templates.** When the artist edits a *specific
item's* puckContent field (e.g. authoring the body of a particular page),
every block's prop is just a literal — there's no "field" to bind to,
because the artist is producing this item's data, not a template to be
filled in by many items.

#### 4.2 Rendering rich/composite fields: field-render primitives

`Bindable<T>` works for scalar props (a string, an image metadata, a
URL). For richText and puckContent fields — which carry block-shaped
content of their own — bindings are expressed as dedicated **field-render
primitives**:

- `RichTextRender { field: FieldId }` — renders a richText field's
  Tiptap content at this position.
- `PuckContentRender { field: FieldId }` — renders a puckContent field's
  full Puck JSON at this position.

Conceptually these are still "bindings of `kind: binding`" — just
expressed as their own block types rather than as a `Bindable` on a
generic content prop, because they expand into a block tree of their
own.

The Pages collection's detailTemplate is, in the simplest configuration,
a single `PuckContentRender { field: "fld_body" }` block. The artist can
add header / footer Primitives around it.

#### 4.3 Cycle safety by structural rule

The cycle worry is real: if a tour-date itemTemplate embedded a
TourDatesView (a Collection block sourcing tour dates), it would render
tour-date items via the same itemTemplate, which contains the view,
which renders items, …

The structural rule prevents this by construction:

> **itemTemplate cannot contain Collection blocks. detailTemplate,
> listTemplate, and any rendered puckContent field can.**

This guarantees termination:

- A Collection block renders source items via the source collection's
  itemTemplate. itemTemplate by rule contains no Collection blocks, so
  recursion terminates after one level.
- A puckContent field's contents are rendered via a `PuckContentRender`
  primitive, only legal inside detailTemplate / listTemplate. Collection
  blocks inside that puckContent render their source items via
  itemTemplates, which are Collection-block-free. Terminates.
- If an itemTemplate binds a puckContent field via `PuckContentRender`
  (an authoring oddity but not forbidden by types), Collection blocks
  inside that value are stripped at render time — runtime guard for the
  niche case.
- Cross-collection `collectionRef` chains that form a runtime cycle
  (release A → release B → release A) are detected at render and
  rendered as a placeholder.

Collections are **fully universal**: any collection can have items with
puckContent fields edited in a full Puck workspace, any item can have a
rich detail-page layout that embeds other collections' items, and
per-item bodies behave the same on pages and on releases or shows or
anywhere else.

#### 4.4 Template editor surfaces

Both template editors are Puck `<Puck>` instances with template-specific
configs. They live at:

- `/admin/collections/<slug>/template/item` — itemTemplate. Config
  registers Primitive blocks only.
- `/admin/collections/<slug>/template/detail` — detailTemplate. Config
  registers Primitive blocks + one Collection block per existing
  collection (dynamic, see §5).

Editing either re-renders a preview against a representative item (the
first item in the collection, or a placeholder item if the collection is
empty). The block inspector adds the literal/binding toggle described in
§4.1 to every bindable prop.

### 5. Collection blocks

A **Collection block** embeds an entire collection on a page or detail
template. One Collection block is registered per existing collection
(`PagesView`, `TourDatesView`, `ReleasesView`, …); the page-body Puck
editor and the detail-template Puck editor both include the full set in
addition to Primitive blocks.

```ts
TourDatesView: {
  fields: {
    sourceCollection: { type: "internal", value: "tour-dates" },   // not editable
    filter: { type: "custom", render: FilterField },               // see §5.1 below
    sort:   { type: "select", options: [ … fields × {asc, desc} … ] },
    limit:  { type: "number" },
    hideFields: { type: "array", arrayFields: { fieldId: { type: "select", options: [ … field list … ] } } },
    styleOverrides: { type: "custom", render: StyleOverrideField },  // light knobs only
  },
  defaultProps: { … },
  render: (props, ctx) => <RenderCollectionView {...props} currentItem={ctx.currentItem} />,
}
```

`<RenderCollectionView>` loads items from the source collection, applies
filter / sort / limit / hideFields, and renders each item through the
source collection's **itemTemplate**. The artist gets a "Manage tour
dates →" button in the Collection block's inspector that navigates to
`/admin/collections/tour-dates`.

Collection blocks are registered dynamically: at editor mount, the admin
reads the list of collections from disk and injects one Collection block
per collection into the relevant Puck configs. Adding a new collection
automatically makes it embeddable everywhere Collection blocks are
permitted.

#### 5.1 Filter shape and current-item context

The filter is the main authoring surface for selecting which items to
render. Its on-disk shape is a small expression tree:

```ts
type FilterValue =
  | { kind: "literal"; value: unknown }
  | { kind: "currentItem"; field: FieldId | "_id" };   // resolved at render

type FilterClause =
  | { field: FieldId; op: "equals" | "notEquals"; value: FilterValue }
  | { field: FieldId; op: "in" | "notIn"; values: FilterValue[] }
  | { field: FieldId; op: "isEmpty" | "isNotEmpty" }
  | { field: FieldId; op: "gt" | "gte" | "lt" | "lte"; value: FilterValue }   // numbers + dates
  | { field: FieldId; op: "contains"; value: FilterValue }                    // text + longText
  | { excludeCurrentItem: true };                                             // shorthand for "not me"

type Filter =
  | { all: FilterClause[] }   // AND
  | { any: FilterClause[] };  // OR
```

`{ kind: "currentItem"; field: FieldId | "_id" }` is the central
mechanism that makes contextual rendering work. The renderer threads a
**current-item context** through every template — when rendering a
detail page, `currentItem` is the item being shown; when rendering a
Page, `currentItem` is that Page (Pages are items in the unified
model, so the context is always defined for any template).

This unlocks the patterns the platform needs:

```ts
// Tracks on the album detail page (intrinsic child→parent relationship)
filter: { all: [{
  field: "f_belongsToAlbum", op: "equals",
  value: { kind: "currentItem", field: "_id" },
}]}

// "More releases by me" on a release detail page
filter: { all: [{ excludeCurrentItem: true }] }

// "More shows on this tour"
filter: { all: [{
  field: "f_tourLeg", op: "equals",
  value: { kind: "currentItem", field: "f_tourLeg" },
}]}

// "Upcoming shows" (no current-item dependency)
filter: { all: [{
  field: "f_status", op: "in",
  values: [{ kind: "literal", value: "on_sale" }],
}]}
```

The editor UI for the filter (PR 5/6) renders a clause builder that
hides `currentItem` complexity behind plain-English wording ("matches
the current item's tour leg"). The on-disk shape is the source of
truth.

### 6. Field-type palette (v1)

| Type                 | Storage                                      | Notes                                         |
| -------------------- | -------------------------------------------- | --------------------------------------------- |
| `text`               | `string`                                     | optional `maxLength`                          |
| `longText`           | `string`                                     | multi-line plain text                         |
| `richText`           | Tiptap JSON                                  | inline formatting only — no block layout      |
| `number`             | `number`                                     | optional `min` / `max` / `step`               |
| `boolean`            | `boolean`                                    |                                               |
| `select`             | `string`                                     | options on the field def                      |
| `multiSelect`        | `string[]`                                   | options on the field def                      |
| `date`               | ISO 8601 `string`                            | optional `includeTime`                        |
| `url`                | `string`                                     | validated as URL                              |
| `email`              | `string`                                     | validated as email                            |
| `color`              | `#rrggbb` `string`                           |                                               |
| `image`              | `ImageMetadata` (uses existing pipeline)     |                                               |
| `file`               | `{ src, mimeType, originalName, sizeBytes }` | `mimeFilter` covers audio / PDF / etc.        |
| `collectionRef`      | `{ itemId }`                                 | one ref; target collection comes from FieldDef |
| `multiCollectionRef` | `ItemId[]`                                   | ordered array; target collection from FieldDef |
| `puckContent`        | Puck `Data`                                  | full block layout                             |

`richText` is distinct from `puckContent`: richText is inline prose
formatting *within one field* (bold, italic, links, lists), puckContent is
block-level layout composition. A puckContent surface internally uses
richText for its Text blocks. Composition, not duplication.

**`collectionRef` vs `multiCollectionRef` vs filtered Collection block.**
Three ways to express "one thing relates to others." Use:

- **`collectionRef`** for a single curated link (`page.featuredRelease`).
- **`multiCollectionRef`** for an ordered, per-parent-curated list
  (`page.featuredReleases`, `page.gallery`, `tourDate.supportActs`).
  The ordering lives on the parent.
- **Filtered Collection block** (§5) for an intrinsic child→parent
  relationship (`release.tracks` where each `track.belongsToAlbum`
  points to the release). The relationship lives on the child, and the
  parent's detailTemplate embeds a Collection block filtered by
  `belongsToAlbum = currentItem.id`. Use this when the child knows
  where it belongs by its nature; the artist edits from the child side.

### 7. Storage layout

```
src/content/collections/<collection-slug>/
  _collection.json          # CollectionDef (schema, item + detail + list templates, routing, sort)
  items/
    _order.json             # OPTIONAL — present only when defaultSort.mode === "manual"
    <item-slug>.json        # one Item per file
```

Both the collection definition AND the items are committed to git.
Artists own everything end-to-end; the prebaked collections ship as
default `_collection.json` files the artist can freely modify.

Singletons store their single item at `items/_singleton.json`.

**`_order.json`** is the sole place ordering lives when the artist
chooses manual ordering. Its shape:

```json
["paris-2026-07-15", "berlin-2026-07-20", "london-2026-07-25"]
```

A list of item slugs. Items not present (e.g. a freshly-created item not
yet positioned) sort to the end. Drag-to-reorder in the admin rewrites
this file and triggers one publish commit. Renaming an item slug rewrites
both the item file and the order entry in a single commit. Deleting an
item removes its entry from `_order.json` in the same commit.

When `defaultSort.mode === "fieldSort"` or `defaultSort` is `null`,
`_order.json` is absent and items sort by the configured field (or by
filesystem order when null).

The existing pages directory (`src/content/pages/`) moves to
`src/content/collections/pages/items/` as part of the foundation PR
(§13). Existing singletons (`src/content/config/*.json`) move to
`src/content/collections/{site,header,appearance}/items/_singleton.json`.

### 8. Routing

A collection's `detailUrlPrefix` determines whether and where its items
get public detail pages:

- `detailUrlPrefix: "/"` — each item gets `/<itemSlug>`. The Pages
  collection uses this.
- `detailUrlPrefix: "/shows"` — each item gets `/shows/<itemSlug>`.
- `detailUrlPrefix: null` — no detail pages. The collection can still be
  embedded in a Collection block; items just have no individual URL.
  Useful for "Quotes", "FAQ entries", or any collection whose items
  exist only to populate other pages.

Whether a collection's *list page* (`/shows` as a list of all tour dates)
exists is independent:

- If `listTemplate` is set, the system auto-generates the list page at
  `detailUrlPrefix` (e.g. `/shows`).
- If `listTemplate` is null, no auto-list page is generated. To have a
  `/shows` page, the artist creates a Page (`/admin/collections/pages/items/new`,
  slug `shows`) and places a `TourDatesView` Collection block on it.
  This is the path we expect to be most common.

Next.js dynamic routes are generated at build time from the collection
registry. A single `[...slug]` catch-all at the public root dispatches
by reading the registry, matching the longest `detailUrlPrefix` first
(so `/shows` wins over `/`), then resolving the rest as the item slug.
Build-time conflict detection catches both:

- Two collections claiming the same `detailUrlPrefix` (e.g. two
  collections both at `/`).
- A Page slug colliding with another collection's prefix root (e.g.
  the artist creates a Page with slug `shows` while a tour-dates
  collection already has `detailUrlPrefix: "/shows"`).

Both cases fail the build with a structured error pointing at the
conflict — these can corrupt the public site if allowed at runtime.

### 9. Editor surfaces

```
/admin
  /collections                            Index: list of all collections
  /collections/<slug>                     List view (or item editor if singleton)
  /collections/<slug>/items/new           New item form
  /collections/<slug>/items/<itemSlug>    Item editor
  /collections/<slug>/schema              Schema editor (fields)
  /collections/<slug>/template/item       Item template editor (Puck, Primitive blocks only)
  /collections/<slug>/template/detail     Detail template editor (Puck, Primitive + Collection blocks)
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
the Primitive block library. The item-template editor's config excludes
Collection blocks (per §4); the detail-template editor's config includes
them.
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
  `buildItemFileSchema(fields: FieldDef[]): ZodSchema`, and the item is
  parsed against it. Invalid items cannot be saved. Bulk readers
  (`listItemsInOrder`) build the schema once per call and reuse it
  across every read — building per item is quadratic-ish on larger
  collections.
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
- **`systemLocked` fields** can't be deleted, renamed, or retyped from
  the schema editor. Pages.title and Pages.body are the canonical
  examples — the renderer and routing depend on them. Code-driven
  template migrations can still rewrite these by editing the JSON
  directly.
- **Add field**: allowed freely. Existing items get `undefined` for the
  new field; required-field validation kicks in only for new items until
  the artist backfills.
- **Remove field**: warns "N items have data in this field; removal will
  delete it." Requires an explicit confirm. (See "Counting affected
  items" in §"Known limitations" for the performance footnote.)
- **Change required**: from optional → required is allowed only if all
  existing items have a value; otherwise the schema editor surfaces a
  "Fix N items first" link to a bulk-edit view.
- **Change type**: lossless transitions are allowed with an inline
  preview of the migration:
  - `text` ↔ `longText` (string ↔ string)
  - `text` → `url` / `email` / `color` (only if every existing value
    parses against the new validator; otherwise blocked)
  - `select` → `multiSelect` (wrap each string in a 1-element array)
  - `multiSelect` → `select` (only if every item has at most one option
    selected; otherwise blocked)
  - adding new options to `select` / `multiSelect` (purely additive)
  
  Lossy transitions (e.g. `puckContent` → `text`, removing select
  options that are in use) remain blocked. Future versions may add
  more lossless coercions or a "convert with confirmation" path for
  intentional data loss.
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
ADR. The Pages collection ships with `defaultSort: { mode: "manual" }`
(so order is stored in `items/_order.json` per §7) and a `showInNav:
boolean` field. The Pages list view in the admin supports drag-to-reorder
(rewrites `_order.json`) and an eye-icon toggle (flips each page's
`showInNav`). The header reads the ordered list of Pages and filters by
`showInNav` to build the nav menu. The `/admin/navigation` route shrinks
to header-style-only controls (wordmark, mode, layout) and may merge into
`/admin/settings` once the nav-menu UI lives entirely in `/admin/pages`.

### 15. Shipping plan

Eight PRs, each independently reviewable and (where possible) mergeable:

1. **Foundation: types, storage, publish.** `CollectionDef`, `FieldDef`,
   `Item`, `FieldValue` types in a new package (or in
   `src/lib/collections/`). Zod builder. Item store (read / write / list /
   delete). Publish target kinds. No UI.
2. **Item template renderer + data binding primitives.** Primitive block
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
   `itemTemplate` (Primitive blocks only) and `detailTemplate` (Primitive +
   Collection blocks). Shared editor shell with config differing only in
   which blocks are registered.
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

## Known limitations and deferred work

The v1 design is deliberately scoped. The list below tracks the gaps
we know we'll hit and the rough plan for addressing each. These are
not bugs in the model; they're scope boundaries.

- **Nested-record fields (`array<{...}>`).** No way to model an
  array of structured sub-objects (e.g. `release.tracks` as an
  in-document array of `{title, duration}` rows). The v1 path for
  tracks is a separate `tracks` collection plus either a filtered
  Collection block on the album (intrinsic membership) or a
  `multiCollectionRef` (per-album curation). Revisit if usage shows
  the per-collection overhead is meaningfully worse than inline
  arrays would be.

- **Cross-collection ref integrity.** Deleting an item leaves dangling
  refs. v1 doesn't enforce or surface this — the renderer treats
  missing refs as "not present" (block doesn't render). A future pass
  should add a back-ref index built at write time so the schema and
  item editors can warn before delete.

- **Image lifecycle for items.** Images attached to an item are
  written under `public/images/<contentSlug>/<imageId>/`. Deleting
  the item doesn't garbage-collect its images. v1 accepts the
  drift; a periodic GC pass (script or build-time hook) can prune
  orphans later without touching this model.

- **Counting affected items for guardrails.** Schema-change guardrails
  in §11 ("N items have data in this field") require enumerating
  every item to count. v1 does the obvious `listItemsInOrder + filter`
  on each schema-editor mount. Acceptable for small collections;
  introduce a per-collection summary cache when needed.

- **Concurrent editing.** Single-editor assumption (ADR-007 §7).
  Two browser tabs, two band members, or one stale tab can silently
  clobber each other on save. v1 relies on the artist not opening
  two editors at once. The platform-level fix is per-item ETags + a
  CAS save endpoint; lands when we see real collisions.

- **Schema-version forward compat.** If the platform ships a new field
  type and an artist's `_collection.json` already uses it, an older
  deployment of the artist's site can't read it. v1 fails the build
  loudly. A backward-compatible "skip unknown field types" mode is
  possible but defers data loss to read time, which is worse.

- **Filter UI breadth.** §5.1's filter shape supports the common
  cases. More exotic predicates (string-pattern match, date ranges
  spanning fields, joined filters across multiple collections) can
  be added without changing the on-disk shape — extend `FilterClause`.

- **Drafts beyond single-editor `localStorage`.** Carry-over from
  ADR-007 §7. v1 keeps the same localStorage drafts model; per-item
  drafts that survive across devices land later (probably as a
  `drafts/<item-slug>` branch in the artist repo).

- **Pagination / search on public list pages.** Not in v1. List pages
  render every matching item. For collections that grow large, the
  artist authors filtering manually with separate pages. Real
  pagination + search is a future enhancement to the Collection
  block + view rendering.

- **i18n / localized content.** Not addressed. The model would
  accommodate it via a `locale` field on items + locale-aware
  routing, but neither is in v1.

- **Drag-corner resizing of Primitive blocks** (mentioned in earlier
  drafts). Deferred indefinitely — Puck's canvas doesn't natively
  support per-block resize, and the existing token-driven style knobs
  cover most needs.

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
  Puck config registers Primitive blocks + Collection blocks (one per
  existing collection). The item-template Puck config registers Primitive
  blocks
  with binding controls. The two configs are derived from the collection
  registry at render time, not hand-maintained.
- **Foundational refactor of the publish layer.** Page-specific publish
  targets are replaced with collection-item targets. Migration logic
  inside the publish layer covers the cutover for in-flight artists.
- **Build-time route generation depends on the collection registry.**
  Next.js's static export reads the collection list at build time to
  generate dynamic routes. A misconfigured collection (e.g. two
  collections claiming `detailUrlPrefix: "/"`) is caught at build, not
  runtime.
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
