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
 * Handles three real-world env-var shapes:
 *
 * 1. Multi-line PEM with real newlines (the `.pem` you download from GitHub).
 * 2. Single-line PEM where newlines are escaped as literal `\n` (some
 *    deployment dashboards do this).
 * 3. Single-line PEM where newlines have been replaced with single spaces
 *    (Netlify dashboard fields and `netlify env:set` both flatten this way —
 *    confirmed in production smoke testing). The header / footer still have
 *    `-----BEGIN ... PRIVATE KEY-----` markers; we extract those, strip all
 *    whitespace from the body, and re-emit canonical 64-char-line form.
 *
 * After format reconstruction, round-trip through `createPrivateKey` to
 * accept either PKCS#1 (`-----BEGIN RSA PRIVATE KEY-----`) or PKCS#8
 * (`-----BEGIN PRIVATE KEY-----`) and always emit PKCS#8 — required by
 * `@octokit/auth-app` v8+'s Web Crypto path.
 */
export function normalizePrivateKey(raw: string): string {
  let pem = raw.replace(/\\n/g, "\n");

  if (!pem.includes("\n")) {
    const begin = pem.match(/-----BEGIN [A-Z0-9 ]+ KEY-----/);
    const end = pem.match(/-----END [A-Z0-9 ]+ KEY-----/);
    if (begin && end && begin.index !== undefined && end.index !== undefined) {
      const body = pem
        .slice(begin.index + begin[0].length, end.index)
        .replace(/\s+/g, "");
      const lines: string[] = [];
      for (let i = 0; i < body.length; i += 64) {
        lines.push(body.slice(i, i + 64));
      }
      pem = `${begin[0]}\n${lines.join("\n")}\n${end[0]}\n`;
    }
  }

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

  // TEMP DEBUG: trace where DECODER errors originate on production. Remove
  // once the install-callback flow is verified end-to-end.
  const debugTag = "[debug:mintInstallationToken]";
  console.log(debugTag, "called", {
    installationId,
    appIdLen: appId.length,
    keyRawLen: privateKeyRaw.length,
    keyRawHead: privateKeyRaw.slice(0, 32),
    keyRawTail: privateKeyRaw.slice(-32),
    keyRawHasEscapedNewlines: privateKeyRaw.includes("\\n"),
    keyRawHasRealNewlines: privateKeyRaw.includes("\n"),
    nodeVersion: process.version,
  });

  let privateKey: string;
  try {
    privateKey = normalizePrivateKey(privateKeyRaw);
    console.log(debugTag, "normalize ok", {
      pkcs8Len: privateKey.length,
      pkcs8Head: privateKey.slice(0, 32),
    });
  } catch (cause) {
    console.error(debugTag, "normalize threw", cause);
    throw cause;
  }

  try {
    const auth = createAppAuth({ appId, privateKey, installationId });
    const result = await auth({ type: "installation" });
    console.log(debugTag, "auth ok", { tokenHead: result.token.slice(0, 8) });
    return {
      token: result.token,
      expiresAt: result.expiresAt,
    };
  } catch (cause) {
    console.error(debugTag, "auth threw", cause);
    throw cause;
  }
}
