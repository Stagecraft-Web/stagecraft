# ADR-004: Job Queue and Worker Model

## Status
Accepted

## Context
The platform must run long-running async tasks: site creation, AI-driven edits, validation pipelines, and integration operations. These cannot block HTTP request/response cycles.

## Decision
Use a **PostgreSQL-backed job queue** with an in-process worker for v1, designed for easy migration to a dedicated queue (BullMQ/Redis) later.

### Chosen: Postgres-backed queue (v1) with migration path
- Jobs are stored as rows in a `SiteJob` table with status tracking
- A polling worker process picks up queued jobs and executes them
- Simple, no additional infrastructure beyond the existing Postgres DB
- Job payloads and results stored as JSON columns
- Clear status lifecycle: `queued` → `running` → `completed` | `failed` | `awaiting_review` | `canceled`

### Migration path
- The job abstraction layer (`packages/queue`) defines interfaces, not implementations
- When load requires it, swap the Postgres poller for BullMQ + Redis without changing callers

### Rejected alternatives
- **BullMQ + Redis from day one**: Adds infrastructure complexity before it's needed
- **Cloud-native queues (SQS, Cloud Tasks)**: Vendor lock-in for v1; premature
- **Temporal/Inngest**: Powerful but heavy for initial scope

## Consequences
- Job table lives in the platform Prisma schema
- Worker runs as part of the Next.js app process in dev, can be separated in production
- Job execution is bounded by timeouts and retry limits
- The `packages/queue` package exports `enqueue()`, `dequeue()`, and job handler registration
