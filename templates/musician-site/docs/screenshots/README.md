# PR screenshots

Screenshots that are embedded in pull-request descriptions live here,
committed alongside the code change they document.

## Directory layout

```
docs/screenshots/
  pr-<N>/
    site-<page-name>.png     # rendered public site
    admin-<collection>.png   # Keystatic admin view
    …
```

- One directory per open PR number (e.g. `pr-35/`).
- Every screenshot referenced by the PR body lives under that directory.
- Once the PR merges the directory stays in-tree as a historical record
  of what the change looked like.

## Naming convention

| Prefix   | Meaning                                            | Example                  |
| -------- | -------------------------------------------------- | ------------------------ |
| `site-`  | Public-facing Astro page (rendered at the dev URL) | `site-home.png`          |
| `admin-` | Keystatic admin view (`/keystatic/...`)            | `admin-releases.png`     |

Use the page slug or collection name as the second token. For nested
admin views, include the item slug: `admin-releases-item-first-album.png`.

## File format + size

- PNG for admin UI (lots of text, transparency, crisp edges).
- JPEG (`.jpg`) for site views — they photograph like magazine pages,
  JPEG stays under the budget.
- Aim for **< 500 KB** per image. If a raw Playwright capture is larger
  than that, re-run it as JPEG (`type: "jpeg", quality: 80`) or post-
  process with `pngquant` / `jpegoptim`.
- Default viewport is 1440×900 (matches the site crawler skill).

## How to embed in a PR body

Use a **relative path from the repo root**. GitHub resolves it against
the PR branch automatically:

```markdown
![Home page](templates/musician-site/docs/screenshots/pr-42/site-home.jpg)
![Keystatic releases](templates/musician-site/docs/screenshots/pr-42/admin-releases.png)
```

## Refactor-only PRs

If a PR is a pure refactor with no visible UI change (no site-side
diff, no Keystatic admin diff), screenshots may be omitted. In that
case the PR body should say so explicitly, e.g.:

> No screenshots — pure refactor, no visible UI change.

If the refactor touches a Keystatic admin surface (say, derived
`fields.select` options), still capture one admin screenshot showing
the options continue to render correctly post-refactor.

## Capturing screenshots

The helper script at `scripts/capture-pr-screenshots.mjs` automates
the common captures (site home, every nav page, Keystatic admin home,
one screenshot per collection). See that script's top-of-file
comment for usage.

If your local Keystatic admin requires authentication you can't
satisfy headlessly, the script skips the `admin-*` captures and
logs a warning — capture those manually from a signed-in browser
and drop the PNGs into the `pr-<N>/` directory with the same naming.
