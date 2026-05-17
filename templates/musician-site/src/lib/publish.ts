import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { commitFiles } from "./git-commit";
import { publishTokenResponseSchema } from "./publish-types";

const PAGES_DIR = path.join(process.cwd(), "src/content/pages");

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

export type PublishArgs = {
  pageSlug: string;
  data: unknown;
  authorEmail: string;
  authorName?: string;
};

export type PublishResult = {
  /** SHA of the commit on the artist's repo, or null when in dev fallback mode. */
  commitSha: string | null;
  /** Whether this publish went through GitHub or the local-disk dev fallback. */
  mode: "github" | "local";
};

/**
 * The canonical Stagecraft platform URL — used to build the broker
 * endpoint. Override with `STAGECRAFT_PLATFORM_URL` if you ever need
 * to point an artist site at a staging platform or fork. Otherwise
 * this default keeps artist sites pointed at prod without a per-site
 * env var.
 */
const STAGECRAFT_PLATFORM_URL_DEFAULT = "https://stagecraft.website";

export type Env = {
  platformUrl: string;
  siteId: string | undefined;
  brokerSecret: string | undefined;
  branch: string;
};

export function readEnv(): Env {
  // Always have a platformUrl — defaults to the prod URL — so the only
  // thing that triggers the dev-local-disk fallback is missing siteId
  // or brokerSecret.
  const overridden = process.env.STAGECRAFT_PLATFORM_URL?.replace(/\/$/, "");
  return {
    platformUrl: overridden && overridden.length > 0
      ? overridden
      : STAGECRAFT_PLATFORM_URL_DEFAULT,
    // STAGECRAFT_SITE_ID, not SITE_ID — the latter is reserved by Netlify
    // (injected automatically into Functions to identify the Netlify site).
    siteId: process.env.STAGECRAFT_SITE_ID,
    brokerSecret: process.env.STAGECRAFT_BROKER_SECRET,
    branch: process.env.SITE_GIT_BRANCH ?? "main",
  };
}

/**
 * Whether the production path is fully configured. When false, publishPage
 * falls back to writing JSON locally (dev mode). `platformUrl` is always
 * present (hardcoded default), so the only things that matter are siteId
 * and brokerSecret — both provisioned by the platform.
 */
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
    throw new PublishError("broker-unreachable", `Could not reach token broker: ${String(cause)}`);
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
  return { token: parsed.data.token, owner: parsed.data.repo.owner, repo: parsed.data.repo.name };
}

async function writeLocal(args: PublishArgs): Promise<PublishResult> {
  const file = path.join(PAGES_DIR, `${args.pageSlug}.json`);
  await fs.writeFile(file, JSON.stringify(args.data, null, 2) + "\n", "utf-8");
  return { commitSha: null, mode: "local" };
}

export async function publishPage(args: PublishArgs): Promise<PublishResult> {
  const env = readEnv();
  if (!isPlatformConfigured(env)) {
    return writeLocal(args);
  }

  const { token, owner, repo } = await fetchPublishToken(env);
  const publishId = randomUUID();
  const filePath = `src/content/pages/${args.pageSlug}.json`;
  const content = JSON.stringify(args.data, null, 2) + "\n";

  let commitSha: string;
  try {
    commitSha = await commitFiles({
      token,
      owner,
      repo,
      branch: env.branch,
      message: `Update ${args.pageSlug}\n\nStagecraft-Publish-Id: ${publishId}`,
      files: [{ path: filePath, content }],
      author: { name: args.authorName ?? "Artist", email: args.authorEmail },
    });
  } catch (cause) {
    throw new PublishError("github-failed", `GitHub commit failed: ${String(cause)}`);
  }

  return { commitSha, mode: "github" };
}
