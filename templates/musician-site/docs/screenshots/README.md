# PR screenshots

Screenshots embedded in pull-request descriptions are hosted on a
**public gist**, not committed in-tree.

## Why a gist

This repo is private. Raw file URLs on a private repo
(`raw.githubusercontent.com/...`) return 404 for anyone who isn't
authenticated with repo access — so images committed in-tree
don't render in the PR body for most viewers. Content served from
`gist.githubusercontent.com` is anonymously reachable even when the
author's repos are private, which is exactly what a PR-body image
embed needs.

Not committing screenshots also keeps the repo free of per-PR
binary bloat.

## Workflow

### 1. Capture

Capture to a local temp directory. The helper script at
`scripts/capture-pr-screenshots.mjs` automates the common set
(site home, every nav page, Keystatic admin home, one per collection):

```bash
# Terminal 1: dev server
npm run dev

# Terminal 2: capture
node scripts/capture-pr-screenshots.mjs http://localhost:4321 \
     /tmp/pr-<N>-screenshots
```

See the script header for flags (`--only`, `--jpeg-quality`,
`--site-format`).

### 2. Upload to a public gist

```bash
# Seed a public gist (needs at least one file to create it)
echo "stagecraft PR #<N> screenshots" > /tmp/pr-<N>-readme.md
gh gist create --public --desc "stagecraft PR #<N> screenshots" \
  /tmp/pr-<N>-readme.md
# → prints https://gist.github.com/<user>/<GIST_ID>

# Clone, copy images in, commit
git clone https://gist.github.com/<GIST_ID>.git /tmp/pr-<N>-gist
cp /tmp/pr-<N>-screenshots/*.{png,jpg} /tmp/pr-<N>-gist/
cd /tmp/pr-<N>-gist
git add -A
git commit -m "Add PR #<N> screenshots"

# Push — the gist's default clone URL can't auth from CLI, so
# embed a token in the remote URL:
git remote set-url origin \
  "https://<github-user>:$(gh auth token)@gist.github.com/<GIST_ID>.git"
git push
```

### 3. Embed in the PR body

```markdown
![Home page](https://gist.githubusercontent.com/<user>/<GIST_ID>/raw/site-home.jpg)
![Keystatic releases](https://gist.githubusercontent.com/<user>/<GIST_ID>/raw/admin-releases.png)
```

Verify each URL returns HTTP 200 anonymously before submitting:

```bash
curl -sI "https://gist.githubusercontent.com/<user>/<GIST_ID>/raw/site-home.jpg" | head -1
# HTTP/2 200
```

## Naming convention

| Prefix   | Meaning                                            | Example                  |
| -------- | -------------------------------------------------- | ------------------------ |
| `site-`  | Public-facing Astro page (rendered at the dev URL) | `site-home.jpg`          |
| `admin-` | Keystatic admin view (`/keystatic/...`)            | `admin-releases.png`     |

Use the page slug or collection name as the second token. For nested
admin views, include the item slug: `admin-releases-item-first-album.png`.

## File format + size

- PNG for admin UI (lots of text, transparency, crisp edges).
- JPEG (`.jpg`) for site views — they photograph like magazine pages,
  JPEG stays under the budget.
- Aim for **< 500 KB** per image. If a raw Playwright capture is larger,
  re-run it as JPEG (`type: "jpeg", quality: 80`) or post-process with
  `pngquant` / `jpegoptim`.
- Default viewport is 1440×900 (matches the site crawler skill).

## Refactor-only PRs

If a PR is a pure refactor with no visible UI change (no site-side
diff, no Keystatic admin diff), screenshots may be omitted. Document
that in the PR body explicitly, e.g.:

> No screenshots — pure refactor, no visible UI change.

If the refactor touches a Keystatic admin surface (say, derived
`fields.select` options), still capture one admin screenshot showing
the options continue to render correctly post-refactor.

## Keystatic admin needs auth?

The template's dev Keystatic runs in `local` storage mode without
sign-in, so the capture script reaches the admin dashboard headlessly.
If your setup uses `PUBLIC_KEYSTATIC_STORAGE=github`, the admin
requires OAuth — the script will hit the sign-in page instead.
Capture admin frames manually from a signed-in browser in that case
and drop them into your `/tmp/pr-<N>-screenshots/` directory with the
standard naming before uploading to the gist.
