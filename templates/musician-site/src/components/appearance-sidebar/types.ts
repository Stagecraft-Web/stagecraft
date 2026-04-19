import type { Appearance } from "../../lib/schemas";

// The sidebar's runtime "configuration" — values baked into the page at
// build time and serialised into a <script type="application/json"> tag in
// <head> so the client can hydrate without round-tripping the server.
export interface SidebarConfig {
  /** GitHub repo in "owner/repo" form. Target of all commits. */
  repo: string;
  /** Storage mode from env; sidebar is only useful in "github" mode. */
  storageMode: "local" | "github";
  /** Path in the repo to write on save. */
  appearancePath: string;
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
