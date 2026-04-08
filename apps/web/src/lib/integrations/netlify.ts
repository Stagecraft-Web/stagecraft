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
 * Create a Netlify site linked to a GitHub repo.
 * Netlify will auto-deploy on push to the configured branch.
 */
export async function createSite(options: CreateSiteOptions): Promise<NetlifySiteResult> {
  const token = await getNetlifyToken(options.userId);

  const data = await netlifyApi(token, "/sites", {
    method: "POST",
    body: JSON.stringify({
      name: options.name,
      repo: {
        provider: "github",
        repo: `${options.repoOwner}/${options.repoName}`,
        private: false,
        branch: options.repoBranch ?? "main",
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
