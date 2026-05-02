import { signInstallState } from "./state-signing";

/**
 * Build the URL that the platform's "Connect repo" CTA links to.
 *
 * Pattern: `https://github.com/apps/<slug>/installations/new?state=<signed>`
 *
 * GitHub redirects the artist to the App's setup URL after install,
 * preserving the `state` query param so the install callback can route
 * the new installation to the right Site row.
 */
export async function buildInstallUrl(args: {
  siteId: string;
  userId: string;
}): Promise<string> {
  const baseUrl = process.env.GITHUB_APP_INSTALL_URL;
  if (!baseUrl) {
    throw new Error("GITHUB_APP_INSTALL_URL is not set");
  }
  const state = await signInstallState(args);
  const url = new URL(baseUrl);
  url.searchParams.set("state", state);
  return url.toString();
}
