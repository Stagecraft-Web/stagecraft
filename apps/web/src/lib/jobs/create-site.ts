import { prisma } from "@stagecraft/db";
import type { JobContext, JobResult } from "@stagecraft/queue";
import type { BlueprintType } from "@stagecraft/shared";
import { createRepo, pushFiles } from "@/lib/integrations/github";
import { createSite as createNetlifySite } from "@/lib/integrations/netlify";
import { readTemplateFiles } from "@/lib/template-reader";
import path from "path";

const TEMPLATE_DIR = path.resolve(process.cwd(), "../../templates/musician-site-legacy");

interface CreateSitePayload {
  name: string;
  slug: string;
  blueprintType: BlueprintType;
}

function customizeSiteConfig(content: string, siteName: string): string {
  const config = JSON.parse(content) as Record<string, unknown>;
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
    const files = await readTemplateFiles(TEMPLATE_DIR, (relativePath, content) => {
      if (relativePath === "src/content/config/site.json") {
        return customizeSiteConfig(content, name);
      }
      return content;
    });

    // 3. Push template files to the repo
    await pushFiles(userId, repo.owner, repo.name, repo.defaultBranch, files, `Initial site: ${name}`);

    // 4. Create Netlify site, linked to the GitHub repo.
    // If repo linking fails (e.g. Netlify's GitHub App isn't installed),
    // fall back to a plain site and surface a link so the user can connect manually.
    let netlifySite;
    let netlifyLinkUrl: string | undefined;
    try {
      netlifySite = await createNetlifySite({
        userId,
        name: `stagecraft-site-${slug}`,
        repo: {
          provider: "github",
          repo_path: `${repo.owner}/${repo.name}`,
          repo_branch: repo.defaultBranch,
          cmd: "npm run build",
          dir: "dist",
        },
      });
    } catch {
      netlifySite = await createNetlifySite({
        userId,
        name: `stagecraft-site-${slug}`,
      });
      netlifyLinkUrl = `https://app.netlify.com/projects/${netlifySite.siteName}/link`;
    }

    // 5. Update site with metadata and mark active
    await prisma.site.update({
      where: { id: siteId },
      data: {
        netlifySiteId: netlifySite.siteId,
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
        ...(netlifyLinkUrl ? { netlifyLinkUrl } : {}),
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
