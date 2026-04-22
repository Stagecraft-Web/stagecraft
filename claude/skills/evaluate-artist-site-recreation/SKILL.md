---
name: evaluate-artist-site-recreation
description: Use when the user wants to score how closely a stagecraft site recreation matches its original source. Crawls the recreation using the same crawl-artist-site tooling that captured the original (same viewport, same interaction-capture) for a true apples-to-apples comparison, diffs typography / palette / structure / content / interactions, then scores against a 6-dimension rubric (Visual Fidelity, Content Completeness, Interaction Fidelity, Component Coverage, Schema Fit, Asset Pipeline) and writes a final report. Trigger phrases include "evaluate the recreation", "score this recreation", "compare recreation to original", "how close did the recreation get", or a reference to a completed recreation directory that needs grading.
---

# Evaluate Artist Site Recreation

Score a stagecraft site recreation by crawling it with the same tool that captured the original, diffing the structured artifacts, and writing a report.

Run this after `recreate-artist-site` has produced output. It can also be re-run after manual tweaks to the recreation — just rerun end-to-end.

## Inputs

- **Required (option A — pipeline-style):** `run-dir=<path>` — the shared run directory (e.g. `.claude/runs/2026-04-19T23-16/`). The skill derives `crawl-dir` as `<run-dir>/crawls/<slug>/` and `recreation-dir` as `<run-dir>/recreations/<slug>/`. The recreation-crawl output goes to `<run-dir>/crawls/<slug>--recreation/`.
- **Required (option B — ad-hoc / legacy):** explicit `crawl-dir=` and `recreation-dir=` paths. Both can point to legacy locations (`.claude/site-crawls/<slug>/`, `.claude/site-recreations/<slug>/`) or symlinked entries.
- The recreation's `_working-notes.md` is expected but not required; quality signals will be thinner without it.

If either required input is missing or incomplete (manifest malformed, no screenshots, `src/` / `package.json` missing from the recreation), stop and tell the user what's needed — don't fall back to re-crawling or re-recreating from this skill.

### Finding inputs when only a slug is given

When the caller provides a slug without explicit paths, search in this order for each:

- **Crawl:** `.claude/runs/*/crawls/<slug>/` (most recent by mtime) → `.claude/site-crawls/<slug>/`.
- **Recreation:** `.claude/runs/*/recreations/<slug>/` (most recent by mtime) → `.claude/site-recreations/<slug>/`.

If the caller is the pipeline, prefer the run-dir it passed. If the recreation isn't found, stop and tell the user — don't guess by regenerating.

### Re-evaluation housekeeping

If `<recreation-dir>/RECREATION_REPORT.md` already exists (re-evaluation case), archive it as `RECREATION_REPORT-<previous-timestamp>.md` before writing the new one. The `<timestamp>` is the ISO time from the existing report's "Evaluated:" line (or the file's mtime if not parseable). This preserves a trail of how scores evolved as the recreation was iterated.

## Prerequisites

- Recreation must be runnable locally (`npm run build` + static serve, or `npm run dev`)
- The `crawl-artist-site` skill must be available — this skill invokes its workflow against the local URL
- `jq` and standard Unix tools for parsing crawl JSON. No pixel-diff libraries required (visual comparison is reasoning-based; the user can add `pixelmatch` later if they want a quantitative metric, but exact-pixel diffs on a redesigned site aren't very meaningful)
- **Write access to `<run-dir>/crawls/<slug>--recreation/`** (for the recreation crawl output) and `<recreation-dir>` (for `RECREATION_REPORT.md`). Sanity-write to both at the start and bail with a clear error if either fails — per the sandbox note in `recreate-artist-site`, `<run-dir>` under a nested `.claude/` is subagent-locked in the default path, and the caller should have picked a writable alternative before dispatching.

## Workflow

### 1. Boot a local server for the recreation

1. `cd` to the recreation directory
2. Prefer a production-style serve: run `npm run build`, then serve `dist/` on a free port via `npx serve dist -p <PORT>` or equivalent. This captures what the site looks like deployed, not the dev overlay.
3. Fallback: `npm run dev -- --port <PORT>` if the build is flaky. Note in the report that you used dev mode.
4. **Pick a port using the batch-convention when invoked by the pipeline:** `4322 + <site-index>` (site 1 → 4322, site 2 → 4323, …, site N → 4322 + N − 1). This avoids the user's default dev server on 4321 and keeps parallel evaluations cleanly separated. For ad-hoc single-site invocations outside the pipeline, 4322 / 8989 / 4000 are fine. Use `lsof -i :<PORT>` to confirm it's free.
5. Wait for the server to respond (poll `curl -s http://localhost:<PORT>`). Time out at 30s.
6. Run the server as a background process so you can kill it after the crawl.
7. **Always kill your server before returning,** including on error paths. Parallel evaluations leave orphaned servers on 4322–4326 otherwise; the next batch will hit "address in use". A `trap` on your background PID or an explicit kill in a `finally`-style step works.

### 2. Crawl the recreation

Invoke the `crawl-artist-site` workflow pointed at `http://localhost:<PORT>/`, with output directory `<run-dir>/crawls/<slug>--recreation/` (note the `--recreation` suffix to distinguish from the source crawl). Use the **exact same viewport and interaction-capture settings** as the original crawl.

Read the original crawl's `manifest.json.viewport` and use those dimensions explicitly so the computed styles are comparable. Cap pages to whatever the original crawl captured (don't over-crawl the recreation).

When the crawl finishes, kill the local server.

### 3. Diff the two crawls

For each page in the original, find the matching page in the recreation crawl. Match by path; apply fuzzy matching when paths differ (e.g. original `/about-the-band` ↔ recreation `/about`). Record matches in a small map before diffing.

Produce these tables (they go into the final report):

**Visual comparison (first-scroll screenshot, per page)** — view both side by side. Describe in 1-2 sentences what's similar and what's different. Focus on: palette match, type scale, spacing rhythm, composition of hero/primary section.

**Typography diff (per page, per role)**
```
| Role | Original | Recreation | Match |
|---|---|---|---|
| h1 | Gotham Bold, 48px, 1.1 | Inter, 700, 48px, 1.1 | ✓ sub |
| body | Gotham Book, 16px, 1.5 | Inter, 400, 16px, 1.5 | ✓ |
| accent color | #dc3232 | #da3030 | ≈ |
```
Match column values: `✓` exact, `✓ sub` intentional font substitution, `≈` close enough (within ~5% on numeric, within ΔE<10 on color), `✗` substantively different.

**Palette diff** — compare `palette` objects from each page's `styles.json`. Convert `rgb(...)` to hex.

**Structure diff** — for each site overall:
- Pages in original: N
- Pages in recreation: M
- Missing in recreation: [list]
- Extra in recreation: [list]
- Nav item order match: yes/no/partial

**Content coverage (per page)** — load both `text.md` files. Count headings and paragraphs; compute recreation/original ratio. Note specific missing content that seems important (full bio vs. just the first sentence, all 8 release entries vs. only 3, etc.).

**Interaction parity** — for each `interactions[]` kind captured in the original, is there an equivalent in the recreation?

### 4. Consolidate recreation's working notes

If `_working-notes.md` exists in the recreation directory:
- Read entries, group by tag (`[ease]`, `[friction]`, `[gap]`, `[opportunity]`, `[fidelity-risk]`)
- Collapse near-duplicates
- These populate two report sections: **Notes from the recreation process** and **Framework Improvement Opportunities**

If the file doesn't exist, note it in the report and rely on diff-based evidence alone.

### 5. Score

Score each rubric dimension 1–5 (see **Evaluation rubric**). Each score must cite evidence from step 3 (the diff tables) or step 4 (working notes). Do not score without evidence. Keep rationale to one sentence per dimension.

### 6. Write the report

`<recreation-dir>/RECREATION_REPORT.md` — template below. If a previous report exists from an earlier evaluation run, archive it as `RECREATION_REPORT-<previous-timestamp>.md` before writing the new one. Derive `<previous-timestamp>` from the existing report's "Evaluated:" line (fall back to the file's mtime if not parseable). See the Inputs section's "Re-evaluation housekeeping" note.

### 7. Summary to user (verbal response)

- Quality X/15, Ease X/15, Total X/30
- The single biggest visual difference between original and recreation (one sentence)
- Top 1-3 framework improvement opportunities (not all — the most impactful)
- Recommended next step (e.g. "tweak the heading weight and re-evaluate", "the recreation is close enough; ship it", "three opportunities are worth filing as framework issues")

## Evaluation rubric

Score each dimension 1–5 using the anchors below. Use the whole scale — a 5 means "the framework directly supported this, no compromise." A 3 means "acceptable but noticeably compromised." A 1 means "significant gap, required substantial workaround or the output is genuinely wrong."

### Part A — Recreation Quality

**Visual Fidelity** (how close the output looks to the original, from diff evidence)
- 5: Palette, typography, and composition all within `≈` tolerance across every diffed page
- 4: Clear family resemblance; minor divergences in spacing, weight, or color nuance on some pages
- 3: Same overall structure but visibly a different design — acceptable as "inspired by"
- 2: Loose resemblance only — major layout or palette differences
- 1: Looks unrelated per the side-by-side comparison

**Content Completeness** (from content-coverage table)
- 5: Every page's content ratio ≥ 0.9 (recreation has ≥ 90% of the original's headings + paragraphs)
- 4: Most pages ≥ 0.9; one or two pages ≥ 0.7
- 3: Primary pages ≥ 0.7; some collections underpopulated
- 2: Mixed — homepage complete, other pages partial
- 1: Placeholder content dominates

**Interaction Fidelity** (from interaction-parity table)
- 5: Every original interaction kind has a matching recreation interaction with the same UX family (lightbox-for-lightbox, inline player-for-inline player)
- 4: Most match; one small difference (no prev/next arrows in lightbox; video opens in new tab vs. inline)
- 3: Core interactions present but simplified
- 2: Some interactive elements static instead of interactive
- 1: No interactivity preserved

### Part B — Recreation Ease

**Component Coverage** (from recreation's working notes + structure diff)
- 5: Every page body composed from existing content-components with no awkward combinations
- 4: One or two places required creative combinations of existing components
- 3: Noticeable gaps — a few patterns required obvious approximations
- 2: Significant patterns had no good mapping
- 1: Fundamental mismatch

**Schema Fit** (theme + collection + singleton schemas from working notes)
- 5: Every data point had a clean home in the schemas
- 4: One or two fields required slight reinterpretation
- 3: Missing fields; flagged but not blocking
- 2: Multiple missing fields with visible compromises
- 1: Schemas don't support the source's content model

**Asset Pipeline** (from recreation's working notes, corroborated by broken-image check on the recreation crawl)
- 5: All images downloaded on first try, referenced correctly, no broken assets in the recreation
- 4: A few failures (< 20%), recovered with placeholders/alternates, no broken refs
- 3: 20–40% failed or required workarounds
- 2: > 40% failed or significant manual fixups
- 1: Mostly manual / broken

**Scoring discipline**
- Prefer round numbers. No half-scores.
- When torn between two adjacent scores, pick the lower one and capture the redeeming quality in the rationale.
- Score the *framework's support for the source*, not the difficulty of the source itself. Note source complexity separately.

## Report template

```markdown
# Recreation Report: <Artist Name>

- **Source crawl:** `.claude/site-crawls/<slug>/`
- **Recreation:** `.claude/site-recreations/<slug>/`
- **Recreation crawl:** `.claude/site-crawls/<slug>--recreation/`
- **Evaluated:** <ISO date>
- **Stagecraft version:** <git short SHA of HEAD at evaluation time>
- **Recreation mode:** build+serve | dev

## Scores

### Part A — Recreation Quality (X/15)

| Dimension | Score | Rationale |
|---|---|---|
| Visual Fidelity | X/5 | ... |
| Content Completeness | X/5 | ... |
| Interaction Fidelity | X/5 | ... |

### Part B — Recreation Ease (X/15)

| Dimension | Score | Rationale |
|---|---|---|
| Component Coverage | X/5 | ... |
| Schema Fit | X/5 | ... |
| Asset Pipeline | X/5 | ... |

### Total: X/30

## Apples-to-apples comparison

### Structure

- Pages in original: N
- Pages in recreation: M
- Missing: [...]
- Extra: [...]

### Typography (consolidated)

| Role | Original | Recreation | Match |
|---|---|---|---|
| ... | ... | ... | ... |

### Palette

| Token | Original | Recreation | Match |
|---|---|---|---|
| ... | ... | ... | ... |

### Content coverage

| Page | Original (h + p count) | Recreation (h + p count) | Ratio |
|---|---|---|---|
| / | 4 + 12 | 4 + 10 | 0.88 |
| /about | 3 + 8 | 3 + 7 | 0.91 |

### Interactions

| Page | Kind | Original | Recreation | Match |
|---|---|---|---|---|
| / | photo-lightbox | yes | yes (same style) | ✓ |
| /music | video-play | modal (youtube embed) | external redirect to youtube | ≈ |

## Visual comparison

### / (home)

Side-by-side: `site-crawls/<slug>/home/scroll-01.png` vs. `site-crawls/<slug>--recreation/home/scroll-01.png`

<1-2 sentence description of similarities and differences>

(Repeat per page.)

## Notes from the recreation process

(Consolidated from `_working-notes.md`, grouped by tag)

### [ease]
- ...

### [friction]
- ...

### [fidelity-risk]
- ...

## Framework Improvement Opportunities

### 1. <Title>
- **Friction observed:** ...
- **Proposed:** ...
- **Priority:** Medium
- **Impact estimate:** would likely benefit <N> out of every <M> artist-site recreations

### 2. <Title>
...

## Source observations

- Tech stack detected: Squarespace / Wix / custom React / WordPress / ...
- Standout design patterns without direct framework support: ...
- External services relied on: Spotify, Bandcamp, Instagram, ...
- Source complexity note (separate from framework scoring): this site was unusually simple/typical/complex relative to a typical artist site
```

## Common pitfalls

- **Port already in use** — if the user's dev server is running, pick a different port. Don't kill their server.
- **Recreation hasn't been built** — if `dist/` doesn't exist and you're using the build+serve path, run `npm run build` first. Fail fast if the build errors.
- **Recreation doesn't have all pages** — if the recreation is missing pages the original had, that shows up in both the structure diff and the Content Completeness score. Don't penalize twice with editorial commentary.
- **Fuzzy path matching** — log the page-match decisions in the report. If `/about-the-band` ↔ `/about` seems wrong, the user will catch it.
- **Fonts look fine in the styles.json but wrong in the screenshot** — fonts load asynchronously. If the crawl happened before fonts finished loading, computed styles will show fallback fonts. Re-crawl with a longer settle time (5s instead of 2s) and flag in the report.
- **Generated HTML differs structurally from original** — that's expected (our framework produces different DOM than Squarespace). The diff is on design tokens and content, not DOM structure.
