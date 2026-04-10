# CLAUDE.md — Monorepo Coding Standards

This file establishes code quality rules for the Stagecraft monorepo. All AI-generated code must follow these conventions. Rules here take precedence over general defaults.

## Repo Structure

```
apps/
  web/           # Next.js web application
packages/
  shared/        # Cross-cutting types, enums, constants, utilities
  db/            # Database schema and migrations
  queue/         # Async job queue
templates/
  musician-site/ # Astro template (see templates/musician-site/CLAUDE.md)
```

---

## 1. Narrow Types — Never Plain `string` for Fixed Value Sets

Any prop, field, parameter, or variable that accepts a **fixed set of values** MUST use a TypeScript union type — never `string`.

**Wrong:**
```ts
status: string
jobType: string
provider: string
```

**Right:**
```ts
status: JobStatus          // import from @stagecraft/shared
jobType: JobType           // import from @stagecraft/shared
provider: 'github' | 'netlify'
```

- Before defining a new union type, check `packages/shared/src/types.ts` — the shared package already defines `JobStatus`, `JobType`, `EditMode`, `ChangeRequestStatus`, `SiteStatus`, `BlueprintType`, `IntegrationProvider`, `AssetUploadStatus`, `PreviewStatus`, and others.
- If the type exists in `@stagecraft/shared`, **import and reuse it**. Do not redefine it locally.
- If you need a new union type that will be used in only one file, define it locally. If it's used in more than one file, extract it to `packages/shared` (see section 4).

---

## 2. DRY — Don't Repeat Yourself

### Check before defining

Before writing a new type, enum, constant, or utility function, search the codebase:
1. Check `packages/shared/src/` first.
2. Check the app where the code will live.
3. If it already exists, import it — don't redefine it.

### Extract when shared

If the same type, enum, constant, or utility is needed in **more than one file**, it MUST live in `packages/shared` and be imported everywhere. Do not copy-paste definitions across files.

### Use existing shared UI components

Use the generic component library rather than reimplementing UI patterns inline:

| Component | Use for |
|-----------|---------|
| `Button` | All clickable actions — links, submit buttons, icon buttons |
| `FormGroup` | All form fields — never raw `<input>`/`<label>` |
| `Image` (React) | Images inside React components |

Only build a new component if none of the existing ones fit. Do not inline equivalent HTML patterns when a component exists.

### Extract generic helpers to shared utilities

If a helper function solves something generic (date formatting, string manipulation, validation, error handling), place it in `packages/shared/src/` as a utility rather than keeping it local to one file.

---

## 3. Test Coverage

Every PR must include tests for:

- **New utility functions** — unit tests for all exported functions.
- **API route handlers** — test the handler directly, covering success and error responses.
- **Non-trivial logic branches** — any conditional with meaningful branching must have a test case per branch.

### What tests must cover

- Happy path (expected inputs produce expected outputs)
- Error and edge cases (invalid input, missing fields, out-of-range values)
- Boundary conditions where applicable

### Test conventions

- Use **vitest** with relative imports, matching patterns established in the codebase.
- Co-locate test files with the code they test (e.g., `foo.ts` → `foo.test.ts`).
- Do not add tests for trivial pass-through code (simple getters, re-exports).

---

## 4. Shared Package Conventions

`packages/shared` is the home for anything cross-cutting.

### When to add to `packages/shared`

- A type, enum, or constant used in more than one package or app.
- A utility function that is generic enough to be useful outside its origin file.

### How to add

1. Add the export to `packages/shared/src/types.ts` (for types/enums) or a new file (for utilities).
2. Re-export from `packages/shared/src/index.ts`.
3. Import in consuming packages via `@stagecraft/shared`.

```ts
// packages/shared/src/index.ts
export * from "./types.js";
export * from "./your-new-module.js";
```

```ts
// in apps/web or packages/queue
import { JobStatus, JobType } from "@stagecraft/shared";
```

### Do not

- Define shared types locally and import them across package boundaries.
- Duplicate a type that already exists in `packages/shared`.
- Forget to add new exports to `index.ts`.

---

## Validation Commands

```bash
npm run typecheck   # TypeScript check across all packages
npm run test        # Run all tests (vitest)
npm run build       # Full production build
npm run lint        # Lint all packages
```

Run `npm run typecheck` and `npm run test` before committing any change.
