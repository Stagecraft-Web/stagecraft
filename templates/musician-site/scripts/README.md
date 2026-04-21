# Scripts

Utilities for the musician-site template. Run from the template root.

| Script                          | Purpose                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `validate-content.ts`           | Validates every content file against its Zod schema. Invoked by `npm run validate:content`.             |
| `sync-markdoc-config.ts`        | Generates `markdoc.config.json` from `markdoc.config.ts`. Invoked by `npm run sync:markdoc-config`.     |
| `capture-pr-screenshots.mjs`    | Captures the standard PR-screenshot set (site pages + Keystatic admin). See file header for full usage. |

## `capture-pr-screenshots.mjs`

Boot the dev server, then in another terminal:

```bash
node scripts/capture-pr-screenshots.mjs http://localhost:4321 \
     /tmp/pr-<N>-screenshots
```

Captures to a local temp directory — the images are then uploaded to
a public gist and referenced from the PR body (this repo is private,
so in-tree raw URLs don't render anonymously).

See `docs/screenshots/README.md` for the full PR-screenshot convention
including the gist upload workflow.
