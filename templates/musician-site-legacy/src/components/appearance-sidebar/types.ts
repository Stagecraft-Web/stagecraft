import type { Appearance } from "../../lib/schemas";

// The sidebar's runtime "configuration" — values baked into the page at
// build time and passed as React props from BaseLayout.
export interface SidebarConfig {
  /** GitHub repo in "owner/repo" form. Used only in "github" save mode. */
  repo: string;
  /** Keystatic storage mode from env. Influences the default save path. */
  storageMode: "local" | "github";
  /** Path (in the repo or filesystem) that appearance.json lives at. */
  appearancePath: string;
  /** Save path the sidebar should use.
   *   - "github-graphql" → commit via GitHub GraphQL (prod or dev w/ github mode)
   *   - "local-api"      → POST to the dev-only /api/stagecraft/appearance endpoint
   *   - "disabled"       → hide the sidebar entirely (e.g. prod + local storage)
   *  Computed in BaseLayout from storageMode + import.meta.env.DEV. */
  saveMode: "github-graphql" | "local-api" | "disabled";
  /** Baseline font-size scale from theme.json. The sidebar runs this through
   *  computeFontSizes() on every keystroke to project the Sizing knobs onto
   *  the page without a round-trip. Shape matches theme.typography.fontSize
   *  (bucket → rem string). */
  baseFontSizes: Record<string, string>;
}

// The initial appearance state embedded in the page, post-validation (i.e. the
// post-transform shape from appearanceSchema — flat, with `category/family`
// rather than `discriminant/value`).
export type AppearanceState = Appearance;

// Client-side draft state — identical to AppearanceState, but with a
// `dirty` flag so we can reason about whether there's anything to save.
export interface AppearanceDraft {
  state: AppearanceState;
  dirty: boolean;
}

// Minimum GitHub repo info the sidebar needs to commit. Resolved at sign-in
// time by querying GitHub's GraphQL API.
export interface RepoContext {
  owner: string;
  name: string;
  defaultBranch: string;
  currentBranch: string;
  /** SHA of the tip of `currentBranch`. Required as `expectedHeadOid` to
   *  avoid race-condition overwrites when committing. */
  headOid: string;
}

export type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; commitUrl: string | null }
  | { kind: "error"; message: string };
