import { prisma } from "@stagecraft/db";

interface CreateSiteOptions {
  userId: string;
  name: string;
  repo?: {
    provider: "github";
    repo_path: string;
    repo_branch: string;
    cmd: string;
    dir: string;
    /**
     * Numeric id of Netlify's GitHub App installation on the repo's owner
     * account. When present, Netlify clones via App-based HTTPS+token
     * (the same path the dashboard's "Link to a different repository"
     * UI uses). When absent, Netlify falls back to deploy-key (SSH) mode,
     * which requires Netlify to register an SSH key on the repo and
     * frequently fails with "Host key verification failed" on first deploy.
     *
     * Discoverable via `findGithubAppInstallation(userId, "netlify",
     * repoOwner)` from `integrations/github.ts`.
     */
    installation_id?: number;
  };
}

interface NetlifySiteResult {
  siteId: string;
  siteName: string;
  url: string;
  adminUrl: string;
  sslUrl: string;
}

async function getNetlifyToken(userId: string): Promise<string> {
  const integration = await prisma.integrationAccount.findUnique({
    where: { userId_provider: { userId, provider: "netlify" } },
  });

  if (!integration?.accessToken) {
    throw new Error("Netlify account not connected");
  }

  return integration.accessToken;
}

async function netlifyApi(token: string, path: string, options?: RequestInit) {
  const res = await fetch(`https://api.netlify.com/api/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Netlify API error (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Create a Netlify site, optionally linked to a GitHub repo.
 *
 * When `repo` is provided the site is created with repo auto-deploy enabled.
 * If linking fails (e.g. Netlify's GitHub App isn't installed), callers should
 * catch the error and retry without the `repo` field, then surface a manual
 * linking URL from the Netlify dashboard.
 */
export async function createSite(options: CreateSiteOptions): Promise<NetlifySiteResult> {
  const token = await getNetlifyToken(options.userId);

  const body = options.repo
    ? { name: options.name, repo: options.repo }
    : {
        name: options.name,
        build_settings: { cmd: "npm run build", dir: "dist" },
      };

  const data = await netlifyApi(token, "/sites", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    siteId: data.id,
    siteName: data.name,
    url: data.url,
    adminUrl: data.admin_url,
    sslUrl: data.ssl_url,
  };
}

/**
 * Set environment variables on a Netlify site.
 */
export async function setEnvVars(
  userId: string,
  siteId: string,
  vars: Record<string, string>
): Promise<void> {
  const token = await getNetlifyToken(userId);

  const envArray = Object.entries(vars).map(([key, value]) => ({
    key,
    values: [{ value, context: "all" }],
  }));

  await netlifyApi(token, `/accounts/me/env?site_id=${siteId}`, {
    method: "POST",
    body: JSON.stringify(envArray),
  });
}

/**
 * Look up the deploy preview for a specific PR number on a Netlify site.
 * Netlify creates these automatically when the site has repo auto-deploys configured.
 */
export async function getDeployPreviewForPR(
  userId: string,
  netlifySiteId: string,
  prNumber: number
): Promise<{ previewUrl: string | null; state: string }> {
  const token = await getNetlifyToken(userId);

  const deploys = await netlifyApi(
    token,
    `/sites/${netlifySiteId}/deploys?per_page=20`
  ) as Array<{ review_id: number | null; deploy_url: string | null; state: string }>;

  const deploy = deploys.find((d) => d.review_id === prNumber);

  if (!deploy) {
    return { previewUrl: null, state: "building" };
  }

  return {
    previewUrl: deploy.deploy_url ?? null,
    state: deploy.state ?? "building",
  };
}

/**
 * Trigger a fresh build on a Netlify site. Used after writing env vars
 * post-deploy so the next build picks them up — Netlify does not
 * automatically rebuild when only env-vars change.
 *
 * Returns the build id so callers can surface a "rebuilding…" link.
 */
export async function triggerBuild(
  userId: string,
  netlifySiteId: string,
): Promise<{ buildId: string }> {
  const token = await getNetlifyToken(userId);
  const data = (await netlifyApi(token, `/sites/${netlifySiteId}/builds`, {
    method: "POST",
  })) as { id: string };
  return { buildId: data.id };
}

/**
 * Delete a Netlify site.
 */
export async function deleteSite(userId: string, siteId: string): Promise<void> {
  const token = await getNetlifyToken(userId);

  await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
