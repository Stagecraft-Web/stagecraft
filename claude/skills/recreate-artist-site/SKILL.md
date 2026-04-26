---
name: recreate-artist-site
description: Use when the user wants to recreate a previously-crawled artist website using the stagecraft musician-site template. Consumes a crawl output directory (produced by the crawl-artist-site skill) and produces a filled-in musician-site instance — theme tokens, pages, collections, assets — at a target directory. Trigger phrases include "recreate this site", "build the site from the crawl", "use the crawl of X to make a stagecraft site", or any task that references an existing crawl directory (under `.claude/runs/<run-id>/crawls/<slug>/` or the legacy `.claude/site-crawls/<slug>/`) and asks for a site rebuild.
---

# Recreate Artist Site

Turn a site-crawl output into a working musician-site instance using the stagecraft template. This is the follow-up to `crawl-artist-site` — run that first if no crawl exists yet. If a crawl already exists, this skill consumes it directly without re-crawling.

## Inputs

- **Required (option A — pipeline-style):** `run-dir=<path>` — the run directory that holds the crawl (e.g. `.claude/runs/2026-04-19T23-16/`). The skill derives `crawl-dir` as `<run-dir>/crawls/<slug>/` and `target-dir` as `<run-dir>/recreations/<slug>/`.
- **Required (option B — ad-hoc / legacy):** explicit `crawl-dir=<path>` pointing to any directory containing `manifest.json`. Common legacy location: `.claude/site-crawls/<slug>/`. In this case `target-dir` defaults to `.claude/site-recreations/<slug>/` unless also specified. Symlinked crawls are fine — the skill just needs to read `manifest.json` and the per-page `styles.json` / `text.md` / `page.html` / screenshots.
- **Optional:** `target-dir=<path>` — override the recreation output directory.
- **Optional:** user preferences — "mimic faithfully" vs. "use their layout but our defaults", specific things to keep/drop

If the crawl is missing or the manifest lacks essentials (pages, imageUrls), stop and tell the user to re-crawl. **Do not fall back to crawling from this skill** — that's the `crawl-artist-site` skill's job. If the user wanted a fresh crawl they'd run the pipeline without `skip-crawl`.

### Finding an existing crawl when only a slug is given

When the caller provides a slug without an explicit path, search in this order:

1. `.claude/crawls/<slug>/` — pick the most recent dated subdir (ISO-minute names sort correctly as plain strings). This is the canonical site-keyed crawl location.
2. `.claude/runs/*/crawls/<slug>/` where the match is a real directory (not a symlink) — legacy, pre-reorg.
3. `.claude/site-crawls/<slug>/` — legacy, pre-`runs/` era.

If multiple candidates exist and the caller is the pipeline, prefer the one the pipeline explicitly symlinked into the run-dir (the pipeline has already done staleness checks by that point — don't second-guess). If no candidates exist anywhere, stop and tell the user the slug isn't crawled yet.

## Prerequisites

Before starting, verify you can read the stagecraft template:

- `templates/musician-site/` exists in the current repo (OR the invocation explicitly names a template path in another repo — cross-repo reads via Bash `cp -R` work even when the target-dir is elsewhere)
- `templates/musician-site/src/content-components/` — enumerate the available content components (current set includes: `Section`, `FullscreenSection`, `Columns`, `Column`, `Button`, `Image`, `Card`, `ReleaseList`, `PhotoGallery`, `Quote`, `CenteredBlock`, `ContactForm`). Rely on this enumeration, not memory — the set evolves.
- `templates/musician-site/src/content/` — existing example pages and singletons (site config, nav, theme) that show the expected shapes
- `templates/musician-site/src/lib/schemas.*` — zod schemas for singletons; consult these when writing config files

## Sandbox / write-access check (first 30 seconds)

Before any substantive work, confirm you can actually write to `<target-dir>`. This is cheap and catches sandboxing issues in seconds instead of after ~10 minutes of doomed work.

1. `mkdir -p <target-dir>` (or verify it exists if the orchestrator pre-created it).
2. Sanity-write: `echo ok > <target-dir>/_sanity.txt && rm <target-dir>/_sanity.txt`.
3. If that Bash write fails, STOP. Report the exact error to the caller. Do not:
   - Try `dangerouslyDisableSandbox` on Bash in a loop.
   - Attempt the Edit tool on copied template files hoping for different behaviour.
   - cp in the template anyway and hope later writes succeed.

The sandbox is deterministic: if the sanity write fails, every subsequent write to that subtree will fail. Fail fast and surface the issue — the pipeline's Step 0 has rules about choosing a writable path, and the caller can redirect before more tokens are spent.

## Workflow

### 1. Inspect the crawl and start a working notes file

1. Read `manifest.json` completely. Note: pages, image URLs, external services, fonts, notable observations.
2. View a sample of screenshots per page — at minimum the first scroll of home, about, music, and one gallery-style page if present. Use these to ground design decisions.
3. Create `<target-dir>/_working-notes.md` and start logging as you go. It's a **living document**, not a deliverable: the evaluate skill (`evaluate-artist-site-recreation`) appends a frontend-review pass and its adjustment-pass outcomes to the same file before scoring, and the final `RECREATION_REPORT.md` consolidates everything. Write entries with that downstream consumer in mind — terse, tagged, greppable.

   Recreation-phase tags:
   - `[ease]` — general observations about how smoothly the process is going
   - `[friction]` — a specific thing that slowed you down or needed a workaround
   - `[gap]` — a framework capability that was missing or didn't fit
   - `[opportunity]` — a concrete proposed framework improvement (component, schema field, theme token, etc.)
   - `[fidelity-risk]` — something about the output you're unsure matches the original

   The evaluate skill will later add `[review]` (specific fidelity improvements, or intentional-divergence justifications tagged `[keep]`) and `[adjustment]` (outcomes — applied / blocked / skipped). Do not pre-fill those tags yourself.

   Format each entry as a one-liner or short paragraph. Don't over-invest in prose — just capture the signal.
4. Produce a short written plan for yourself (not as a deliverable — just to organize the work): for each crawled page, which stagecraft page will it map to, and which content components will compose the body.

### 2. Extract design tokens

The crawl saves a `styles.json` per page with computed typography and color info — **prefer that over eyeballing screenshots**. Screenshots remain the tiebreaker for ambiguous cases (e.g. when a site has multiple fonts and you need to decide which is "the" heading font).

1. **Load each page's `styles.json`** from the crawl and consolidate:
   - **Typography** — `byRole.h1/h2/h3/body/button/nav/caption` gives `fontFamily`, `fontWeight`, `fontSize`, `lineHeight`, `letterSpacing`, `textTransform`, and `color`. Pick the most common heading family across pages + the most common body family. Note weights actually used (e.g. "headings use 700, body uses 400 with 600 for bold runs").
   - **Palette** — `palette.bodyBackground`, `palette.bodyForeground`, `palette.accent`, `palette.buttonBackground`. Convert `rgb(...)` → hex.
   - **CSS variables** — `cssVars` often contains the site's named design tokens (`--color-primary`, `--font-heading`, `--space-4`). These are gold — they're the source site's own design system in explicit form. Map to our theme where the concepts overlap.
2. **Font mapping** — for each proprietary font in use, map to the closest Google Fonts equivalent. Common substitutions:
   - Gotham → `Inter`, `Manrope`, `Work Sans`
   - Avenir → `Nunito Sans`, `Inter`
   - Futura → `Jost`, `Urbanist`
   - Didot / Bodoni → `Playfair Display`, `Bodoni Moda`
   - Helvetica Neue → `Inter` (or the system stack)
   - Garamond → `EB Garamond`, `Cormorant Garamond`
   Note the substitution in `_working-notes.md` as `[friction]`.
3. **Colors** — express as hex. The theme file uses named tokens — consult `src/lib/schemas.*` for the exact shape. If the site uses more granular tokens than our theme supports (e.g. separate link color, hover color, multiple accent colors), log as `[opportunity]`.
4. **Spacing / density** — screenshots still win here. Eyeball whether the site is tight or airy. If `cssVars` exposes a spacing scale (`--space-1`, `--space-2`, ...), note it for reference even if our theme doesn't expose spacing tokens yet.

**Log to `_working-notes.md`:** if you wanted a theme token that didn't exist (e.g. no spacing scale, no accent-2 color, no separate link color, no heading-specific weight override), append an `[opportunity]` entry.

### 3. Plan content mapping

For each crawled page, decide which stagecraft page it becomes and how its body is composed. Common patterns:

| Crawled pattern | Stagecraft mapping |
|---|---|
| Full-viewport hero with title over image | `fullscreen-section` with `image` + `button` inside |
| Bio with side-by-side portrait + text | `section` → `columns` (`layout="1-2"` or `2-1`) containing `image` and paragraphs |
| Grid of releases / album art | `section` → `release-list` |
| Photo gallery / image grid | `section` → `photo-gallery` |
| Press quotes / testimonials | `section` → one `quote` tag per quote (`text` + optional `attribution`; no separate collection) |
| Tour dates / event list | `section` → (tour-dates collection, rendered via a page or component) |
| Call-to-action buttons | `button` (variant `primary` or `outline`) |
| Contact info / form | `section` → `contact-form` |
| Plain prose paragraphs | `section` → paragraph text |
| Video hero / reel | `fullscreen-section` with note — may need stub image + link out |

Pages that don't fit our component system: approximate with the closest available combination and call out in the summary. Do not invent new components in this skill — propose them at the end if truly needed.

**Log to `_working-notes.md`:** for each page that required approximation, append a `[gap]` entry describing the crawled pattern + the approximation you used. These drive the framework improvement proposals in the final report.

### 4. Create the target

1. If target is a fresh path (not an existing site), **copy** `templates/musician-site/` to the target directory preserving structure. Use `cp -R`.
2. Replace the default content in:
   - `src/content/site/` (or wherever the site singleton lives — consult the keystatic config)
   - `src/content/navigation/` or similar
   - `src/content/theme/` or similar
   - `src/content/pages/*.mdoc` — remove defaults, replace with pages from the plan
   - `src/content/releases/`, `photos/`, `videos/`, `tour-dates/` — empty out and populate with crawled data (press quotes are authored inline on `press.mdoc` as `quote` tags, not a collection)
3. Delete unused example content (but keep required singletons present with real values).

### 5. Write theme, site, and nav singletons

Write these first — they anchor the rest. Use the zod schemas in `src/lib/schemas.*` as the source of truth for each shape.

- **Theme** — the color palette and typography choices from step 2. Include placeholders for fonts-to-load if the theme system handles font loading.
- **Site** — artist name, tagline, default SEO metadata, social/external service links (from `manifest.externalServices`).
- **Navigation** — the ordered list of primary nav items matching the pages you're about to write.

### 6. Write pages

For each page in the plan:

1. Create `src/content/pages/<slug>.mdoc`
2. Frontmatter: `title`, `slug`, any other required fields per the page schema
3. Body: compose using the content-components you planned. Use the markdoc tag syntax — consult `markdoc.config.ts` for the exact tag names and attributes, or look at existing example pages.
4. For prose: pull actual text from `<slug>/<page-slug>/text.md` (the crawl's per-page plaintext outline). For anything ambiguous (contextual attribution, embedded metadata), consult `<slug>/<page-slug>/page.html` — the rendered HTML is the source of truth. Only re-fetch with WebFetch if both are missing.

**Never reference images that don't exist yet.** Step 7 downloads them — write the page to reference paths like `src/assets/images/artistname/hero.jpg`, then make sure step 7 places files at those exact paths.

### 7. Download assets

For each `imageUrl` in the manifest:

1. Decide if this image is used in the recreated site. Filter out:
   - Social media icons if the template has its own
   - Tracking pixels (1x1 images, obvious analytics URLs)
   - Favicon / touch-icon variants (the template has its own; unless the artist has a distinctive logo mark, use generic)
2. Download via `curl` or `WebFetch` (for binary images, `curl` is simpler):
   ```bash
   curl -sSL -o src/assets/images/<artist>/<name>.<ext> '<url>'
   ```
3. Use descriptive filenames: `hero.jpg`, `portrait.jpg`, `album-<release-slug>.jpg`, `photo-01.jpg`. Avoid hash-garbled CDN names.
4. Respect referenced paths from step 6 — the filename at save time must match what the pages reference.

If an image fails to download (404, 403, CORS on CDN), log and move on — use a placeholder and note the miss in the summary.

**Log to `_working-notes.md`:** count failed downloads. If > ~20% fail, append a `[friction]` entry — the asset pipeline may need better retry/UA handling.

### 8. Populate collections

Extract and write:

- **Releases** — title, release date (year if only year is visible), cover image ref, optional external links (Spotify/Bandcamp/Apple URLs from externalServices if they're per-release)
- **Photos** — caption (if visible), image ref
- **Videos** — title, embed URL (from `videos` in per-page manifest), optional thumbnail ref
- **Press quotes** — quote text, source/publication, date if visible
- **Tour dates** — date, city, venue, ticket URL (if in externalServices or on the page)

For anything ambiguous (e.g. can't tell release year from screenshots), make a best guess and flag in the summary for the user to review.

**Log to `_working-notes.md`:** if a collection schema didn't fit the source cleanly (missing fields you wanted, required fields the source didn't have, shape mismatch), append a `[gap]` or `[opportunity]` entry.

### 9. Verify

In the target directory:

1. `npm install` (if the target is a fresh copy)
2. `npx astro check` — must pass with 0 errors
3. `npm run validate:content` — catches singleton/page/collection schema mismatches
4. `npm test` — sanity check
5. `npm run build` — confirm it actually builds
6. `npm run dev` — note the URL for the user to open

If any step fails, fix and re-run. Common issues:
- Referenced image missing → download it or swap to an existing one
- Markdoc attribute type mismatch → check the tag's `matches` constraint
- Required singleton field empty → fill with a sensible default, note in summary

### 10. Summary to user

Report to the user (verbally, in the final tool response):
- Target directory path
- Pages created and component composition (quick map)
- Theme tokens chosen (colors, fonts)
- Assets downloaded / skipped
- Collection entries populated per collection
- A one-line gut check on how the recreation feels — "close to the original", "decent approximation", "rough — needs significant iteration" — without scoring (scoring happens in the evaluation skill with evidence)
- **Next step:** recommend running the `evaluate-artist-site-recreation` skill. That skill crawls the recreation with the same tool used for the original, diffs typography / palette / structure / content / interactions, and writes `RECREATION_REPORT.md` with rubric-based scores and framework improvement opportunities extracted from `_working-notes.md`.

Do NOT score the recreation yourself inside this skill — the evaluation skill's apples-to-apples comparison produces more honest signal than self-assessment. Just leave `_working-notes.md` on disk for the evaluator to consume.

## Common pitfalls

- **Fonts that aren't on Google Fonts** — approximate with the closest match (e.g. proprietary Gotham → `Inter` or `Manrope`). Note the substitution.
- **Custom cursors, WebGL, scrollytelling** — stagecraft doesn't do these. Approximate with static sections and call it out.
- **E-commerce embeds (Shopify, Bandcamp store widgets)** — outside scope. Use a `button` linking to the external store.
- **Video backgrounds** — stagecraft doesn't currently support looping video bg. Swap to a still image from the video (if captured) or a hero photo. Flag in the summary.
- **Hard-to-read screenshot text (stylized, rendered into hero images)** — re-fetch the page with `get_page_text` or WebFetch for the raw text.
- **Images behind auth/CDN headers** — `curl -A "Mozilla/5.0"` sometimes helps. If persistent 403, use a placeholder and note.
- **Overly ambitious recreation** — if you're spending a lot of effort trying to mimic a one-off custom layout, stop and approximate. The point is a working first draft, not a pixel-perfect clone.

## Scope limits

- This skill produces a first-draft recreation. Expect the user to iterate after reviewing.
- Do NOT attempt novel component work (new content-components, new collection types, new singleton fields) inside this skill. If gaps appear, log them to `_working-notes.md` as `[gap]` / `[opportunity]` — they'll surface in the evaluation report as framework improvement proposals.
- Do NOT score the recreation here. The `evaluate-artist-site-recreation` skill handles scoring with evidence from a matching crawl of the recreation.
- Do NOT open PRs or push branches from within this skill. The output is a local recreation the user inspects and chooses what to do with.
- Run one artist at a time. If the user supplies multiple crawls, either ask which to start with or process sequentially with a brief summary between each.
