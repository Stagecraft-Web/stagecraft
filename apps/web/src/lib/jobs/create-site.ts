import { prisma } from "@stagecraft/db";
import type { JobContext, JobResult } from "@stagecraft/queue";
import { createRepo, pushFiles } from "@/lib/integrations/github";
import { createSite as createNetlifySite } from "@/lib/integrations/netlify";
import fs from "fs/promises";
import path from "path";

const TEMPLATE_DIR = path.resolve(process.cwd(), "../../templates/musician-site");

// Binary file extensions that should be skipped when pushing via Git Data API
const BINARY_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".ico", ".svg",
  ".woff", ".woff2", ".ttf", ".eot",
  ".mp3", ".mp4", ".wav", ".ogg",
  ".pdf", ".zip",
]);

interface CreateSitePayload {
  name: string;
  slug: string;
  blueprintType: string;
}

/**
 * Parse the template's .gitignore and return directory names to skip.
 * Falls back to an empty set if .gitignore is missing or unreadable.
 */
async function getGitignoreDirs(): Promise<Set<string>> {
  try {
    const content = await fs.readFile(path.join(TEMPLATE_DIR, ".gitignore"), "utf-8");
    const dirs = new Set<string>();
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      // Match simple directory entries like "node_modules/" or "dist/"
      if (trimmed.endsWith("/")) dirs.add(trimmed.slice(0, -1));
    }
    return dirs;
  } catch {
    return new Set();
  }
}

/**
 * Read all text files from the template directory, skipping binaries and
 * files that shouldn't be committed (node_modules, lock files, etc.).
 * Directories listed in the template's .gitignore are used as the primary
 * source of truth for what to skip, supplemented by build-artifact dirs
 * that may not appear in .gitignore.
 */
async function readTemplateFiles(siteName: string): Promise<{ path: string; content: string }[]> {
  const files: { path: string; content: string }[] = [];

  const gitignoreDirs = await getGitignoreDirs();
  // Merge .gitignore dirs with extra build-artifact dirs not covered by .gitignore
  const SKIP_DIRS = new Set([...gitignoreDirs, ".next", ".turbo", "tests", "scripts"]);
  const SKIP_FILES = new Set(["package-lock.json", "playwright.config.ts", "CLAUDE.md", "EDITING.md"]);

  async function walk(dir: string, prefix: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walk(fullPath, relativePath);
      } else if (entry.isFile()) {
        if (SKIP_FILES.has(entry.name)) continue;

        const ext = path.extname(entry.name).toLowerCase();
        if (BINARY_EXTENSIONS.has(ext)) continue;

        let content = await fs.readFile(fullPath, "utf-8");

        // Customize site.json with the user's site name
        if (relativePath === "src/content/config/site.json") {
          content = customizeSiteConfig(content, siteName);
        }

        files.push({ path: relativePath, content });
      }
    }
  }

  await walk(TEMPLATE_DIR, "");
  return files;
}

function customizeSiteConfig(content: string, siteName: string): string {
  const config = JSON.parse(content);
  config.artistName = siteName;
  config.siteTitle = `${siteName} — Official Website`;
  config.siteDescription = `Official website of ${siteName}. Music, tour dates, photos, and more.`;
  config.copyright = `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`;
  return JSON.stringify(config, null, 2) + "\n";
}

export async function handleCreateSite(ctx: JobContext): Promise<JobResult> {
  const payload = ctx.job.requestPayload as unknown as CreateSitePayload;
  if (!payload?.slug || !payload?.name) {
    return { success: false, message: "Missing required payload fields: name, slug" };
  }

  const { name, slug } = payload;
  const userId = ctx.job.userId;
  const siteId = ctx.job.siteId;

  try {
    // 1. Create GitHub repo
    const repoName = `stagecraft-site-${slug}`;
    const repo = await createRepo({
      userId,
      name: repoName,
      description: `${name} — musician website powered by Stagecraft`,
    });

    // Update site with GitHub metadata
    await prisma.site.update({
      where: { id: siteId },
      data: {
        githubRepoOwner: repo.owner,
        githubRepoName: repo.name,
        githubDefaultBranch: repo.defaultBranch,
      },
    });

    // 2. Read and customize template files
    const files = await readTemplateFiles(name);

    // 3. Push template files to the repo
    await pushFiles(userId, repo.owner, repo.name, repo.defaultBranch, files, `Initial site: ${name}`);

    // 4. Create Netlify site (bare — repo will be connected via Netlify UI)
    const netlifySite = await createNetlifySite({
      userId,
      name: `stagecraft-site-${slug}`,
      repoOwner: repo.owner,
      repoName: repo.name,
    });

    // 5. Update site with metadata and mark active
    await prisma.site.update({
      where: { id: siteId },
      data: {
        netlifySiteId: netlifySite.siteId,
        netlifyAdminUrl: netlifySite.adminUrl,
        productionUrl: netlifySite.sslUrl,
        status: "active",
      },
    });

    return {
      success: true,
      data: {
        githubUrl: `https://github.com/${repo.owner}/${repo.name}`,
        netlifyAdminUrl: netlifySite.adminUrl,
        netlifySiteId: netlifySite.siteId,
      },
    };
  } catch (error) {
    // Mark site as errored
    await prisma.site.update({
      where: { id: siteId },
      data: { status: "error" },
    });

    const message = error instanceof Error ? error.message : "Unknown error during site creation";
    return { success: false, message };
  }
}
