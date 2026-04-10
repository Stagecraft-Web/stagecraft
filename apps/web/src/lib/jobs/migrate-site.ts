import { prisma } from "@stagecraft/db";
import type { JobContext, JobResult } from "@stagecraft/queue";
import { createRepo, pushFiles } from "@/lib/integrations/github";
import { createSite as createNetlifySite } from "@/lib/integrations/netlify";
import { crawlSite } from "@/lib/migration/crawler";
import { mapExtractedContent } from "@/lib/migration/mapper";
import { buildMigrationReport } from "@/lib/migration/report";
import fs from "fs/promises";
import path from "path";

const TEMPLATE_DIR = path.resolve(process.cwd(), "../../templates/musician-site");

// Binary extensions to skip when pushing via Git Data API
const BINARY_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".ico", ".svg",
  ".woff", ".woff2", ".ttf", ".eot",
  ".mp3", ".mp4", ".wav", ".ogg",
  ".pdf", ".zip",
]);

interface MigrateSitePayload {
  url: string;
  name: string;
  slug: string;
  blueprintType: string;
}

/** Same .gitignore-aware template reader as create-site. */
async function getGitignoreDirs(): Promise<Set<string>> {
  try {
    const content = await fs.readFile(path.join(TEMPLATE_DIR, ".gitignore"), "utf-8");
    const dirs = new Set<string>();
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      if (trimmed.endsWith("/")) dirs.add(trimmed.slice(0, -1));
    }
    return dirs;
  } catch {
    return new Set();
  }
}

async function readTemplateFiles(siteName: string): Promise<{ path: string; content: string }[]> {
  const files: { path: string; content: string }[] = [];
  const gitignoreDirs = await getGitignoreDirs();
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
        if (relativePath === "src/content/config/site.json") {
          // Template baseline — will be overwritten by mapped content
          const cfg = JSON.parse(content);
          cfg.artistName = siteName;
          cfg.siteTitle = `${siteName} — Official Website`;
          content = JSON.stringify(cfg, null, 2) + "\n";
        }
        files.push({ path: relativePath, content });
      }
    }
  }

  await walk(TEMPLATE_DIR, "");
  return files;
}

export async function handleMigrateSite(ctx: JobContext): Promise<JobResult> {
  const payload = ctx.job.requestPayload as unknown as MigrateSitePayload;

  if (!payload?.url || !payload?.name || !payload?.slug) {
    return { success: false, message: "Missing required payload fields: url, name, slug" };
  }

  const { url, name, slug } = payload;
  const userId = ctx.job.userId;
  const siteId = ctx.job.siteId;

  try {
    // ── Step 1: Crawl source site ────────────────────────────────────────────
    const extracted = await crawlSite(url);

    if (extracted.pages.length === 0) {
      return {
        success: false,
        message: `Could not fetch any pages from ${url}. The site may be unavailable or block automated access.`,
        failureCategory: "unknown",
      };
    }

    // ── Step 2: Map content to template schema ───────────────────────────────
    const mapped = mapExtractedContent(extracted, name);

    // ── Step 3: Build migration report ──────────────────────────────────────
    const report = buildMigrationReport(extracted, mapped, name);

    // ── Step 4: Create GitHub repo ───────────────────────────────────────────
    const repoName = `stagecraft-site-${slug}`;
    const repo = await createRepo({
      userId,
      name: repoName,
      description: `${name} — musician website powered by Stagecraft (migrated)`,
    });

    await prisma.site.update({
      where: { id: siteId },
      data: {
        githubRepoOwner: repo.owner,
        githubRepoName: repo.name,
        githubDefaultBranch: repo.defaultBranch,
      },
    });

    // ── Step 5: Push template base ───────────────────────────────────────────
    const templateFiles = await readTemplateFiles(name);

    // Build final file list: template base, then overlay with mapped content
    const mappedPaths = new Set(mapped.files.map((f) => f.path));
    const baseFiles = templateFiles.filter((f) => !mappedPaths.has(f.path));
    const allFiles = [
      ...baseFiles,
      ...mapped.files.map((f) => ({ path: f.path, content: f.content })),
    ];

    await pushFiles(
      userId,
      repo.owner,
      repo.name,
      repo.defaultBranch,
      allFiles,
      `Migrate site from ${url}`
    );

    // ── Step 6: Create Netlify site ──────────────────────────────────────────
    const netlifySite = await createNetlifySite({
      userId,
      name: `stagecraft-site-${slug}`,
      repoOwner: repo.owner,
      repoName: repo.name,
    });

    // ── Step 7: Mark site active ─────────────────────────────────────────────
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
        sourceUrl: url,
        githubUrl: `https://github.com/${repo.owner}/${repo.name}`,
        netlifyAdminUrl: netlifySite.adminUrl,
        netlifySiteId: netlifySite.siteId,
        pagesCrawled: extracted.pages.length,
        pagesMapped: report.pagesMapped,
        overallConfidence: report.overallConfidence,
        report: report as unknown as Record<string, unknown>,
      },
    };
  } catch (error) {
    await prisma.site.update({
      where: { id: siteId },
      data: { status: "error" },
    });

    const message = error instanceof Error ? error.message : "Unknown error during migration";
    return { success: false, message };
  }
}
