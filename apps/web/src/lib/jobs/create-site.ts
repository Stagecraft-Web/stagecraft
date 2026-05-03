import { randomBytes } from "node:crypto";
import path from "node:path";

import { prisma } from "@stagecraft/db";
import type { JobContext, JobResult } from "@stagecraft/queue";
import type { BlueprintType } from "@stagecraft/shared";

import { createRepo, pushFiles } from "@/lib/integrations/github";
import { createSite as createNetlifySite, setEnvVars as setNetlifyEnvVars } from "@/lib/integrations/netlify";
import {
  createProject as createVercelProject,
  setEnvVars as setVercelEnvVars,
} from "@/lib/integrations/vercel";
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

/**
 * Pick which deploy target to use for this site, based on the artist's
 * connected integrations. Vercel takes precedence when both are
 * connected — its API is more reliable for programmatic site creation
 * (it auto-resolves GitHub App installations; Netlify's API doesn't).
 *
 * Throws if neither is connected; the route handler at POST /api/sites
 * checks this earlier, so a throw here means an integration was
 * disconnected between the request and worker invocation.
 */
async function pickDeployTarget(userId: string): Promise<"netlify" | "vercel"> {
  const integrations = await prisma.integrationAccount.findMany({
    where: { userId, provider: { in: ["netlify", "vercel"] } },
    select: { provider: true, metadata: true },
  });

  const hasVercel = integrations.some((i) => i.provider === "vercel");
  if (hasVercel) return "vercel";

  const hasNetlify = integrations.some((i) => i.provider === "netlify");
  if (hasNetlify) return "netlify";

  throw new Error("No deploy-target integration connected (Vercel or Netlify required)");
}

interface DeployResult {
  /** Generic fields shared by both providers */
  productionUrl: string;
  adminUrl: string;
  /** Netlify-only — populated when target = "netlify" */
  netlifySiteId?: string;
  netlifyLinkUrl?: string;
  /** Vercel-only — populated when target = "vercel" */
  vercelProjectId?: string;
  vercelProjectName?: string;
  vercelTeamId?: string | null;
  /** Soft-warning if env-var provisioning partially failed */
  envWarning?: string;
}

async function deployToNetlify(args: {
  userId: string;
  siteId: string;
  slug: string;
  repoOwner: string;
  repoName: string;
  repoBranch: string;
  envVars: Record<string, string>;
}): Promise<DeployResult> {
  let netlifySite;
  let netlifyLinkUrl: string | undefined;
  try {
    netlifySite = await createNetlifySite({
      userId: args.userId,
      name: `stagecraft-site-${args.slug}`,
      repo: {
        provider: "github",
        repo_path: `${args.repoOwner}/${args.repoName}`,
        repo_branch: args.repoBranch,
        cmd: "npm run build",
        dir: ".next",
      },
    });
  } catch {
    netlifySite = await createNetlifySite({
      userId: args.userId,
      name: `stagecraft-site-${args.slug}`,
    });
    netlifyLinkUrl = `https://app.netlify.com/projects/${netlifySite.siteName}/link`;
  }

  let envWarning: string | undefined;
  try {
    await setNetlifyEnvVars(args.userId, netlifySite.siteId, args.envVars);
  } catch (cause) {
    envWarning = cause instanceof Error ? cause.message : "Failed to provision Netlify env vars";
  }

  return {
    productionUrl: netlifySite.sslUrl,
    adminUrl: netlifySite.adminUrl,
    netlifySiteId: netlifySite.siteId,
    netlifyLinkUrl,
    envWarning,
  };
}

async function deployToVercel(args: {
  userId: string;
  siteId: string;
  slug: string;
  repoOwner: string;
  repoName: string;
  envVars: Record<string, string>;
}): Promise<DeployResult> {
  // Pull the team id (if any) the artist scoped at /settings → Connect Vercel.
  const integration = await prisma.integrationAccount.findUnique({
    where: { userId_provider: { userId: args.userId, provider: "vercel" } },
    select: { metadata: true },
  });
  const teamId =
    integration?.metadata && typeof integration.metadata === "object" && integration.metadata !== null
      ? (integration.metadata as { teamId?: string | null }).teamId ?? undefined
      : undefined;

  const project = await createVercelProject({
    userId: args.userId,
    name: `stagecraft-site-${args.slug}`,
    teamId: teamId ?? undefined,
    repo: { repo: `${args.repoOwner}/${args.repoName}` },
    framework: "nextjs",
  });

  let envWarning: string | undefined;
  try {
    await setVercelEnvVars({
      userId: args.userId,
      projectId: project.projectId,
      teamId: project.teamId ?? undefined,
      vars: args.envVars,
    });
  } catch (cause) {
    envWarning = cause instanceof Error ? cause.message : "Failed to provision Vercel env vars";
  }

  return {
    productionUrl: project.productionUrl,
    adminUrl: project.adminUrl,
    vercelProjectId: project.projectId,
    vercelProjectName: project.projectName,
    vercelTeamId: project.teamId,
    envWarning,
  };
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

    const deployTarget = await pickDeployTarget(userId);

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
        deployTarget,
      },
    });

    // 2. Push template files (no per-file customization — the artist
    //    personalizes content via the Puck editor at /admin once the
    //    site is up).
    const files = await readTemplateFiles(TEMPLATE_DIR);
    await pushFiles(userId, repo.owner, repo.name, repo.defaultBranch, files, `Initial site: ${name}`);

    // 3. Provision the deploy project on the chosen target. Both branches
    //    create the project linked to the GitHub repo and set the same
    //    runtime env vars; only the IDs they return differ.
    const envVars: Record<string, string> = {
      MAGIC_LINK_SIGNING_SECRET: randomBytes(32).toString("hex"),
      ADMIN_EMAIL: user.email,
      STAGECRAFT_PLATFORM_URL: getPlatformUrl(),
      // STAGECRAFT_SITE_ID, not SITE_ID — Netlify reserves the latter
      // (auto-injects its own Netlify-side site id into Functions). Use
      // the namespaced name on Vercel too so the artist template stays
      // single-codepath.
      STAGECRAFT_SITE_ID: siteId,
    };

    const deploy =
      deployTarget === "vercel"
        ? await deployToVercel({
            userId,
            siteId,
            slug,
            repoOwner: repo.owner,
            repoName: repo.name,
            envVars,
          })
        : await deployToNetlify({
            userId,
            siteId,
            slug,
            repoOwner: repo.owner,
            repoName: repo.name,
            repoBranch: repo.defaultBranch,
            envVars,
          });

    // 4. Update site with target-specific metadata and mark active.
    await prisma.site.update({
      where: { id: siteId },
      data: {
        productionUrl: deploy.productionUrl,
        status: "active",
        ...(deploy.netlifySiteId
          ? { netlifySiteId: deploy.netlifySiteId, netlifyAdminUrl: deploy.adminUrl }
          : {}),
        ...(deploy.vercelProjectId
          ? {
              vercelProjectId: deploy.vercelProjectId,
              vercelProjectName: deploy.vercelProjectName,
              vercelTeamId: deploy.vercelTeamId,
            }
          : {}),
      },
    });

    return {
      success: true,
      data: {
        deployTarget,
        githubUrl: `https://github.com/${repo.owner}/${repo.name}`,
        adminUrl: deploy.adminUrl,
        productionUrl: deploy.productionUrl,
        ...(deploy.netlifySiteId ? { netlifyAdminUrl: deploy.adminUrl, netlifySiteId: deploy.netlifySiteId } : {}),
        ...(deploy.vercelProjectId
          ? {
              vercelProjectId: deploy.vercelProjectId,
              vercelProjectName: deploy.vercelProjectName,
            }
          : {}),
        ...(deploy.netlifyLinkUrl ? { netlifyLinkUrl: deploy.netlifyLinkUrl } : {}),
        ...(deploy.envWarning ? { envWarning: deploy.envWarning } : {}),
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
