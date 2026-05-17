import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  APPEARANCE_REPO_PATH,
  HEADER_CONFIG_REPO_PATH,
  pageRepoPath,
  SITE_CONFIG_REPO_PATH,
  stringifyContent,
} from "./content";
import {
  collectionDefRepoPath,
  collectionDefSchema,
  itemRepoPath,
  itemSlugSchema,
  orderFileSchema,
  orderRepoPath,
  slugSchema,
  type CollectionDef,
} from "./collections";
import { commitFiles, type FileToCommit } from "./git-commit";
import {
  appearanceSchema,
  headerConfigSchema,
  pageSlugSchema,
  siteConfigSchema,
  type Appearance,
  type HeaderConfig,
  type SiteConfig,
} from "./site-config-types";
import { publishTokenResponseSchema } from "./publish-types";

/**
 * Repo paths (`src/content/...`) are always written under the platform's
 * content directory. Production: `<cwd>/src/content`. Tests can set
 * `STAGECRAFT_CONTENT_DIR` to point each worker at its own tmpdir so the
 * `npm run test` step doesn't race across files.
 *
 * Repo paths outside `src/content/` (none today, but kept open for future
 * targets like static images) fall back to a plain `<cwd>/<path>` mapping.
 */
const REPO_CONTENT_PREFIX = "src/content/";

function localPathForRepoPath(repoPath: string): string {
  if (repoPath.startsWith(REPO_CONTENT_PREFIX)) {
    const tail = repoPath.slice(REPO_CONTENT_PREFIX.length);
    const root =
      process.env.STAGECRAFT_CONTENT_DIR ?? path.join(process.cwd(), "src/content");
    return path.join(root, tail);
  }
  return path.join(process.cwd(), repoPath);
}

export class PublishError extends Error {
  constructor(
    public code:
      | "broker-unreachable"
      | "broker-rejected"
      | "github-failed"
      | "no-platform-configured",
    message: string,
  ) {
    super(message);
    this.name = "PublishError";
  }
}

/**
 * Targets the publish flow can write. Each target maps to a known repo path
 * and a known on-disk JSON shape so the API can validate before committing.
 *
 * The `collection-*` kinds (ADR-009) extend the same machinery: each
 * resolves to a path under `src/content/collections/<slug>/...`. Item
 * payloads are validated against the collection's dynamic schema at the
 * API-route level (since validation requires reading the collection
 * def); this layer only enforces the structural shape.
 */
export type PublishTarget =
  | { kind: "page"; slug: string; data: unknown }
  | { kind: "site-config"; data: SiteConfig }
  | { kind: "header-config"; data: HeaderConfig }
  | { kind: "appearance"; data: Appearance }
  | { kind: "delete-page"; slug: string }
  | { kind: "collection-def"; collectionSlug: string; data: CollectionDef }
  | {
      kind: "collection-item";
      collectionSlug: string;
      itemSlug: string;
      /** Pre-validated against the collection's schema by the caller. */
      data: unknown;
    }
  | { kind: "delete-collection-item"; collectionSlug: string; itemSlug: string }
  | { kind: "collection-order"; collectionSlug: string; data: string[] };

export type PublishArgs = {
  targets: PublishTarget[];
  authorEmail: string;
  authorName?: string;
  /** Human-readable subject for the commit. Defaults to a generated summary. */
  commitSubject?: string;
};

export type PublishResult = {
  /** SHA of the commit on the artist's repo, or null when in dev fallback mode. */
  commitSha: string | null;
  /** Whether this publish went through GitHub or the local-disk dev fallback. */
  mode: "github" | "local";
};

const STAGECRAFT_PLATFORM_URL_DEFAULT = "https://stagecraft.website";

export type Env = {
  platformUrl: string;
  siteId: string | undefined;
  brokerSecret: string | undefined;
  branch: string;
};

export function readEnv(): Env {
  const overridden = process.env.STAGECRAFT_PLATFORM_URL?.replace(/\/$/, "");
  return {
    platformUrl:
      overridden && overridden.length > 0
        ? overridden
        : STAGECRAFT_PLATFORM_URL_DEFAULT,
    siteId: process.env.STAGECRAFT_SITE_ID,
    brokerSecret: process.env.STAGECRAFT_BROKER_SECRET,
    branch: process.env.SITE_GIT_BRANCH ?? "main",
  };
}

export function isPlatformConfigured(env: Env = readEnv()): boolean {
  return Boolean(env.siteId && env.brokerSecret);
}

export async function fetchPublishToken(env: Env): Promise<{
  token: string;
  owner: string;
  repo: string;
}> {
  let response: Response;
  try {
    response = await fetch(`${env.platformUrl}/api/publish-token`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.brokerSecret}`,
      },
      body: JSON.stringify({ siteId: env.siteId }),
    });
  } catch (cause) {
    throw new PublishError(
      "broker-unreachable",
      `Could not reach token broker: ${String(cause)}`,
    );
  }

  if (!response.ok) {
    throw new PublishError(
      "broker-rejected",
      `Token broker returned ${response.status} ${response.statusText}`,
    );
  }

  const parsed = publishTokenResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new PublishError(
      "broker-rejected",
      `Token broker returned malformed response: ${parsed.error.message}`,
    );
  }
  return {
    token: parsed.data.token,
    owner: parsed.data.repo.owner,
    repo: parsed.data.repo.name,
  };
}

/**
 * Validate + normalise every target into a {repoPath, content} pair we can
 * hand to the commit flow. Each target's schema is parsed here so a bad
 * payload from the API fails before the GitHub call.
 *
 * Returns `delete-page` slugs separately because git-commit's `commitFiles`
 * only adds files; deletions need a different tree entry.
 */
function planFiles(targets: PublishTarget[]): {
  writes: FileToCommit[];
  deletePaths: string[];
} {
  const writes: FileToCommit[] = [];
  const deletePaths: string[] = [];

  for (const target of targets) {
    switch (target.kind) {
      case "page": {
        const slug = pageSlugSchema.parse(target.slug);
        // Pages aren't validated against a per-block schema here; the Puck
        // editor is the source of truth for block shape. We just persist what
        // it gives us, but format consistently.
        const content = stringifyContent(target.data);
        writes.push({ path: pageRepoPath(slug), content });
        break;
      }
      case "site-config": {
        const parsed = siteConfigSchema.parse(target.data);
        writes.push({ path: SITE_CONFIG_REPO_PATH, content: stringifyContent(parsed) });
        break;
      }
      case "header-config": {
        const parsed = headerConfigSchema.parse(target.data);
        writes.push({ path: HEADER_CONFIG_REPO_PATH, content: stringifyContent(parsed) });
        break;
      }
      case "appearance": {
        const parsed = appearanceSchema.parse(target.data);
        writes.push({ path: APPEARANCE_REPO_PATH, content: stringifyContent(parsed) });
        break;
      }
      case "delete-page": {
        const slug = pageSlugSchema.parse(target.slug);
        deletePaths.push(pageRepoPath(slug));
        break;
      }
      case "collection-def": {
        const collectionSlug = slugSchema.parse(target.collectionSlug);
        const parsed = collectionDefSchema.parse(target.data);
        if (parsed.slug !== collectionSlug) {
          throw new Error(
            `collection-def: def.slug (${parsed.slug}) must match collectionSlug (${collectionSlug})`,
          );
        }
        writes.push({
          path: collectionDefRepoPath(collectionSlug),
          content: stringifyContent(parsed),
        });
        break;
      }
      case "collection-item": {
        const collectionSlug = slugSchema.parse(target.collectionSlug);
        const itemSlug = itemSlugSchema.parse(target.itemSlug);
        // Item-shape validation happens at the API route (it needs the
        // collection's CollectionDef to build the schema). Here we just
        // persist the bytes after formatting.
        writes.push({
          path: itemRepoPath(collectionSlug, itemSlug),
          content: stringifyContent(target.data),
        });
        break;
      }
      case "delete-collection-item": {
        const collectionSlug = slugSchema.parse(target.collectionSlug);
        const itemSlug = itemSlugSchema.parse(target.itemSlug);
        deletePaths.push(itemRepoPath(collectionSlug, itemSlug));
        break;
      }
      case "collection-order": {
        const collectionSlug = slugSchema.parse(target.collectionSlug);
        const parsed = orderFileSchema.parse(target.data);
        writes.push({
          path: orderRepoPath(collectionSlug),
          content: stringifyContent(parsed),
        });
        break;
      }
    }
  }

  return { writes, deletePaths };
}

function summariseTargets(targets: PublishTarget[]): string {
  // Stable order so re-runs produce the same commit subject.
  const parts: string[] = [];
  const pages = targets
    .filter((t): t is { kind: "page"; slug: string; data: unknown } => t.kind === "page")
    .map((t) => t.slug);
  if (pages.length) parts.push(`pages: ${pages.join(", ")}`);
  if (targets.some((t) => t.kind === "site-config")) parts.push("site settings");
  if (targets.some((t) => t.kind === "header-config")) parts.push("header & navigation");
  if (targets.some((t) => t.kind === "appearance")) parts.push("appearance");
  const collectionDefs = targets
    .filter((t): t is Extract<PublishTarget, { kind: "collection-def" }> => t.kind === "collection-def")
    .map((t) => t.collectionSlug);
  if (collectionDefs.length) parts.push(`collection defs: ${collectionDefs.join(", ")}`);
  const collectionItems = targets
    .filter((t): t is Extract<PublishTarget, { kind: "collection-item" }> => t.kind === "collection-item")
    .map((t) => `${t.collectionSlug}/${t.itemSlug}`);
  if (collectionItems.length) parts.push(`items: ${collectionItems.join(", ")}`);
  const orders = targets
    .filter((t): t is Extract<PublishTarget, { kind: "collection-order" }> => t.kind === "collection-order")
    .map((t) => t.collectionSlug);
  if (orders.length) parts.push(`order: ${orders.join(", ")}`);
  const deletes = targets
    .filter((t): t is Extract<PublishTarget, { kind: "delete-page" }> => t.kind === "delete-page")
    .map((t) => t.slug);
  if (deletes.length) parts.push(`delete: ${deletes.join(", ")}`);
  const itemDeletes = targets
    .filter((t): t is Extract<PublishTarget, { kind: "delete-collection-item" }> => t.kind === "delete-collection-item")
    .map((t) => `${t.collectionSlug}/${t.itemSlug}`);
  if (itemDeletes.length) parts.push(`delete items: ${itemDeletes.join(", ")}`);
  return parts.length ? `Update ${parts.join(" + ")}` : "Update content";
}

async function writeLocal(targets: PublishTarget[]): Promise<PublishResult> {
  const { writes, deletePaths } = planFiles(targets);
  for (const file of writes) {
    const abs = localPathForRepoPath(file.path);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, file.content, "utf-8");
  }
  for (const repoPath of deletePaths) {
    const abs = localPathForRepoPath(repoPath);
    await fs.rm(abs, { force: true });
  }
  return { commitSha: null, mode: "local" };
}

export async function publish(args: PublishArgs): Promise<PublishResult> {
  if (args.targets.length === 0) {
    throw new PublishError("github-failed", "publish: no targets supplied");
  }
  const env = readEnv();
  if (!isPlatformConfigured(env)) {
    return writeLocal(args.targets);
  }

  const { writes, deletePaths } = planFiles(args.targets);
  const { token, owner, repo } = await fetchPublishToken(env);
  const publishId = randomUUID();
  const subject = args.commitSubject ?? summariseTargets(args.targets);
  const message = `${subject}\n\nStagecraft-Publish-Id: ${publishId}`;

  let commitSha: string;
  try {
    commitSha = await commitFiles({
      token,
      owner,
      repo,
      branch: env.branch,
      message,
      files: writes,
      deletePaths,
      author: { name: args.authorName ?? "Artist", email: args.authorEmail },
    });
  } catch (cause) {
    throw new PublishError("github-failed", `GitHub commit failed: ${String(cause)}`);
  }

  return { commitSha, mode: "github" };
}

/**
 * Back-compat helper preserved for callers that publish a single page (the
 * common case from the Puck editor's onPublish handler).
 */
export async function publishPage(args: {
  pageSlug: string;
  data: unknown;
  authorEmail: string;
  authorName?: string;
}): Promise<PublishResult> {
  return publish({
    targets: [{ kind: "page", slug: args.pageSlug, data: args.data }],
    authorEmail: args.authorEmail,
    authorName: args.authorName,
    commitSubject: `Update ${args.pageSlug}`,
  });
}
