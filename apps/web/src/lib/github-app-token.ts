import { createPrivateKey } from "node:crypto";

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
 * Normalize whatever PEM is in `GITHUB_APP_PRIVATE_KEY` into PKCS#8.
 *
 * GitHub's downloaded `.pem` is PKCS#1 (`-----BEGIN RSA PRIVATE KEY-----`),
 * but `@octokit/auth-app` v8+ uses `universal-github-app-jwt` v2+ which
 * signs via Web Crypto (`crypto.subtle.importKey('pkcs8', …)`). Web Crypto
 * only accepts PKCS#8, so a raw PKCS#1 key throws `DataError: Invalid
 * keyData`. Round-tripping through `createPrivateKey` accepts either
 * format and re-emits PKCS#8 — fixes the most common footgun without
 * making operators run `openssl pkcs8` by hand.
 *
 * Also handles single-line env vars where newlines were escaped as `\n`.
 */
export function normalizePrivateKey(raw: string): string {
  const pem = raw.replace(/\\n/g, "\n");
  const keyObject = createPrivateKey(pem);
  return keyObject.export({ type: "pkcs8", format: "pem" }) as string;
}

/**
 * Mint a GitHub installation access token for the given installation id.
 * Returns the token + ISO expiry. Throws GitHubAppMisconfiguredError when
 * GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY are unset.
 */
export async function mintInstallationToken(
  installationId: number,
): Promise<InstallationToken> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyRaw = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !privateKeyRaw) {
    throw new GitHubAppMisconfiguredError("GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY not set");
  }

  const privateKey = normalizePrivateKey(privateKeyRaw);
  const auth = createAppAuth({ appId, privateKey, installationId });
  const result = await auth({ type: "installation" });

  return {
    token: result.token,
    expiresAt: result.expiresAt,
  };
}
