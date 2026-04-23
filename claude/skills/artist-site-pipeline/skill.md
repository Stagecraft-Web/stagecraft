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

### Path choice — `.claude/runs/` vs `pipeline-runs/`

**Default:** `.claude/runs/<YYYY-MM-DDTHH-MM>/` — matches the convention the individual skills (`crawl-artist-site`, `recreate-artist-site`, `evaluate-artist-site-recreation`) use when you pass `run-dir=` forward.

**Exception — parallel subagents:** if you plan to dispatch one subagent per site for Phase 2 / Phase 3 (the normal batch pattern), the run-dir MUST live somewhere each subagent can write to. Concrete constraints discovered in practice:

1. **Subagent writes are cwd-scoped.** Each subagent inherits the main agent's cwd; `Write` / `Edit` / Bash-redirect into paths outside that tree are denied even when the main agent can write there.
2. **Nested `.claude/` inside the cwd is subagent-locked.** If the main agent runs from inside a worktree (e.g. `repo/.claude/worktrees/<name>/`), writes to that worktree's own `<name>/.claude/...` are blocked for subagents. The *outer* `.claude/` (parent of the worktree) is fine — that's the directory the worktree sits inside — but anything the subagent tries to create at `<name>/.claude/foo/bar` will fail.

When those constraints apply, use a sibling directory at the cwd root:

```bash
RUN_ID=$(date '+%Y-%m-%dT%H-%M')
RUN_DIR="pipeline-runs/$RUN_ID"    # not .claude/runs/
mkdir -p "$RUN_DIR"
```

Test the path is subagent-writable before dispatching work:

```bash
mkdir -p "$RUN_DIR/recreations/_probe" && echo ok > "$RUN_DIR/recreations/_probe/sanity.txt" && rm -rf "$RUN_DIR/recreations/_probe"
```

If that smoke-test Bash write fails, the chosen location is wrong — retry under a different path before spending tokens on a subagent that will hit the same wall.

The individual child skills (`recreate-artist-site`, `evaluate-artist-site-recreation`) don't care whether the run-dir is `.claude/runs/*` or `pipeline-runs/*` — they only care that `<run-dir>/crawls/<slug>/` and `<run-dir>/recreations/<slug>/` resolve. Legacy auto-discovery paths (`.claude/runs/*/crawls/<slug>/`, `.claude/site-crawls/<slug>/`) still work as read sources regardless of where the output run-dir lives.

### Cross-repo setups (crawl source ≠ output location)

Crawls from a different repo checkout can be read through symlinks into the output run-dir. Subagents traverse symlinks for reads; only their writes are cwd-scoped. Typical shape:

```
<cwd>/
  pipeline-runs/2026-04-22T07-43/        ← output, writable for subagents
    crawls/
      artist-a/    → /path/to/other-repo/.claude/runs/.../crawls/artist-a/    (symlink)
      artist-b/    → /path/to/other-repo/.claude/runs/.../crawls/artist-b/    (symlink)
    recreations/
      artist-a/    ← real dir written by the subagent
      artist-b/
```

Template source can also live in a different repo — subagents `cp -R` it into their recreation dir via Bash (reads are unrestricted), and everything after that happens inside the writable output tree.

#### Post-run: relocate output to the canonical history dir

When the run-dir lived under `pipeline-runs/` (subagent-sandbox workaround), it's the *temporary* home — the canonical history of pipeline runs lives in the source repo's `.claude/runs/`. **After all subagents have reported back successfully**, move the run-dir there so future skip-crawl / re-evaluate auto-discovery finds it alongside prior runs:

```bash
SRC="$PWD/pipeline-runs/<RUN_ID>"
DEST=/path/to/source-repo/.claude/runs/<RUN_ID>
mv "$SRC" "$DEST"
rmdir pipeline-runs 2>/dev/null   # remove if now empty
```

The crawl symlinks inside the run-dir use absolute paths, so they still resolve after the move. Recreations are real dirs and move as-is. Update any paths you've already shown the user (e.g. in the final summary).

Do this only once the pipeline is **complete** — moving mid-run would leave subagents writing into a location that no longer exists. If a subagent is still running, wait.

### Full pipeline / crawl-only

- If `run-dir=<path>` is explicit, use it.
- Otherwise generate a fresh one per the path-choice rules above (`.claude/runs/` by default, `pipeline-runs/` if subagent writes will land there):
  ```bash
  RUN_ID=$(date '+%Y-%m-%dT%H-%M')
  RUN_DIR=".claude/runs/$RUN_ID"      # or pipeline-runs/$RUN_ID for subagent-parallel runs
  mkdir -p "$RUN_DIR"
  ```

### Crawl discovery (used by skip-crawl, re-evaluate, and the staleness check)

The canonical crawl storage is `.claude/crawls/<slug>/<YYYY-MM-DDTHH-MM>/` — one dated subdir per crawl of that site, accumulated over time. This is the first place to look; legacy paths remain as fallbacks.

**For a given slug, resolve the "latest crawl" as follows:**

1. `.claude/crawls/<slug>/` — pick the most recent dated subdir (sort by name; ISO-minute format sorts correctly as plain strings).
2. Fallback (legacy): `.claude/runs/*/crawls/<slug>/` that is a **real directory** (not a symlink) — pick the most recent by mtime.
3. Fallback (legacy): `.claude/site-crawls/<slug>/`.

If all three come up empty, the slug has never been crawled.

#### Staleness check

Before using a discovered crawl, check its age. Parse `manifest.json.crawledAt` (ISO timestamp); fall back to the directory's name (for canonical dated subdirs) or mtime (for legacy locations) if the manifest is missing.

**If the latest crawl is ≥ 30 days old, STOP and ask the user:**

> `conorhearnmusic-com`'s latest crawl is from 2026-03-10 (43 days old). Re-crawl now, or continue with the stale data?

Do this per-slug, batched into one question if multiple slugs are stale ("2 of the 5 requested sites have stale crawls: …"). Only proceed once the user has answered. If they want a re-crawl, invoke `crawl-artist-site` for those slugs (output lands in `.claude/crawls/<slug>/<new-timestamp>/`), then re-run discovery to pick up the fresh subdir.

This check exists to catch cases where the source site has meaningfully changed since the last capture — stale source crawls produce recreations of a site that no longer exists.

### Skip-crawl

**Two sub-cases depending on whether the user passed an explicit `run-dir`:**

**Case A — `run-dir=<path>` is explicit (iteration mode):**
- Use the passed run-dir as the working directory. New recreations will land in `<run-dir>/recreations/<slug>/`, overwriting anything already there. This is the intended behavior when the user is iterating on the recreate step for the same batch.
- For each requested slug, verify `<run-dir>/crawls/<slug>/` resolves to a valid crawl (follow the symlink if it is one; check `manifest.json` exists at the end). If any slug is missing or broken, auto-discover per the **Crawl discovery** rules above and repoint the symlink — skipping the staleness check is fine here since the user explicitly chose to reuse this run-dir.

**Case B — no explicit `run-dir` (fresh comparison mode, default):**
- **Always create a fresh run-dir** and symlink existing crawls into it. This preserves prior runs' outputs and makes the new run self-contained:
  ```bash
  RUN_ID=$(date '+%Y-%m-%dT%H-%M')
  RUN_DIR=".claude/runs/$RUN_ID"
  mkdir -p "$RUN_DIR/crawls"
  ```
- For each slug, use the **Crawl discovery** rules above to find the latest crawl. Run the **Staleness check** before committing. Once confirmed, symlink into the fresh run-dir:
  ```bash
  ln -s "<absolute path to chosen crawl>" "$RUN_DIR/crawls/<slug>"
  ```
  Symlinks keep disk use minimal and preserve the source crawl as immutable. If the filesystem doesn't support symlinks (rare), fall back to `cp -R`.
- If **any** requested slug has no crawl anywhere, **stop** and tell the user which sites are missing. Do not silently re-crawl — that defeats the purpose of `skip-crawl`. (The staleness-prompt above is the one place re-crawling is offered inside `skip-crawl` mode, and only with explicit user confirmation.)

### Skip-crawl + skip-recreate (re-evaluate)

**Case A — `run-dir=<path>` is explicit (iteration mode, typical):**
- Use the passed run-dir. Re-evaluation archives existing reports before writing new ones (see `evaluate-artist-site-recreation`'s housekeeping), so overwriting in place is safe.
- Verify each slug has both `<run-dir>/crawls/<slug>/` and `<run-dir>/recreations/<slug>/`. If either is missing for any slug, auto-discover per the rules below and symlink in. Staleness check does **not** apply to re-evaluate mode (we're scoring the existing recreation against the crawl it was built from — that crawl is the correct reference regardless of age).

**Case B — no explicit `run-dir` (fresh comparison mode, default):**
- Create a fresh run-dir (same as skip-crawl Case B).
- For each slug, auto-discover **both** the crawl and the recreation, and symlink each into the fresh run-dir:
  - Crawl search order: use the **Crawl discovery** rules above (no staleness check in re-evaluate — see above).
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

For each URL, follow the `crawl-artist-site` workflow. Crawls land at the canonical location `.claude/crawls/<slug>/<YYYY-MM-DDTHH-MM>/` (not under the run-dir — see the `crawl-artist-site` skill for the rationale). Crawl in parallel (Playwright handles concurrent contexts); for batches of > 5 sites, crawl in waves of 3–4.

After each crawl completes, symlink it into the run-dir so downstream phases see the familiar `<run-dir>/crawls/<slug>/` path:

```bash
ln -s "$(pwd)/.claude/crawls/<slug>/<timestamp>" "<run-dir>/crawls/<slug>"
```

Update `index.json` after all crawls complete. If a crawl failed for one site, note the error and continue — don't abort the batch.

If `crawl-only` was set, stop here and summarize. The canonical dated subdirs remain under `.claude/crawls/<slug>/` for future runs to pick up.

## Phase 2 — Recreate

**Skipped in re-evaluate mode.**

For each slug, follow the `recreate-artist-site` workflow, passing `run-dir=<run-dir>`. That skill's option A (`run-dir=`) derives `crawl-dir` as `<run-dir>/crawls/<slug>/` — which works correctly whether the crawl is a real directory or a symlink from Step 0.

### Parallelism via subagents

Recreations are I/O + compute heavy (npm install, image downloads, build). For batches of ≥ 2 sites, **dispatch one subagent per site via the Agent tool**. In practice this halves or quarters wall-clock vs. sequential-in-main, and each site's build runs in its own node_modules/ so they don't collide.

**Always run a smoke-test subagent on ONE site before fanning out.** The first subagent confirms the run-dir is actually writable for subagents (Step 0's sanity-check is a proxy but hits a narrower surface than a real recreate). Only dispatch the remaining N-1 subagents after the smoke test returns a real `RECREATION_REPORT.md` path. This avoids spending tokens on N parallel subagents that all hit the same sandbox wall.

**Instruct each subagent to fail fast on the first write denial.** If the sandbox blocks their output path, they should stop and report the exact error rather than looping through Write → Edit → Bash redirect → `dangerouslyDisableSandbox` workarounds. The loop wastes tokens without producing anything recoverable.

### Subagent prompt essentials

Each subagent needs at minimum:

- The run-dir path (absolute — relative paths break across subagent cwds)
- The slug they own; explicit instruction not to touch other slugs' directories
- The template source path (can be in a different repo — Bash reads work)
- A unique evaluation port (see Phase 3's convention)
- A reminder that writes outside the main agent's cwd tree are denied
- Instructions to follow the `recreate-artist-site` and `evaluate-artist-site-recreation` skills at `<repo>/claude/skills/<skill-name>/SKILL.md`
- Explicit mention that `evaluate-artist-site-recreation` now includes a review + adjust + re-crawl loop between the initial recreation crawl and scoring; the subagent should not short-circuit that loop
- A short report-back template (under ~300 words) so they don't over-narrate

Output lands at `<run-dir>/recreations/<slug>/`.

Update `index.json` as each subagent reports back.

## Phase 3 — Evaluate (includes refinement loop)

For each slug, follow the `evaluate-artist-site-recreation` workflow, passing `run-dir=<run-dir>`. As of the refinement-loop update, that skill internally runs:

1. Boot server + initial recreation crawl (`<run-dir>/crawls/<slug>--recreation-pre-refine/`)
2. Expert frontend review — appends `[review]` entries to `<recreation-dir>/_working-notes.md`, calling out specific, concrete fidelity improvements *or* intentional-divergence justifications
3. Adjustment pass — applies the review's improvements in place, logging `[adjustment]` outcomes (`applied` / `blocked` / `skipped`) back to `_working-notes.md`. Framework-blocked items surface as `[opportunity]` entries, not workarounds
4. Re-boot server + re-crawl the refined recreation (`<run-dir>/crawls/<slug>--recreation/`) — this is the **scoring** crawl
5. Diff, consolidate and review notes, score, write `RECREATION_REPORT.md`

The per-site subagent that owns this phase needs enough time budget for two crawls plus the adjustment work between them. Expect ~1.3–1.6x the wall-clock of a no-refine evaluation per site.

### Port assignment for parallel evaluations

Each evaluation boots a local server, so parallel runs need distinct ports. Use `4322 + <slug-index>`:

- site 1 → 4322
- site 2 → 4323
- site 3 → 4324
- site 4 → 4325
- site 5 → 4326

This avoids clashing with the user's dev server (typically 4321) and keeps ports contiguous and easy to clean up with `lsof -ti:4322-4326 | xargs kill` if a subagent leaves one dangling.

When each subagent owns its full site (recreate + evaluate together, which is the recommended batch pattern), just pass that site's assigned port in the subagent prompt.

### Re-evaluate mode housekeeping

If `<recreation-dir>/RECREATION_REPORT.md` already exists, archive it as `RECREATION_REPORT-<previous-date>.md` before writing the new one. The evaluate skill does this automatically; just verify it happened.

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

Source crawls are **site-keyed** and live outside any specific run. Runs are **date-keyed** workspaces that symlink to the crawl they're working against, plus hold the run-specific recreation and eval crawls.

```
.claude/
  crawls/                              ← canonical, site-keyed crawl storage
    aidanscrimgeour-com/
      2026-04-19T23-16/                ← one crawl
        manifest.json
        home/
          scroll-01.png
          ...
      2026-05-20T10-00/                ← a later re-crawl of the same site
        manifest.json
        ...
    conorhearnmusic-com/
      2026-04-19T23-16/
      2026-04-22T16-00/                ← newer crawl picked up by later runs
  runs/
    <YYYY-MM-DDTHH-MM>/                ← one batch / iteration
      index.json                       ← batch metadata and status
      crawls/
        aidanscrimgeour-com            → ../../crawls/aidanscrimgeour-com/2026-04-19T23-16/   (symlink)
        aidanscrimgeour-com--recreation-pre-refine/  ← eval's initial crawl (real dir, run-scoped)
          manifest.json
          ...
        aidanscrimgeour-com--recreation/             ← eval's post-refine crawl (real dir, run-scoped; scoring surface)
          manifest.json
          ...
        conorhearnmusic-com            → ../../crawls/conorhearnmusic-com/2026-04-22T16-00/   (symlink — newer crawl)
        conorhearnmusic-com--recreation-pre-refine/
        conorhearnmusic-com--recreation/
      recreations/
        aidanscrimgeour-com/           ← full Astro project (real dir)
          src/
          _working-notes.md            ← spans recreate phase + eval's review+adjust phase
          RECREATION_REPORT.md
        conorhearnmusic-com/
```

The eval-phase crawls (`--recreation-pre-refine/`, `--recreation/`) stay inside the run-dir because they're tied to that run's specific recreation version and aren't reusable across runs. Only the source-site crawl is cross-run shareable, and that one lives in the top-level `crawls/`.

Legacy locations still read as fallbacks in auto-discovery:
- `.claude/runs/*/crawls/<slug>/` when the crawl is a **real directory** (pre-reorg runs that embedded their source crawl)
- `.claude/site-crawls/<slug>/` (pre-`runs/` era)
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
- **Refinement loop exceeds budget / adjustments break the build:** the evaluate skill's adjustment pass should revert and mark outstanding items `blocked` rather than leave a half-refined site. If a subagent reports an un-recoverable mid-refine state, skip scoring for that site, keep the pre-refine crawl as the trace, and flag for manual follow-up.
- **Auto-discovery can't find a required crawl/recreation:** stop and tell the user — don't silently re-run the phase they asked to skip.
- Never abort the entire batch due to one site's failure.
