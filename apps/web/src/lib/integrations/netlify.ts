import { prisma } from "@stagecraft/db";

interface CreateSiteOptions {
  userId: string;
  name: string;
  repoOwner: string;
  repoName: string;
  repoBranch?: string;
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
 * Create a Netlify site (without repo linking).
 *
 * Netlify's API doesn't reliably set up deploy keys when linking a repo via
 * POST /sites. Instead we create a bare site and show a link in the dashboard
 * for the user to connect the repo through Netlify's UI, which handles all
 * the deploy-key and webhook plumbing correctly.
 */
export async function createSite(options: CreateSiteOptions): Promise<NetlifySiteResult> {
  const token = await getNetlifyToken(options.userId);

  const data = await netlifyApi(token, "/sites", {
    method: "POST",
    body: JSON.stringify({
      name: options.name,
      // Build settings without repo link — will be connected via Netlify UI
      build_settings: {
        cmd: "npm run build",
        dir: "dist",
      },
    }),
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
