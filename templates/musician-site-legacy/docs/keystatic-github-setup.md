# Keystatic GitHub mode + Appearance sidebar setup

This guide walks through the one-time setup required to enable
production editing — both via Keystatic's admin UI at `/keystatic` and via
the Appearance sidebar that appears on the live site.

## What you're setting up

Keystatic in **GitHub mode** uses OAuth to sign users in and commits
changes to your repo via GitHub's API. The Appearance sidebar on the
public site piggybacks on the same OAuth session: when a signed-in user
visits the site, the sidebar appears, edits live-preview as they change
controls, and "Save" commits to whichever branch the user is currently
editing on in Keystatic.

## Step 1 — Register a GitHub App

1. Go to **GitHub → Settings → Developer settings → GitHub Apps → New
   GitHub App**.
2. Fill in:
   - **GitHub App name**: something like `Stagecraft – <yourname>`. Must be
     globally unique on GitHub.
   - **Homepage URL**: your site's URL (e.g. `https://yourartistname.com`).
   - **Callback URL**: `https://yourartistname.com/api/keystatic/github/oauth/callback`
   - **Request user authorization (OAuth) during installation**: checked.
   - **Webhook**: uncheck "Active" — not needed.
3. **Repository permissions**:
   - Contents: **Read and write** (needed to commit)
   - Metadata: Read-only (required by default)
   - Pull requests: **Read and write** (so Keystatic can open PRs)
4. **Account permissions**: none needed.
5. **Where can this GitHub App be installed?** Any account.
6. Click **Create GitHub App**.
7. On the next page:
   - Note the **App ID** (top of the page).
   - Click **Generate a new client secret** — copy this somewhere safe;
     you can't see it again after leaving the page.
   - The **Client ID** is visible near the top.
8. Click **Install App** in the left sidebar and install it on the
   repository that holds your site.

## Step 2 — Set Netlify environment variables

In your site's Netlify project, **Site settings → Environment variables**,
add the following. They all need to be set for the site to build and for
the sidebar to appear.

| Variable | Value | Notes |
|---|---|---|
| `PUBLIC_KEYSTATIC_STORAGE` | `github` | Opts Keystatic into GitHub mode. The `PUBLIC_` prefix makes it available in the browser bundle. |
| `PUBLIC_KEYSTATIC_REPO` | `owner/repo` | E.g. `jdoe/my-site`. Target of all commits. |
| `KEYSTATIC_GITHUB_CLIENT_ID` | From step 1 | Server-side only. |
| `KEYSTATIC_GITHUB_CLIENT_SECRET` | From step 1 | Server-side only. Treat as secret. |
| `KEYSTATIC_SECRET` | Any 32+ random bytes | Used to encrypt the session refresh-token cookie. Generate with `openssl rand -hex 32`. |

Redeploy after saving. Netlify picks up env-var changes only on next
build.

## Step 3 — Verify

1. Visit `https://yourartistname.com/keystatic`. It should redirect you
   through GitHub's OAuth consent screen on first visit. Approve.
2. After returning you should land on Keystatic's admin UI, viewing the
   default branch.
3. Go back to the site (`/` or any other page). A small **Appearance**
   button should appear in the bottom-right corner.
4. Click it — the sidebar opens. Changes live-preview on the page; Save
   commits to whichever branch you selected.
5. Refresh Keystatic: your commit is visible in the change history.

## How the sidebar finds the GitHub token

Keystatic stores the signed-in user's GitHub access token in a
non-httpOnly cookie named `keystatic-gh-access-token` (readable from
page JS). The sidebar reads that cookie, and uses the token for the
commit mutation. Nothing new is stored on our side.

**Implications:**
- The sidebar is same-origin with Keystatic (both on
  `yourartistname.com`). If you ever serve Keystatic from a different
  domain, the cookie stops being shared and the sidebar can't read it.
- Signed-out visitors have no cookie, so the sidebar renders only a
  small "Sign in to edit" link that redirects to `/keystatic`.
- The cookie expires with Keystatic's normal session lifecycle. Mid-edit
  expiry is handled by hitting the refresh endpoint and retrying the
  commit.

## Development

The sidebar works in local dev regardless of storage mode — the save path
switches automatically:

| Env config | Storage | Sidebar save path |
|---|---|---|
| Dev, `PUBLIC_KEYSTATIC_STORAGE` unset | Local filesystem | Dev-only Astro route writes `appearance.json` to disk; Vite HMRs the page. No auth. |
| Dev, `PUBLIC_KEYSTATIC_STORAGE=github` | GitHub via Keystatic OAuth | Same GitHub-GraphQL path as production. Requires the GitHub App's callback URL to also include `http://localhost:4321/api/keystatic/github/oauth/callback`. |
| Prod (Netlify), `PUBLIC_KEYSTATIC_STORAGE=github` | GitHub | GitHub-GraphQL commit to the selected branch. The full production experience. |
| Prod, `PUBLIC_KEYSTATIC_STORAGE` unset or `local` | *invalid* | Sidebar hides itself — filesystem writes would be lost on Netlify's ephemeral functions. |

The dev-only save endpoint lives at `src/pages/api/stagecraft/appearance.ts`
and 404s in production builds, so there's no risk of it being reachable
without auth in a real deploy.

## Troubleshooting

- **Sidebar never appears** → you're not signed in, or
  `PUBLIC_KEYSTATIC_STORAGE !== "github"` at build time.
- **"Repository ... not found"** in the sidebar → the user's GitHub App
  installation doesn't include the repo, or `PUBLIC_KEYSTATIC_REPO` is
  typo'd.
- **Save fails with `BRANCH_PROTECTION_RULE_VIOLATION`** → the branch
  you selected requires PRs. Switch to a draft branch in the picker
  (create one via Keystatic's branch switcher), or relax the protection.
- **Font you picked isn't rendering** → open the browser's network tab
  and check the `fonts.googleapis.com/css2?…` response. 400 means the
  family name is wrong; rerun `npm run validate:content` locally —
  it'll tell you which fonts don't resolve.
