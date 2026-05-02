import { z } from "zod";

import { prisma } from "@stagecraft/db";

import { auth } from "@/lib/auth";
import { generateBrokerSecret } from "@/lib/broker-secret";
import { listInstallationRepos } from "@/lib/github-app-install";
import { GitHubAppMisconfiguredError } from "@/lib/github-app-token";
import { verifyInstallState } from "@/lib/state-signing";

const searchSchema = z.object({
  installation_id: z.coerce.number().int().positive(),
  state: z.string().min(1),
  setup_action: z.string().optional(),
});

function htmlResponse(status: number, body: string) {
  return new Response(`<!DOCTYPE html>\n${body}`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function page(title: string, content: string): string {
  return `<html><head><title>${escape(title)}</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>
body { font: 16px/1.5 system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; color: #111; }
h1 { font-size: 1.5rem; }
code { background: #f3f4f6; padding: 0.125rem 0.25rem; border-radius: 4px; font-size: 0.95em; }
pre { background: #f3f4f6; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.9em; }
.error { color: #b91c1c; }
.ok { color: #047857; }
.warn { color: #92400e; }
a.button { display: inline-block; padding: 0.5rem 1rem; background: #111; color: #fff; text-decoration: none; border-radius: 6px; margin-top: 1rem; }
</style></head><body>${content}</body></html>`;
}

function errorPage(status: number, title: string, message: string) {
  return htmlResponse(
    status,
    page(
      title,
      `<h1 class="error">${escape(title)}</h1><p>${escape(message)}</p><p><a href="/dashboard">Back to dashboard</a></p>`,
    ),
  );
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorPage(401, "Sign in required", "Please sign in to the platform first, then re-run the install.");
  }

  const url = new URL(request.url);
  const params = searchSchema.safeParse({
    installation_id: url.searchParams.get("installation_id"),
    state: url.searchParams.get("state"),
    setup_action: url.searchParams.get("setup_action") ?? undefined,
  });
  if (!params.success) {
    return errorPage(400, "Missing parameters", "The install callback URL is missing required parameters. Restart the install from your dashboard.");
  }

  const stateData = await verifyInstallState(params.data.state);
  if (!stateData) {
    return errorPage(400, "Install link expired or invalid", "Your install link is older than 10 minutes or was tampered with. Restart from your dashboard.");
  }
  if (stateData.userId !== session.user.id) {
    return errorPage(403, "User mismatch", "This install was initiated by a different user. Restart from your own dashboard.");
  }

  const site = await prisma.site.findUnique({ where: { id: stateData.siteId } });
  if (!site || site.userId !== session.user.id) {
    return errorPage(404, "Site not found", "We couldn't find that site under your account. Restart from your dashboard.");
  }

  if (site.brokerSecretHash) {
    return htmlResponse(
      200,
      page(
        "Already connected",
        `<h1 class="warn">Already connected</h1>
<p>Site <code>${escape(site.name)}</code> already has the GitHub App installed and a broker secret provisioned. Refreshing this page does not regenerate the secret.</p>
<p>If you've lost your broker secret, you'll need to <strong>rotate</strong> it from the dashboard (this updates the hash on the platform; you then update the env var on your deployed site).</p>
<p><a class="button" href="/dashboard">Back to dashboard</a></p>`,
      ),
    );
  }

  let repos;
  try {
    repos = await listInstallationRepos(params.data.installation_id);
  } catch (cause) {
    if (cause instanceof GitHubAppMisconfiguredError) {
      return errorPage(500, "GitHub App not configured", "The platform is missing GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY. Contact support.");
    }
    return errorPage(500, "Could not reach GitHub", `Listing installation repositories failed: ${escape(String(cause))}`);
  }

  if (repos.length === 0) {
    return errorPage(400, "No repositories selected", "Select exactly one repository during install. Restart and try again.");
  }
  if (repos.length > 1) {
    return errorPage(
      400,
      "Multiple repositories selected",
      `The install grants access to ${repos.length} repositories, but a Stagecraft site is one repo. Restart and select exactly one.`,
    );
  }

  const [{ owner, name }] = repos;
  const { plaintext, hash } = generateBrokerSecret();

  await prisma.site.update({
    where: { id: site.id },
    data: {
      githubInstallationId: params.data.installation_id,
      githubRepoOwner: owner,
      githubRepoName: name,
      brokerSecretHash: hash,
      githubAppSuspended: false,
    },
  });

  return htmlResponse(
    200,
    page(
      "GitHub App connected",
      `<h1 class="ok">GitHub App connected</h1>
<p>Site <code>${escape(site.name)}</code> is now connected to <code>${escape(owner)}/${escape(name)}</code>.</p>

<h2>Your broker secret</h2>
<p><strong>Copy this now.</strong> It is shown exactly once and never stored on the platform in plaintext. Set it as an env var on your deployed site.</p>
<pre>${escape(plaintext)}</pre>

<h2>Env vars to set on your deployed site</h2>
<pre>STAGECRAFT_PLATFORM_URL=${escape(url.origin)}
SITE_ID=${escape(site.id)}
STAGECRAFT_BROKER_SECRET=${escape(plaintext)}</pre>

<p>If you lose the secret, rotate it from the dashboard; the previous one will stop working.</p>
<p><a class="button" href="/dashboard">Continue to dashboard</a></p>`,
    ),
  );
}
