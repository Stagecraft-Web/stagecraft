---
name: artist-site-pipeline
description: Use when the user wants to run the crawl → recreate → evaluate pipeline for one or more artist websites. Supports four modes via flags — full pipeline, skip-crawl (reuse existing crawls), skip-crawl + skip-recreate (re-evaluate only), and crawl-only. All phase outputs share one timestamped run directory. Trigger phrases include "run the full pipeline", "crawl, recreate, and evaluate", "recreate these sites using existing crawls", "re-evaluate these recreations", or "process these artist sites end-to-end".
---

# Artist Site Pipeline

Orchestrate crawl → recreate → evaluate for one or more artist sites. Supports running the full pipeline, or skipping any already-done phases so the user can iterate on later phases without redoing earlier work.

## Modes

Pick the mode from the flags; the rest of the workflow is conditional on it.

| Mode | Flags | Inputs needed | What runs |
|---|---|---|---|
| **Full pipeline** | (none) | URLs | crawl → recreate → evaluate |
| **Crawl only** | `crawl-only` | URLs | crawl |
| **Skip crawl** | `skip-crawl` | site slugs (or `run-dir` containing crawls) | recreate → evaluate |
| **Re-evaluate** | `skip-crawl skip-recreate` | site slugs (or `run-dir` containing recreations) | evaluate |

Single-site vs. batch doesn't change the mode — pass one or many.

## Inputs

- **URLs** — required for full pipeline and crawl-only.
- **Site slugs** — required for skip-crawl and re-evaluate modes. A slug is the directory name the prior run used (e.g. `aidanscrimgeour-com`).
- `run-dir=<path>` — explicit run directory. When absent, the skill auto-resolves one (see Step 0).
- `skip-crawl`, `skip-recreate`, `crawl-only` — mode flags above.
- Optional user preferences passed through to the recreate phase ("mimic faithfully", "dark palette only", etc.).

## Step 0 — Resolve the run directory

The run-dir is the single workspace holding this batch's `index.json`, `crawls/`, and `recreations/`. Its resolution depends on the mode.

### Full pipeline / crawl-only

- If `run-dir=<path>` is explicit, use it.
- Otherwise generate a fresh one:
  ```bash
  RUN_ID=$(date '+%Y-%m-%dT%H-%M')
  RUN_DIR=".claude/runs/$RUN_ID"
  mkdir -p "$RUN_DIR"
  ```

### Skip-crawl

**Two sub-cases depending on whether the user passed an explicit `run-dir`:**

**Case A — `run-dir=<path>` is explicit (iteration mode):**
- Use the passed run-dir as the working directory. New recreations will land in `<run-dir>/recreations/<slug>/`, overwriting anything already there. This is the intended behavior when the user is iterating on the recreate step for the same batch.
- For each requested slug, verify `<run-dir>/crawls/<slug>/manifest.json` exists. If any slug is missing its crawl there, offer to auto-discover and symlink from elsewhere (see Case B's discovery logic), or tell the user which ones need crawling first.

**Case B — no explicit `run-dir` (fresh comparison mode, default):**
- **Always create a fresh run-dir** and symlink existing crawls into it. This preserves the prior run's outputs and makes the new run self-contained:
  ```bash
  RUN_ID=$(date '+%Y-%m-%dT%H-%M')
  RUN_DIR=".claude/runs/$RUN_ID"
  mkdir -p "$RUN_DIR/crawls"
  ```
- For each slug, auto-discover the existing crawl in this order:
  1. `.claude/runs/*/crawls/<slug>/` — if multiple match, pick the most recent by directory mtime.
  2. `.claude/site-crawls/<slug>/` — legacy pre-`run-dir` location, still supported as a read-only source.
- Symlink each discovered crawl into the fresh run-dir:
  ```bash
  ln -s "<absolute path to source crawl>" "$RUN_DIR/crawls/<slug>"
  ```
  Symlinks keep disk use minimal and preserve the source crawl as immutable. If the filesystem doesn't support symlinks (rare), fall back to `cp -R`.
- If **any** requested slug has no existing crawl, **stop** and tell the user which sites are missing and need to be crawled first. Do not silently re-crawl — that defeats the purpose of `skip-crawl`.

### Skip-crawl + skip-recreate (re-evaluate)

**Case A — `run-dir=<path>` is explicit (iteration mode, typical):**
- Use the passed run-dir. Re-evaluation archives existing reports before writing new ones (see `evaluate-artist-site-recreation`'s housekeeping), so overwriting in place is safe.
- Verify each slug has both `<run-dir>/crawls/<slug>/` and `<run-dir>/recreations/<slug>/`. If either is missing for any slug, auto-discover per the rules below and symlink in.

**Case B — no explicit `run-dir` (fresh comparison mode, default):**
- Create a fresh run-dir (same as skip-crawl Case B).
- For each slug, auto-discover **both** the crawl and the recreation, and symlink each into the fresh run-dir:
  - Crawl search order: `.claude/runs/*/crawls/<slug>/` (most recent by mtime) → `.claude/site-crawls/<slug>/`.
  - Recreation search order: `.claude/runs/*/recreations/<slug>/` (most recent by mtime) → `.claude/site-recreations/<slug>/`.
- Symlinks preserve the source artifacts as immutable. Do not modify them.
- If any recreation or crawl is missing for a requested slug, **stop** and tell the user what needs to exist first — don't silently re-run the skipped phase.

### After resolution

Tell the user the resolved run-dir up front so they can reference it if the pipeline is interrupted. Example:
```
Run directory: .claude/runs/2026-04-20T14-30/
Mode: skip-crawl (5 existing crawls symlinked from .claude/runs/2026-04-19T23-16/crawls/)
Sites: aidanscrimgeour-com, conorhearnmusic-com, maurashawnscanlin-com, pumpkinbreadband-com, rakishmusic-com
```

## Step 1 — Build or refresh `index.json`

Write `<run-dir>/index.json` with batch metadata. Use realistic starting statuses based on the mode:

```json
{
  "startedAt": "<ISO timestamp>",
  "mode": "full | crawl-only | skip-crawl | re-evaluate",
  "sites": ["<slug1>", "<slug2>", ...],
  "status": {
    "<slug1>": {
      "crawl":    "done | pending",
      "recreate": "done | pending",
      "evaluate": "pending"
    },
    ...
  }
}
```

In skip-crawl mode, every site starts with `crawl: "done"`. In re-evaluate mode, both `crawl` and `recreate` start as `"done"`. If an `index.json` already exists at this path (resumed run), merge rather than overwrite.

Update the status map as phases complete or fail.

## Phase 1 — Crawl

**Skipped entirely in skip-crawl and re-evaluate modes.**

For each URL, follow the `crawl-artist-site` workflow, passing `run-dir=<run-dir>`. Crawl in parallel (Playwright handles concurrent contexts); for batches of > 5 sites, crawl in waves of 3–4.

Output lands at `<run-dir>/crawls/<slug>/`.

Update `index.json` after all crawls complete. If a crawl failed for one site, note the error and continue — don't abort the batch.

If `crawl-only` was set, stop here and summarize.

## Phase 2 — Recreate

**Skipped in re-evaluate mode.**

For each slug, follow the `recreate-artist-site` workflow, passing `run-dir=<run-dir>`. That skill's option A (`run-dir=`) derives `crawl-dir` as `<run-dir>/crawls/<slug>/` — which works correctly whether the crawl is a real directory or a symlink from Step 0.

**Parallelism:** recreations are I/O + compute heavy (npm install, image downloads, build). Run them sequentially by default. Only parallelize if the user explicitly asks and has a fast machine.

Output lands at `<run-dir>/recreations/<slug>/`.

Update `index.json` after each recreation.

## Phase 3 — Evaluate

For each slug, follow the `evaluate-artist-site-recreation` workflow, passing `run-dir=<run-dir>`. Run sequentially — each evaluation boots a local server on a unique port.

**Re-evaluate mode housekeeping:** if `<recreation-dir>/RECREATION_REPORT.md` already exists, archive it as `RECREATION_REPORT-<previous-date>.md` before writing the new one. The evaluate skill does this automatically; just verify it happened.

Reports land at `<run-dir>/recreations/<slug>/RECREATION_REPORT.md`.

Update `index.json` with final status.

## Final summary

After all phases complete, produce a summary table:

```
Run directory: .claude/runs/2026-04-20T14-30/
Mode: skip-crawl

| Site                    | Pages crawled | Build | Quality | Ease  | Total |
|-------------------------|---------------|-------|---------|-------|-------|
| aidanscrimgeour-com     | 10            | ✓     | 9/15    | 12/15 | 21/30 |
| conorhearnmusic-com     | 7             | ✓     | 11/15   | 13/15 | 24/30 |
| ...                     | ...           | ...   | ...     | ...   | ...   |
```

- Highlight the highest-scoring recreation.
- Highlight the site that surfaced the most framework improvement opportunities.
- List the top 3 framework improvement opportunities consolidated across all sites (by frequency/impact, de-duplicated).

In skip-crawl / re-evaluate modes, also note what was reused and what was regenerated ("crawls reused from 2026-04-19T23-16", "recreations rebuilt from scratch").

## Directory layout reference

```
.claude/runs/<YYYY-MM-DDTHH-MM>/
  index.json                         ← batch metadata and status
  crawls/
    aidanscrimgeour-com/             ← source crawl (real dir or symlink)
      manifest.json
      home/
        scroll-01.png
        ...
    aidanscrimgeour-com--recreation/ ← evaluation crawl (always real)
      manifest.json
      ...
    conorhearnmusic-com/
    conorhearnmusic-com--recreation/
  recreations/
    aidanscrimgeour-com/             ← full Astro project (real dir or symlink)
      src/
      _working-notes.md
      RECREATION_REPORT.md
    conorhearnmusic-com/
```

Legacy locations still read as fallbacks in Step 0 auto-discovery:
- `.claude/site-crawls/<slug>/` for crawls
- `.claude/site-recreations/<slug>/` for recreations

## Example invocations

**Full pipeline, three URLs:**
> Run the pipeline on https://siteA.com, https://siteB.com, https://siteC.com

**Recreate existing crawls without re-crawling (fresh run-dir, preserves old):**
> Recreate these 5 sites using existing crawls: aidanscrimgeour-com, conorhearnmusic-com, maurashawnscanlin-com, pumpkinbreadband-com, rakishmusic-com
>
> → Infers `skip-crawl` from "using existing crawls". Creates a fresh `<run-dir>`, symlinks each site's most recent existing crawl into `<run-dir>/crawls/`, then runs recreate + evaluate. The old run stays untouched.

**Iterate on recreate inside an existing run (overwrite mode):**
> skip-crawl run-dir=.claude/runs/2026-04-19T23-16/ — re-recreate the 5 sites after I tweaked the template
>
> → Explicit `run-dir`, so the pipeline reuses it. Existing recreations under that run-dir are overwritten.

**Re-evaluate a previous run after manual tweaks:**
> Re-evaluate the recreations in .claude/runs/2026-04-19T23-16/
>
> → Infers `skip-crawl skip-recreate`; uses the explicit `run-dir`. Evaluate archives each existing `RECREATION_REPORT.md` before writing a new one.

**Crawl only (defer recreate + evaluate for later):**
> Just crawl these 5 sites for now, we'll recreate them later

## Resuming a partial run

If the pipeline was interrupted mid-way, pass the existing `run-dir=<path>` and the flag matching what's already done (`skip-crawl` if crawls finished, `skip-crawl skip-recreate` if recreations finished). The individual skills pick up from where they left off since the directories already exist.

## Error handling

- **Crawl fails for one site:** log the error in `index.json`, skip recreate + evaluate for that site, continue with the others.
- **Recreate fails (build error):** log it, skip evaluate for that site.
- **Evaluate fails (server won't start):** log it, continue.
- **Auto-discovery can't find a required crawl/recreation:** stop and tell the user — don't silently re-run the phase they asked to skip.
- Never abort the entire batch due to one site's failure.
