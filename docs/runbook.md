# Stagecraft Operator Runbook

This document is for engineers and support staff operating the Stagecraft platform. It covers the architecture, common failure modes, and recovery procedures.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Environment Setup](#2-environment-setup)
3. [Health Check](#3-health-check)
4. [Common Failure Modes](#4-common-failure-modes)
5. [Manually Retrying Failed Jobs](#5-manually-retrying-failed-jobs)
6. [Verifying GitHub Integration](#6-verifying-github-integration)
7. [Verifying Netlify Integration](#7-verifying-netlify-integration)
8. [Webhook Setup & Verification](#8-webhook-setup--verification)

---

## 1. Architecture Overview

```
┌─────────────┐     HTTP      ┌─────────────────────────┐
│   Browser   │ ───────────► │  Next.js App (apps/web)  │
└─────────────┘              │                          │
                             │  /api/auth/...           │  NextAuth + GitHub OAuth
                             │  /api/integrations/...   │  Netlify OAuth
                             │  /api/sites/...          │  Site CRUD
                             │  /api/webhooks/github    │  ← GitHub events
                             │  /api/webhooks/netlify   │  ← Netlify deploy events
                             │  /api/health             │  Health check
                             └────────────┬─────────────┘
                                          │
                             ┌────────────▼─────────────┐
                             │   PostgreSQL Database     │
                             │   (via Prisma ORM)        │
                             └────────────┬─────────────┘
                                          │
                             ┌────────────▼─────────────┐
                             │  @stagecraft/queue        │
                             │  Polling worker (5 s)     │
                             │  Processes SiteJob rows   │
                             └──────────────────────────┘
```

### Key Models

| Model | Purpose |
|---|---|
| `User` | Platform user account (linked to GitHub via NextAuth) |
| `IntegrationAccount` | Stored OAuth tokens for GitHub and Netlify |
| `Site` | A generated musician website |
| `SiteJob` | Async background job (create_site, edit_site, etc.) |
| `ChangeRequest` | An edit request tied to a job and GitHub PR |
| `AuditEvent` | Immutable event log |

### Job Lifecycle

```
queued  ──►  running  ──►  completed
                     └──►  failed
                     └──►  awaiting_review
```

The worker polls the `SiteJob` table every 5 seconds for the oldest `queued` job and processes it. All state transitions are reflected in the database immediately. Webhook events from GitHub and Netlify can also advance job state without polling.

---

## 2. Environment Setup

Copy `apps/web/.env.example` to `apps/web/.env.local` (for local development) or populate the equivalent production secrets in your hosting environment.

```bash
cp apps/web/.env.example apps/web/.env.local
# Then fill in each value
```

The project uses 1Password for secret management in development. Run:

```bash
npm run dev  # uses op run --env-file=apps/web/.op.env
```

### Required env vars (minimum set to run)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Random secret for NextAuth session signing |
| `AUTH_URL` | Base URL of the app (`http://localhost:3000` locally) |
| `AUTH_GITHUB_ID` | GitHub OAuth App client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App client secret |
| `NETLIFY_CLIENT_ID` | Netlify OAuth App client ID |
| `NETLIFY_CLIENT_SECRET` | Netlify OAuth App client secret |

### Additional env vars for webhook ingestion

| Variable | Description |
|---|---|
| `GITHUB_WEBHOOK_SECRET` | HMAC secret configured on GitHub repo webhook |
| `NETLIFY_WEBHOOK_SECRET` | Shared token appended to Netlify webhook URL |

---

## 3. Health Check

```bash
curl https://<your-domain>/api/health
```

**Healthy response (`200 OK`):**
```json
{
  "status": "ok",
  "uptime": 184200,
  "checks": { "database": "ok" },
  "metrics": {
    "webhook.received": 14,
    "job.started": 9,
    "job.completed": 8,
    "job.failed": 1
  }
}
```

**Degraded response (`503 Service Unavailable`):**
```json
{
  "status": "degraded",
  "uptime": 184200,
  "checks": { "database": "error" },
  "metrics": {}
}
```

If `database` is `"error"`, the app cannot serve most requests. Check `DATABASE_URL` and confirm the database is reachable.

---

## 4. Common Failure Modes

### 4.1 Database unreachable

**Symptom:** `GET /api/health` returns `503` with `"database": "error"`. All API routes fail with 500.

**Diagnosis:**
```bash
# Check database connection directly
psql "$DATABASE_URL" -c "SELECT 1"
```

**Recovery:**
1. Verify `DATABASE_URL` is correct.
2. Check that the PostgreSQL server is running (`docker-compose ps` if local).
3. Confirm network/firewall rules allow the app to reach the database host.

---

### 4.2 Job stuck in `running`

**Symptom:** A `SiteJob` row has `status = "running"` and `startedAt` is more than a few minutes ago, but `completedAt` is null.

**Cause:** The worker process crashed while a job was in flight.

**Diagnosis:**
```sql
SELECT id, type, status, "startedAt", "createdAt"
FROM "SiteJob"
WHERE status = 'running'
ORDER BY "startedAt";
```

**Recovery:** Reset the job to `queued` so the worker picks it up again:
```sql
UPDATE "SiteJob"
SET status = 'queued', "startedAt" = NULL
WHERE id = '<job-id>';
```

---

### 4.3 Job repeatedly failing

**Symptom:** A `SiteJob` row has `status = "failed"` and `errorMessage` indicates a transient or external error.

**Diagnosis:**
```sql
SELECT id, type, "errorMessage", "createdAt", "completedAt"
FROM "SiteJob"
WHERE status = 'failed'
ORDER BY "completedAt" DESC
LIMIT 20;
```

**Recovery:** See [Section 5](#5-manually-retrying-failed-jobs).

---

### 4.4 GitHub OAuth token expired

**Symptom:** Jobs that call the GitHub API fail with `401 Unauthorized` in the `errorMessage`.

**Diagnosis:** Check `IntegrationAccount` for the affected user:
```sql
SELECT "userId", provider, "tokenExpiresAt", "updatedAt"
FROM "IntegrationAccount"
WHERE provider = 'github';
```

**Recovery:** The user must disconnect and reconnect their GitHub account from the Settings page, which re-issues a fresh token.

---

### 4.5 Netlify site creation failing

**Symptom:** `create_site` jobs fail with Netlify API errors.

**Diagnosis:** Check the job's `errorMessage`:
```sql
SELECT "errorMessage" FROM "SiteJob" WHERE id = '<job-id>';
```

Common causes:
- Netlify access token expired → user must reconnect Netlify integration
- Netlify API rate limit → wait and retry
- Site name conflict on Netlify → inspect the `name` field in `requestPayload`

---

### 4.6 Webhook signature rejected

**Symptom:** `POST /api/webhooks/github` or `/api/webhooks/netlify` returns `401 Unauthorized`. Events are not being processed.

**Cause:** The webhook secret in the hosting environment does not match the secret configured on GitHub/Netlify.

**Recovery:**
1. Rotate the secret (generate a new random value: `openssl rand -hex 32`).
2. Update `GITHUB_WEBHOOK_SECRET` / `NETLIFY_WEBHOOK_SECRET` in the hosting environment and redeploy.
3. Update the secret in GitHub repository settings / Netlify webhook URL.

---

### 4.7 Webhook endpoint returns 500 "Server misconfiguration"

**Cause:** `GITHUB_WEBHOOK_SECRET` or `NETLIFY_WEBHOOK_SECRET` is not set in the environment.

**Recovery:** Set the missing env var and redeploy.

---

## 5. Manually Retrying Failed Jobs

### Re-enqueue a single failed job

```sql
UPDATE "SiteJob"
SET
  status       = 'queued',
  "startedAt"  = NULL,
  "completedAt" = NULL,
  "errorMessage" = NULL
WHERE id = '<job-id>';
```

The worker will pick it up within 5 seconds.

### Re-enqueue all recently failed jobs for a site

```sql
UPDATE "SiteJob"
SET status = 'queued', "startedAt" = NULL, "completedAt" = NULL, "errorMessage" = NULL
WHERE "siteId" = '<site-id>'
  AND status = 'failed'
  AND "createdAt" > NOW() - INTERVAL '1 day';
```

### Cancel a stuck job

```sql
UPDATE "SiteJob"
SET status = 'canceled', "completedAt" = NOW()
WHERE id = '<job-id>';
```

---

## 6. Verifying GitHub Integration

### Check a user's GitHub token is stored

```sql
SELECT "userId", "providerAccountId", scopes, "updatedAt", metadata
FROM "IntegrationAccount"
WHERE provider = 'github' AND "userId" = '<user-id>';
```

### Manually verify the token works

```bash
curl -s -H "Authorization: Bearer <access_token>" \
  https://api.github.com/user | jq .login
```

### Confirm required scopes

The token must have `repo` scope (for creating repos and pushing files). The `scopes` column in `IntegrationAccount` should include `repo`.

---

## 7. Verifying Netlify Integration

### Check a user's Netlify token is stored

```sql
SELECT "userId", "providerAccountId", "updatedAt"
FROM "IntegrationAccount"
WHERE provider = 'netlify' AND "userId" = '<user-id>';
```

### Manually verify the token works

```bash
curl -s -H "Authorization: Bearer <access_token>" \
  https://api.netlify.com/api/v1/accounts | jq '.[0].name'
```

### Confirm a site is linked

```sql
SELECT id, name, "netlifySiteId", "productionUrl", status
FROM "Site"
WHERE id = '<site-id>';
```

`netlifySiteId` should be set after a successful `create_site` job. `productionUrl` is populated once the first deploy succeeds (either via webhook or job completion).

---

## 8. Webhook Setup & Verification

### GitHub Webhook

1. Go to your GitHub repository → Settings → Webhooks → Add webhook.
2. **Payload URL:** `https://<your-domain>/api/webhooks/github`
3. **Content type:** `application/json`
4. **Secret:** value of `GITHUB_WEBHOOK_SECRET`
5. **Events:** Select individual events: `Pull requests`, `Deployment statuses`
6. Click **Add webhook**. GitHub will send a ping event; confirm the green checkmark.

**Test the signature locally:**
```bash
SECRET="your-secret"
BODY='{"zen":"test"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print "sha256="$2}')
curl -s -X POST http://localhost:3000/api/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -H "X-Hub-Signature-256: $SIG" \
  -d "$BODY"
# Expected: {"ok":true}
```

### Netlify Webhook

1. Go to your Netlify site → Site settings → Build & deploy → Deploy notifications.
2. Add notifications for: **Deploy succeeded**, **Deploy failed**, **Deploy started**.
3. **URL:** `https://<your-domain>/api/webhooks/netlify?token=<NETLIFY_WEBHOOK_SECRET>`
4. Save. Trigger a test deploy to confirm events arrive.

**Test the token locally:**
```bash
TOKEN="your-netlify-webhook-secret"
curl -s -X POST "http://localhost:3000/api/webhooks/netlify?token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"test","site_id":"<netlify-site-id>","state":"ready","ssl_url":"https://example.netlify.app"}'
# Expected: {"ok":true}
```
