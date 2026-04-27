---
name: create-pr
description: Use when opening or revising a pull request in the stagecraft monorepo. Enforces the screenshots convention — PRs that change rendered UI (public site or Keystatic admin) must embed screenshots from a public gist, since this repo is private and in-tree / raw.githubusercontent URLs don't render anonymously. Trigger phrases include "create a PR", "open a pull request", "update my PR description", or any task where a branch is ready for review.
---

# Create PR

Open or revise a pull request. PRs that change rendered UI — public
site, Keystatic admin, or both — must embed screenshots in the body so
reviewers can see what changed without pulling the branch.

The system prompt's standard "Creating pull requests" workflow handles
the `gh pr create` mechanics; this skill covers the screenshots
convention that wraps around it.

## When screenshots apply

- **UI changes** (site or admin): embed the relevant views.
- **Refactor / backend / types / tooling** with no visible UI delta:
  note it explicitly in the PR body — e.g. _"No screenshots — pure
  refactor, no visible UI change."_
- **Admin-only tweaks** (derived select options, schema-driven UI):
  still capture one admin view to confirm rendering.

## Why a public gist

This repo is private. `raw.githubusercontent.com` URLs 404 for anyone
not authenticated with repo access, so in-tree images don't render in
the PR body for most viewers. `gist.githubusercontent.com` content is
anonymously reachable even when the author's repos are private — that
is exactly what a PR-body image embed needs. Not committing
screenshots also keeps the repo free of per-PR binary bloat.

## Naming

| Prefix   | Meaning                                         | Example              |
| -------- | ----------------------------------------------- | -------------------- |
| `site-`  | Public page rendered at the dev URL             | `site-home.jpg`      |
| `admin-` | Keystatic admin view (`/keystatic/...`)         | `admin-releases.png` |

Second token is the page slug or collection name. For nested admin
views, append the item slug: `admin-releases-item-first-album.png`.

## Format + size

- **PNG** for admin UI (text, crisp edges, transparency).
- **JPEG** (`.jpg`) for site views.
- **< 500 KB** per image. If a raw capture is larger, re-shoot as
  JPEG (`quality: 80`) or post-process with `pngquant` / `jpegoptim`.
- Default viewport **1440×900** (matches the site crawler).

## Workflow

### 1. Capture

For the musician-site template, use the helper script — it covers
site home, each nav page, and the Keystatic admin views:

```bash
# Terminal 1: dev server
cd templates/musician-site
npm run dev

# Terminal 2: capture
node scripts/capture-pr-screenshots.mjs http://localhost:4321 \
     /tmp/pr-<N>-screenshots
```

See the script header for flags (`--only`, `--jpeg-quality`,
`--site-format`). For other projects, capture manually at 1440×900
using the same naming convention.

### 2. Upload to a public gist

```bash
# Seed the gist (needs at least one file to create it)
echo "stagecraft PR #<N> screenshots" > /tmp/pr-<N>-readme.md
gh gist create --public --desc "stagecraft PR #<N> screenshots" \
  /tmp/pr-<N>-readme.md
# → https://gist.github.com/<user>/<GIST_ID>

# Clone, copy images in, commit
git clone https://gist.github.com/<GIST_ID>.git /tmp/pr-<N>-gist
cp /tmp/pr-<N>-screenshots/*.{png,jpg} /tmp/pr-<N>-gist/
cd /tmp/pr-<N>-gist
git add -A && git commit -m "Add PR #<N> screenshots"

# Push — the gist's default clone URL can't auth from CLI, so embed
# a token in the remote URL:
git remote set-url origin \
  "https://<github-user>:$(gh auth token)@gist.github.com/<GIST_ID>.git"
git push
```

### 3. Embed in the PR body

```markdown
## Screenshots

### Site
![Home](https://gist.githubusercontent.com/<user>/<GIST_ID>/raw/site-home.jpg)

### Admin
![Releases admin](https://gist.githubusercontent.com/<user>/<GIST_ID>/raw/admin-releases.png)
```

Verify each URL returns HTTP 200 anonymously before submitting:

```bash
curl -sI "https://gist.githubusercontent.com/<user>/<GIST_ID>/raw/site-home.jpg" | head -1
# HTTP/2 200
```

## Keystatic admin auth

The template's dev Keystatic runs in `local` storage mode without
sign-in, so the capture script reaches the admin dashboard headlessly.
If your setup uses `PUBLIC_KEYSTATIC_STORAGE=github`, the admin
requires OAuth — the script will hit the sign-in page instead.
Capture admin frames manually from a signed-in browser in that case
and drop them into `/tmp/pr-<N>-screenshots/` with the standard
naming before uploading.
