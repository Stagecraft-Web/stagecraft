---
name: evaluate-artist-site-recreation
description: Use when the user wants to score how closely a stagecraft site recreation matches its original source. Crawls the recreation, runs a frontend-expert review + adjustment pass to close obvious fidelity gaps, re-crawls the refined recreation, then diffs typography / palette / structure / content / interactions against the original and scores against a 6-dimension rubric (Visual Fidelity, Content Completeness, Interaction Fidelity, Component Coverage, Schema Fit, Asset Pipeline). Trigger phrases include "evaluate the recreation", "score this recreation", "compare recreation to original", "how close did the recreation get", or a reference to a completed recreation directory that needs grading.
---

# Evaluate Artist Site Recreation

Score a stagecraft site recreation by:

1. Crawling it with the same tool that captured the original.
2. Running an expert frontend review against the initial crawl + the recreation agent's working notes, then applying the review's concrete improvements in place.
3. Re-crawling the refined recreation.
4. Diffing the final crawl against the original, scoring, and writing a report.

The review + adjust + re-crawl loop is mandatory — it's the difference between scoring the first-draft recreation (unfair to the template) and scoring what the template can actually produce with one focused refinement pass. Skip the loop only if the caller explicitly passes `skip-refine` (rare; almost always wrong).

Run this after `recreate-artist-site` has produced output. It can also be re-run after manual tweaks to the recreation — just rerun end-to-end.

## Inputs

- **Required (option A — pipeline-style):** `run-dir=<path>` — the shared run directory (e.g. `.claude/runs/2026-04-19T23-16/`). The skill derives `crawl-dir` as `<run-dir>/crawls/<slug>/` and `recreation-dir` as `<run-dir>/recreations/<slug>/`. The recreation-crawl output goes to `<run-dir>/crawls/<slug>--recreation/`.
- **Required (option B — ad-hoc / legacy):** explicit `crawl-dir=` and `recreation-dir=` paths. Both can point to legacy locations (`.claude/site-crawls/<slug>/`, `.claude/site-recreations/<slug>/`) or symlinked entries.
- The recreation's `_working-notes.md` is expected but not required; quality signals will be thinner without it.

If either required input is missing or incomplete (manifest malformed, no screenshots, `src/` / `package.json` missing from the recreation), stop and tell the user what's needed — don't fall back to re-crawling or re-recreating from this skill.

### Finding inputs when only a slug is given

When the caller provides a slug without explicit paths, search in this order for each:

- **Crawl:**
  1. `.claude/crawls/<slug>/` — most recent dated subdir (canonical, site-keyed).
  2. `.claude/runs/*/crawls/<slug>/` where the match is a real directory (legacy, pre-reorg).
  3. `.claude/site-crawls/<slug>/` (legacy, pre-`runs/` era).
- **Recreation:** `.claude/runs/*/recreations/<slug>/` (most recent by mtime) → `.claude/site-recreations/<slug>/`.

If the caller is the pipeline, prefer the run-dir it passed (the pipeline already resolved the right crawl and symlinked it in). If the recreation isn't found, stop and tell the user — don't guess by regenerating.

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

### 2. Crawl the recreation (initial)

Invoke the `crawl-artist-site` workflow pointed at `http://localhost:<PORT>/`, with output directory `<run-dir>/crawls/<slug>--recreation-pre-refine/` (this preserves the pre-refinement crawl as a trace so the refinement's value can be seen; the **final** post-refine crawl will land at `<slug>--recreation/` in step 5). Use the **exact same viewport and interaction-capture settings** as the original crawl.

Read the original crawl's `manifest.json.viewport` and use those dimensions explicitly so the computed styles are comparable. Cap pages to whatever the original crawl captured (don't over-crawl the recreation).

When the crawl finishes, kill the local server — it'll be rebooted after the adjustment pass.

### 3. Expert frontend review

**Goal:** produce a concrete, actionable refinement plan for the recreation before it gets scored. The scoring pass should measure what the template+author can realistically achieve, not just the recreation agent's first draft.

**Inputs:**
- Screenshots from the original crawl (`<run-dir>/crawls/<slug>/*/scroll-*.png`)
- Screenshots from the initial recreation crawl (`<run-dir>/crawls/<slug>--recreation-pre-refine/*/scroll-*.png`)
- `<recreation-dir>/_working-notes.md` (the recreation agent's thought process, with `[ease]` / `[friction]` / `[gap]` / `[opportunity]` / `[fidelity-risk]` entries)
- Optional: original + recreation `styles.json` and `text.md` from matching pages if a judgment call needs grounding in the data

**How to run it:** treat this as an expert frontend-designer pass. If the overall pipeline is fanning out per-site subagents and each subagent is already running this skill end-to-end, do the review in-line — you (the per-site agent) already have the context. If you're running this skill standalone for a single site and the user wants an extra set of eyes, you may dispatch a subagent; not required.

**What the review should produce (per page, or site-wide where appropriate):**

1. **Specific fidelity improvements.** Each improvement must name a concrete change: "reduce h1 weight from 700 to 500 to match the original's lighter display treatment", "move hero title from centered to top-left to match source composition", "palette accent should be #b85450, not #cc5a4a (original is more muted)". Vague suggestions ("make it look more like the original") are forbidden — every entry must be something a subsequent agent can try in a single edit.
2. **Intentional divergence justifications.** When the recreation diverges from the original and that divergence is *correct* or *better* (e.g. the original uses a decorative cursor that we've skipped for a11y, or the original's stacked layout is objectively harder to scan than the recreation's grid), say so explicitly. These protect the recreation from being penalized for a deliberate choice.
3. **Prioritization.** Tag each improvement as `priority: high | medium | low` based on visual impact × ease of adjustment. High = big visual gap + easy edit. Low = small gap, or big gap that clearly needs a framework change (bubble those up instead of trying).

**Output format — append to `_working-notes.md`:**

```
## Expert frontend review — <ISO timestamp>

- [review] [priority: high] home: Hero title alignment — original has wordmark top-left over photo, recreation has centered text. Change to top-left via a `titlePosition` attribute (framework gap: FullscreenSection lacks this → log [opportunity]).
- [review] [priority: high] home: Accent color drift — original is #b85450, recreation has #cc5a4a. Update appearance.json.
- [review] [priority: medium] about: Body leading feels tight compared to original. Bump line-height from 1.4 to 1.55.
- [review] [priority: low] music: Release grid column gap is larger in original. Minor.
- [review] [keep] photos: Lightbox styling differs but recreation's is cleaner + more accessible — keep as-is, don't penalize.
```

Use the `[keep]` variant for intentional divergences to signal "don't try to adjust this."

Keep each entry to one line. If a proposed improvement is blocked by a missing framework feature (no attribute, no schema field, no token), do NOT try to hack around it here — log a standard `[opportunity]` entry at the end of the review pointing to what would unblock it, and leave the visual as-is.

### 4. Adjustment pass

Work through the `[review]` entries tagged `priority: high` first, then `medium`. Low-priority entries can be addressed if time allows but don't block progress.

For each `[review]` entry attempted, append an `[adjustment]` entry to `_working-notes.md` recording the outcome:

```
- [adjustment] home hero alignment — tried titlePosition prop: blocked (FullscreenSection schema doesn't expose one). Left as-is; [opportunity] entry covers the proposed schema addition.
- [adjustment] accent color drift — updated src/content/config/appearance.json colors.accent #cc5a4a → #b85450. Rebuild + spot-check: ✓.
- [adjustment] about body leading — updated theme.json fontSizeScale entry for body line-height 1.4 → 1.55. Rebuild: ✓.
```

Possible outcomes for each:
- `applied` — change made, rebuild still green, visual closer to source. Include the file(s) touched.
- `skipped` — low priority, no time, or judged not worth it. State why.
- `blocked` — framework capability missing. Log (or strengthen an existing) `[opportunity]` entry explaining what change would unblock it. Do NOT hack around the missing feature with inline styles, ad-hoc components, or schema-violating data; that defeats the point of evaluating the framework honestly.

After all adjustments:

1. Run `npx astro check`, `npm run validate:content`, and `npm run build` in the recreation directory. Fix anything the adjustments broke.
2. If a change didn't apply cleanly (e.g. a color token didn't propagate), debug once, and if still stuck, revert and mark `blocked`. Don't leave the site in a half-refined state.

The adjustment pass's job is to move the score up *without* cheating the framework. If the score only improves because you bypassed the framework (inline style overrides, one-off components, hardcoded assets), the evaluation becomes a lie. Prefer leaving visible fidelity gaps over faking fixes.

### 5. Re-crawl the refined recreation

1. Reboot the local server from the recreation dir (same port, fresh `npm run build` + `serve dist`; or `npm run dev` if you used dev mode in step 1).
2. Invoke `crawl-artist-site` again with the same viewport / interaction-capture settings, this time writing to `<run-dir>/crawls/<slug>--recreation/`. This is the **canonical post-refine crawl** that step 6 diffs against.
3. Kill the server when the crawl finishes.

Both `<slug>--recreation-pre-refine/` and `<slug>--recreation/` now exist under `<run-dir>/crawls/`. The pre-refine one is kept as a trace of what the first-draft recreation looked like; the post-refine one is what gets scored.

### 6. Diff the two crawls

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

### 7. Consolidate recreation's working notes

`_working-notes.md` now contains entries from both the recreation agent (steps 1–10 of `recreate-artist-site`) and the review+adjust pass (steps 3–4 above):
- Read entries, group by tag (`[ease]`, `[friction]`, `[gap]`, `[opportunity]`, `[fidelity-risk]`, `[review]`, `[adjustment]`).
- Collapse near-duplicates across the recreation-phase and review-phase entries (e.g. a `[gap]` logged during recreation that a `[review]` entry later echoed, or an `[opportunity]` reinforced by a `[adjustment] … blocked` outcome — the repetition is signal, but only one entry needs to appear in the report).
- The `[review]` + `[adjustment]` pair for a single fidelity item should be collapsed into a single bullet in the report's refinement section, not listed twice.
- These populate three report sections: **Notes from the recreation process**, **Refinement pass**, and **Framework Improvement Opportunities**.

If the file doesn't exist, note it in the report and rely on diff-based evidence alone. (This should be rare after step 3–4 — if you ran them, the file exists.)

### 8. Score

Score each rubric dimension 1–5 (see **Evaluation rubric**). Each score must cite evidence from step 6 (the diff tables) or step 7 (consolidated working notes). Do not score without evidence. Keep rationale to one sentence per dimension.

Score against the **post-refine** recreation (what's captured in `<slug>--recreation/`). The pre-refine crawl is useful for the report's "what the refinement pass changed" commentary but is not the scoring surface.

### 9. Write the report

`<recreation-dir>/RECREATION_REPORT.md` — template below. If a previous report exists from an earlier evaluation run, archive it as `RECREATION_REPORT-<previous-timestamp>.md` before writing the new one. Derive `<previous-timestamp>` from the existing report's "Evaluated:" line (fall back to the file's mtime if not parseable). See the Inputs section's "Re-evaluation housekeeping" note.

### 10. Summary to user (verbal response)

- Quality X/15, Ease X/15, Total X/30
- The single biggest visual difference between original and post-refine recreation (one sentence)
- Refinement-pass impact: how many `[review]` items were `applied` / `blocked` / `skipped`, and whether the blocked ones pointed to a repeat framework gap
- Top 1-3 framework improvement opportunities (not all — the most impactful; favor the ones the adjustment pass confirmed by getting `blocked` on them)
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

- **Source crawl:** `<run-dir>/crawls/<slug>/`
- **Recreation:** `<run-dir>/recreations/<slug>/`
- **Recreation crawl (pre-refine):** `<run-dir>/crawls/<slug>--recreation-pre-refine/`
- **Recreation crawl (final, scored):** `<run-dir>/crawls/<slug>--recreation/`
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

(Consolidated from `_working-notes.md` entries written during the recreation phase, grouped by tag)

### [ease]
- ...

### [friction]
- ...

### [fidelity-risk]
- ...

## Refinement pass

(Consolidated `[review]` + `[adjustment]` pairs from `_working-notes.md`. One bullet per fidelity item, summarizing what the review flagged and whether the adjustment applied / was blocked / was skipped.)

- **Home hero alignment** — review flagged centered vs. top-left wordmark; blocked — FullscreenSection lacks `titlePosition`; framework gap logged.
- **Accent color drift** — applied; `appearance.json` accent #cc5a4a → #b85450, confirmed in post-refine crawl.
- **About body leading** — applied; line-height 1.4 → 1.55 on body role.
- **Photos lightbox styling** — kept intentionally; recreation's version is cleaner + more accessible.

Summary: `<N applied> / <N blocked> / <N skipped> / <N kept-intentionally>`.

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
- **Refinement pass turns into a rewrite** — the adjustment pass is one focused iteration over the `[review]` items, not a second recreation. If you find yourself rebuilding pages from scratch, stop and mark the outstanding items `blocked` — that signals the first draft needed a rethink, and the real fix belongs in `recreate-artist-site`, not here.
- **"Cheating" the score with hacks** — if a fidelity gap can only be closed by an inline style override, a one-off component outside `src/content-components/`, or data that violates the schema, do NOT apply it. Mark `blocked` and let the score reflect the framework's real ceiling. The pipeline's value depends on honest signal.
- **Pre-refine crawl accidentally overwritten** — the initial crawl goes to `<slug>--recreation-pre-refine/` (step 2) and the final crawl goes to `<slug>--recreation/` (step 5). Re-running steps 2 and 5 on an already-evaluated site is fine, but make sure the output dirs match — mixing them up silently breaks the diff's "before vs. after" commentary.
