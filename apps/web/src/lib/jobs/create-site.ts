import { randomBytes } from "node:crypto";
import path from "node:path";

import { prisma } from "@stagecraft/db";
import type { JobContext, JobResult } from "@stagecraft/queue";
import type { BlueprintType } from "@stagecraft/shared";

import { createRepo, pushFiles } from "@/lib/integrations/github";
import { createSite as createNetlifySite, setEnvVars } from "@/lib/integrations/netlify";
import { readTemplateFiles } from "@/lib/template-reader";

const TEMPLATE_DIR = path.resolve(process.cwd(), "../../templates/musician-site");

interface CreateSitePayload {
  name: string;
  slug: string;
  blueprintType: BlueprintType;
}

function getPlatformUrl(): string {
  const value = process.env.AUTH_URL;
  if (!value) {
    throw new Error("AUTH_URL is not set on the platform");
  }
  return value.replace(/\/$/, "");
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
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email) {
      throw new Error("User has no email on file — required for ADMIN_EMAIL on the artist site");
    }

    // 1. Create GitHub repo
    const repoName = `stagecraft-site-${slug}`;
    const repo = await createRepo({
      userId,
      name: repoName,
      description: `${name} — musician website powered by Stagecraft`,
    });

    await prisma.site.update({
      where: { id: siteId },
      data: {
        githubRepoOwner: repo.owner,
        githubRepoName: repo.name,
        githubDefaultBranch: repo.defaultBranch,
      },
    });

    // 2. Push template files (no per-file customization — the artist
    //    personalizes content via the Puck editor at /admin once the
    //    site is up).
    const files = await readTemplateFiles(TEMPLATE_DIR);
    await pushFiles(userId, repo.owner, repo.name, repo.defaultBranch, files, `Initial site: ${name}`);

    // 3. Create Netlify site, linked to the GitHub repo. Next.js build:
    //    `npm run build` produces `.next/`; @netlify/plugin-nextjs handles
    //    serving. If linking fails (Netlify's GitHub App isn't installed),
    //    fall back to a plain site and surface a manual-link URL.
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
          dir: ".next",
        },
      });
    } catch {
      netlifySite = await createNetlifySite({
        userId,
        name: `stagecraft-site-${slug}`,
      });
      netlifyLinkUrl = `https://app.netlify.com/projects/${netlifySite.siteName}/link`;
    }

    // 4. Provision env vars the new template needs at runtime. Three
    //    are immediately knowable; STAGECRAFT_BROKER_SECRET is set by
    //    the artist (or future automation) after the GitHub App
    //    install completes (see ADR-008 §3 reveal page).
    let netlifyEnvWarning: string | undefined;
    try {
      await setEnvVars(userId, netlifySite.siteId, {
        MAGIC_LINK_SIGNING_SECRET: randomBytes(32).toString("hex"),
        ADMIN_EMAIL: user.email,
        STAGECRAFT_PLATFORM_URL: getPlatformUrl(),
        // STAGECRAFT_SITE_ID, not SITE_ID — Netlify reserves the latter
        // (it injects its own Netlify-side site id into Functions).
        STAGECRAFT_SITE_ID: siteId,
      });
    } catch (cause) {
      netlifyEnvWarning =
        cause instanceof Error ? cause.message : "Failed to provision Netlify env vars";
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
        ...(netlifyEnvWarning ? { netlifyEnvWarning } : {}),
      },
    };
  } catch (error) {
    await prisma.site.update({
      where: { id: siteId },
      data: { status: "error" },
    });

    const message = error instanceof Error ? error.message : "Unknown error during site creation";
    return { success: false, message };
  }
}
