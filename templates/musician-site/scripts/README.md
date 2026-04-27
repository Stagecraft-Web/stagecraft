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

Captures to a local temp directory. Uploading the images to a public
gist and embedding them in a PR is covered by the `create-pr` skill
at `claude/skills/create-pr/SKILL.md` at the monorepo root.
