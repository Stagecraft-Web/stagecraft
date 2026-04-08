# ADR-005: External Integration Strategy

## Status
Accepted

## Context
The platform integrates with GitHub (repos, branches, PRs), Netlify (hosting, previews), Anthropic Claude (AI edits), and Resend (email delivery). Each integration needs auth management and API interaction patterns.

## Decision

### GitHub: OAuth App for v1, GitHub App later
- Start with GitHub OAuth for user authentication and repo access
- OAuth provides simpler setup for v1 and sufficient permissions for repo creation, branching, PR management
- Migrate to a GitHub App when fine-grained installation permissions become important

### Netlify: OAuth + API
- Use Netlify OAuth to connect user accounts
- Use Netlify API for site creation, deploy status, and environment variable management
- Deploy previews are automatic via Netlify's GitHub integration once repos are connected

### AI Provider: Direct Anthropic API
- Platform calls the Anthropic API directly with platform-owned API keys
- Users do not need their own Claude subscription
- Structured prompts with repo context, CLAUDE.md instructions, and task classification

### Email: Resend API
- Generated sites use Netlify Functions to call Resend for contact form delivery
- Platform manages Resend API key injection into site environment variables

## Consequences
- Integration tokens are stored encrypted in the platform database via `IntegrationAccount`
- Each integration has a service module in the platform codebase
- GitHub and Netlify connections are per-user and validated on each operation
- AI calls are platform-managed, providing observability and retry control
