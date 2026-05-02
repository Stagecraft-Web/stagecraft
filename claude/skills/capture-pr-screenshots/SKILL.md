---
name: capture-pr-screenshots
description: Use when the user opts into automated PR screenshot capture — boots the dev server, runs the screenshot capture script, uploads the images to a public gist, and returns ready-to-paste markdown for the PR body. Trigger phrases include "capture screenshots for the PR", "run the screenshot capture", "include screenshots", "screenshot the changes", or any explicit request to capture/upload PR screenshots. This is the cloud-session counterpart to the manual workflow in the create-pr skill — invoke it only when the user has asked for screenshots, not on every PR.
---

# Capture PR Screenshots

Opt-in skill that automates the capture → upload → embed flow described
in the `create-pr` skill. Designed for cloud sessions where there's no
human at a terminal to run the dev server and a capture script in
parallel, but works locally too.

The base convention (naming, format, why-a-public-gist) lives in
`claude/skills/create-pr/SKILL.md` — read that first if anything below
is ambiguous. This skill is the runnable counterpart, not a
replacement for those rules.

## When to invoke

- The user explicitly asks for screenshots on a PR ("capture
  screenshots", "include screenshots", "run the capture").
- A PR touches rendered UI (public site or Keystatic admin) **and**
  the user has confirmed they want screenshots embedded.

Do **not** invoke automatically on every PR. Backend / refactor /
typing-only PRs should note "no screenshots — no UI delta" in the PR
body per the create-pr convention.

## Scope

v1 covers the `templates/musician-site/` template, which already has
the `scripts/capture-pr-screenshots.mjs` helper. For changes in
`apps/web/` or other apps, fall back to the manual workflow in the
create-pr skill until a per-app capture script is added.

## Prerequisites

- **Playwright Chromium** — installed automatically by the
  `SessionStart` hook at `.claude/hooks/session-start.sh`. If the hook
  failed (check session start logs), run manually:

  ```bash
  npx --yes playwright install --with-deps chromium
  ```

- **`gh` CLI authenticated** — needed for the gist push. Verify with:

  ```bash
  gh auth status
  ```

  In cloud sessions, auth is provisioned via the GitHub MCP server's
  token; if `gh auth status` errors, surface that to the user — gist
  upload won't work without it. (Image capture still will, so the user
  can upload the files manually if needed.)

- **Branch ready for PR** — typecheck + lint + test should already
  pass. Don't run capture on a broken branch.

## Workflow

### 1. Boot the dev server

```bash
cd templates/musician-site
npm install   # only if node_modules is absent or stale
npm run dev   # run in background; binds to http://localhost:4321
```

Run `npm run dev` via Bash with `run_in_background: true` so capture
can run in the foreground. Wait for the server to be ready before
capturing — poll `http://localhost:4321/` until it returns 200, with a
sensible timeout (~60s).

### 2. Run the capture script

```bash
node scripts/capture-pr-screenshots.mjs http://localhost:4321 \
     /tmp/pr-screenshots
```

Output naming, viewport (1440×900), and Keystatic admin handling are
documented in the script header. If the user named specific views,
pass `--only site-home,admin-releases` to scope the run.

Inspect the resulting `manifest.json` — if `errors` is non-empty,
report which captures failed and stop before uploading. Don't push
half-broken evidence to a gist.

### 3. Upload to a public gist

Follow the upload steps in the create-pr skill (§ Workflow → Upload to
a public gist). In short:

1. `gh gist create --public --desc "stagecraft PR #<N> screenshots" /tmp/pr-readme.md`
2. Clone the gist locally, copy `/tmp/pr-screenshots/*.{png,jpg}` in,
   commit, push (with the `gh auth token` URL trick).

Use the actual PR number in the description — pull it from `gh pr
view --json number` once the PR exists, or substitute `branch
<branch-name>` if the capture happens before the PR is opened.

### 4. Verify URLs are anonymously reachable

Before pasting URLs into the PR body, spot-check at least one:

```bash
curl -sI "https://gist.githubusercontent.com/<user>/<GIST_ID>/raw/<file>" | head -1
# expect: HTTP/2 200
```

This catches the most common foot-gun: pushing to a gist with an
upstream URL that requires auth.

### 5. Embed in the PR body

Format per the create-pr skill — a `## Screenshots` section split into
`### Site` and `### Admin` subsections, one `![alt](url)` per
captured view. Keep alt text descriptive (used by screen readers and
shown when the image fails to load).

If the PR already exists, update its body with `gh pr edit <N> --body
"$(...)"` rather than appending — replace the prior screenshot section
cleanly.

## Failure modes to surface

- **Playwright not installed** → ask the user to re-run the
  SessionStart hook, or install manually.
- **Dev server didn't come up in time** → check `npm install` ran,
  then look at the dev server log (the background bash result).
- **Keystatic admin captures landed on a sign-in page** →
  `PUBLIC_KEYSTATIC_STORAGE=github` is set; capture admin views
  manually from a signed-in browser per the create-pr skill.
- **`gh auth status` fails** → leave the captures on disk and tell
  the user how to upload manually; don't silently skip.
