# Stagecraft

AI-powered platform for creating and maintaining musician websites. Users request changes in plain English; the platform orchestrates AI edits, Git branches, PRs, and deploy previews.

## Architecture

- **Platform app** (`apps/web`): Next.js dashboard for site management, edit requests, and preview review
- **Database** (`packages/db`): Prisma schema + client for platform metadata (not customer site content)
- **Job queue** (`packages/queue`): Async task system for site creation, AI edits, and validation
- **Shared types** (`packages/shared`): Type definitions shared across packages
- **Generated sites** (`templates/`): Astro + React + TypeScript musician website templates

## Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate --schema=packages/db/prisma/schema.prisma

# Set up credentials — see docs/runbook.md §2 for required env vars
# (uses 1Password: npm run dev resolves op:// refs automatically)

# Run database migrations (requires Postgres)
npm run db:migrate

# Start development server
npm run dev
```

## Project Structure

```
apps/
  web/                  # Next.js platform app
packages/
  db/                   # Prisma schema + client
  queue/                # Job abstraction layer
  shared/               # Shared types
templates/              # Astro musician website templates
docs/
  specs/                # Product and technical specs
  adr/                  # Architecture decision records
```

## Key Decisions

See `docs/adr/` for architecture decision records covering framework, database, monorepo structure, job queue, integrations, and authentication choices.

## Operations

See `docs/runbook.md` for architecture overview, environment setup, common failure modes, and recovery procedures.
