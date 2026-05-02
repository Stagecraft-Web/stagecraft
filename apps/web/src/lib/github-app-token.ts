import { createAppAuth } from "@octokit/auth-app";

export type InstallationToken = {
  token: string;
  expiresAt: string;
};

export class GitHubAppMisconfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubAppMisconfiguredError";
  }
}

/**
 * Mint a GitHub installation access token for the given installation id.
 * Returns the token + ISO expiry. Throws GitHubAppMisconfiguredError when
 * GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY are unset.
 *
 * The private key in env may have either real newlines or escaped \n —
 * both are normalized.
 */
export async function mintInstallationToken(
  installationId: number,
): Promise<InstallationToken> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyRaw = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !privateKeyRaw) {
    throw new GitHubAppMisconfiguredError("GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY not set");
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  const auth = createAppAuth({ appId, privateKey, installationId });
  const result = await auth({ type: "installation" });

  return {
    token: result.token,
    expiresAt: result.expiresAt,
  };
}
