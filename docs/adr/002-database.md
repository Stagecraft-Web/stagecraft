# ADR-002: Platform Database

## Status
Accepted

## Context
The platform needs persistence for user accounts, integration metadata, site records, job history, and audit events. Customer site content must NOT live in this database — it lives in customer repos.

## Decision
Use **PostgreSQL with Prisma ORM**.

### Chosen: PostgreSQL + Prisma
- PostgreSQL: robust, well-understood, excellent JSON support for flexible payloads
- Prisma: type-safe database client generated from schema, migration tooling, good DX
- Schema-first approach aligns with the platform's emphasis on structured data

### Rejected alternatives
- **SQLite**: Too limiting for concurrent job workers and production use
- **MongoDB**: No strong reason for document store; relational model fits platform entities well
- **Drizzle ORM**: Viable but Prisma has better migration tooling and broader adoption
- **Raw SQL / query builder**: Loses type safety benefits that matter for platform correctness

## Consequences
- Prisma schema is the source of truth for platform DB structure
- Prisma Client provides typed queries throughout the platform
- Migrations are managed via `prisma migrate`
- The `packages/db` workspace owns the schema and exports the client
