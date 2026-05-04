import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * When this template lives inside the Stagecraft monorepo, `apps/web` and
 * `packages/*` share a root lockfile and Next.js wants
 * `outputFileTracingRoot` set so its dependency tracing reaches the
 * sibling packages. When the template is pushed to a stand-alone artist
 * repo, that root doesn't exist — and forcing `../..` would point at a
 * directory above the repo, which Next.js's tracer can't read.
 *
 * Auto-detect: walk up two levels and check whether the parent
 * `package.json` declares `workspaces`. If yes, we're in the monorepo;
 * set the root. Otherwise the template is stand-alone and Next.js's
 * default (the closest lockfile to the project) is correct.
 */
function detectMonorepoRoot(): string | undefined {
  const candidate = path.join(import.meta.dirname, "../..");
  const pkgPath = path.join(candidate, "package.json");
  if (!existsSync(pkgPath)) return undefined;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { workspaces?: unknown };
    return pkg.workspaces ? candidate : undefined;
  } catch {
    return undefined;
  }
}

const monorepoRoot = detectMonorepoRoot();

const config: NextConfig = {
  reactStrictMode: true,
  ...(monorepoRoot ? { outputFileTracingRoot: monorepoRoot } : {}),
};

export default config;
