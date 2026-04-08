# ADR-006: Platform Authentication

## Status
Accepted

## Context
The platform needs user authentication for the dashboard. Users also need to connect external accounts (GitHub, Netlify).

## Decision
Use **NextAuth.js (Auth.js v5)** with GitHub as the primary OAuth provider.

### Chosen: NextAuth.js with GitHub OAuth
- GitHub OAuth serves dual purpose: platform login AND GitHub integration
- NextAuth handles session management, CSRF protection, and token refresh
- Prisma adapter stores sessions and accounts in the platform database
- Additional OAuth providers (Netlify) can be added as "link account" flows

### Auth flow
1. User signs in via GitHub OAuth → creates platform User + IntegrationAccount
2. User links Netlify separately via OAuth → creates additional IntegrationAccount
3. Sessions are database-backed for reliability

### Rejected alternatives
- **Custom JWT auth**: More work, less secure by default
- **Clerk/Auth0**: External dependency and cost for something NextAuth handles well
- **Email/password**: Adds complexity; GitHub OAuth is natural for the target workflow

## Consequences
- GitHub login is the primary (and initially only) sign-in method
- The Prisma adapter connects NextAuth to the platform database
- Session data is available server-side via `auth()` helper
- Netlify connection is a separate "link account" action, not a login provider
