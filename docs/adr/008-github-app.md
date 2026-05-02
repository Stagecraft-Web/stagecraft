# ADR-008: Stagecraft GitHub App

## Status
Proposed

## Context
ADR-007 specifies that the new musician-site template publishes content by committing to the artist's GitHub repo via a Stagecraft-owned GitHub App. The publish endpoint runs on the artist's deployed site (a serverless function on Netlify/Vercel), not on the platform. Several decisions follow from that split:

- Where do GitHub App credentials live? At the edge (each artist's site holds the App private key) or brokered from the platform?
- How does an artist's repo get the App installed in the first place?
- How are commits attributed (artist as author, App as committer)?
- What happens when an artist uninstalls the App, transfers their repo, or rotates credentials?

This ADR captures those decisions for the v1 publish flow. ADR-006 (NextAuth + GitHub OAuth on the platform) is unaffected — that governs platform login; this governs commits to artist repos.

## Decision
A single Stagecraft-wide GitHub App authorizes commits to artist repos. The App's private key lives only on the platform; artist sites obtain short-lived installation tokens from a platform-hosted **token broker** endpoint. Installation IDs per site are stored in the platform database alongside the existing `Site` record.

### 1. App identity and permissions
- Single App registered against the Stagecraft GitHub org. Name: `stagecraft` (final name TBD at registration).
- **Permissions (least-privilege):**
  - `Contents: Read & write` — required for commits and reading existing files (image dedup check).
  - `Metadata: Read` — always required for any App.
  - `Pull requests: Read & write` — **deferred**. Only needed when ADR-007's "draft branches" follow-up lands. Add via App permission update at that time; existing installations re-confirm.
- **Subscribe to events:**
  - `installation` — to detect installs/uninstalls.
  - `installation_repositories` — to detect repo additions/removals on existing installations.
  - No `push` or `repository` subscriptions for v1; the platform reacts to its own commits, not to incoming activity.

### 2. Token model: platform-hosted broker
The artist site's `/api/publish` does not hold the App private key. Instead it requests a short-lived installation token from the platform.

```
artist-site /api/publish
  → POST https://platform.stagecraft.com/api/publish-token
      { siteId, sessionToken }   # session = magic-link cookie from ADR-007
  ← { token, expiresAt }          # GitHub installation token, ~1hr lifetime
  → uses token to commit via Octokit Git Data API
  → discards token
```

- **Why broker, not at-edge:** the App private key is the master credential. Distributing it to every artist site multiplies the blast radius of any single-site compromise. The broker model keeps the master credential confined to the platform's secret manager.
- **Auth from artist site to platform:** the magic-link session cookie (ADR-007 §4) is forwarded; the broker validates it against the platform DB and confirms the requesting site matches the session's `siteId`.
- **Tokens are not cached on the artist site.** Each publish requests a fresh token. Tokens may be cached on the platform for the remaining lifetime to reduce GitHub API calls; cache key is `installationId`.
- **Rate limiting** lives in the broker, not in the artist site — the broker is the chokepoint for all publishes.

### 3. Installation flow
- Artist signs in to the platform via GitHub OAuth (per ADR-006).
- Platform dashboard shows a "Connect repo" CTA → links to GitHub App install URL with `state` parameter encoding the artist's `siteId`.
- Artist selects the repo on GitHub's install screen → GitHub redirects to platform `/api/github/install-callback?state=<siteId>&installation_id=<id>`.
- Callback validates `state`, persists `installationId` and `repoFullName` on the `Site` record.
- One installation per repo. Multiple repos under one artist's GitHub account require multiple installations; each maps to a different `Site`.

### 4. Commit author and committer
- **Committer:** `stagecraft-app[bot] <{appId}+stagecraft-app[bot]@users.noreply.github.com>` (GitHub generates the noreply email for App identities).
- **Author:** the artist's email from the magic-link session, with a chosen name (also from the platform `Site` record). This makes the artist visible in `git log` and GitHub's contribution graph (when they later associate that email with their GitHub account).
- **Commit messages** include a structured trailer: `Stagecraft-Publish-Id: <uuid>` to enable later auditing / rollback.

### 5. Credential storage
- App private key (`.pem`) lives in the platform's secret manager (env var on the deployed platform — Netlify/Vercel environment, or a dedicated KMS later). Never committed.
- Installation IDs are non-secret but are stored in the platform DB (`Site.githubInstallationId`).
- Webhook secret is a separate env var; used to validate incoming `installation` events.

### 6. Uninstall and revocation
- `installation.deleted` webhook → mark `Site.githubInstallationId = null`. Subsequent publishes return 409 with a "reinstall the app" CTA.
- `installation.suspend` webhook → same treatment; the site is read-only until reinstalled.
- `installation_repositories.removed` event → if the repo for a `Site` is removed but the installation still exists, treat the same as uninstall.
- No automatic re-install attempt; the artist must take explicit action.

### 7. Failure modes worth noting
- **Token broker down** → publish endpoint surfaces a 503 with retry-after. Artist's editor preserves drafts in `localStorage` (per ADR-007), so no work is lost.
- **GitHub API rate limit hit** → the broker returns 429; surfaced to the editor with a clear "try again in N minutes" message. Per-installation limits are 5000 req/hr, far above realistic publish volume.
- **Installation token expired mid-publish** → the artist site does not retry transparently for v1. The publish function returns failure; the editor can re-request a new token and retry. Future evolution: broker issues a refreshed token automatically.

## Rejected alternatives

- **App private key at the edge.** Each artist site holds the `.pem` and mints its own installation tokens. Simpler architecture (no broker, no per-publish round trip to platform). Rejected: distributes the master credential, multiplies blast radius. A single compromised artist site exposes the App's signing key.
- **Per-artist GitHub OAuth tokens (no App).** Use the artist's own OAuth token from platform login to commit on their behalf. Avoids the App registration entirely. Rejected: OAuth tokens don't refresh cleanly without a long-running service, scopes are coarser than App permissions, and commits would be authored as the artist's full GitHub identity in a way that's hard to revoke. Apps are the supported model for this use case.
- **Personal Access Tokens (artist-supplied).** Artist creates a PAT, pastes it into the platform. Rejected: PAT UX is hostile to non-technical artists, tokens have no install scope (full-account access), and rotation is manual.
- **Per-site GitHub Apps.** One App registered per artist. Rejected: registration is manual and multiplies operational overhead at zero security benefit — the platform still holds the keys.
- **Sync via webhook to a queue, decouple publish from commit.** Artist site posts to a queue, platform worker dequeues and commits. More resilient under platform outages but adds latency and a new component (the queue). The existing `packages/queue` could host this; deferred to a future ADR if publish failure modes become a problem.

## Consequences

- **New platform endpoints.** `/api/publish-token` (POST, token broker), `/api/github/install-callback` (GET, install completion), `/api/github/webhook` (POST, install/uninstall events).
- **`Site` schema gains fields.** `githubInstallationId: number | null`, `repoFullName: string | null`, `githubAppSuspended: boolean`. Migration via Prisma.
- **Two GitHub App secrets enter the platform's environment:** `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, plus `GITHUB_APP_WEBHOOK_SECRET`.
- **Octokit becomes a platform dependency.** `@octokit/auth-app` mints installation tokens; `@octokit/rest` issues commits. Artist sites only see `@octokit/rest` configured with the broker-issued token — not the App auth flow.
- **First-time artist onboarding gains a step:** install GitHub App after platform sign-in. The platform's onboarding flow needs to handle the case where the artist signs in but hasn't yet installed the App ("connect your repo to publish").
- **Repo transfers (artist moves the repo to a new owner) require reinstall.** Documented behavior; the platform detects via `installation_repositories.removed` and prompts.
