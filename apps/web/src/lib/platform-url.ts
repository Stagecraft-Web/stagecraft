/**
 * Public URL of the platform — baked into every artist site as
 * `STAGECRAFT_PLATFORM_URL` so the artist site can POST to the publish
 * broker, etc.
 *
 * Distinct from `AUTH_URL`: NextAuth needs the URL the user's browser
 * hits (localhost in dev), while artist sites are deployed externally
 * and need a publicly reachable URL. They diverge when developing
 * locally — `AUTH_URL=http://localhost:3000`, but
 * `STAGECRAFT_PUBLIC_URL=https://<ngrok-or-tunnel>.ngrok.io`.
 *
 * In production they're typically the same.
 */
export function getPlatformPublicUrl(): string {
  const value = process.env.STAGECRAFT_PUBLIC_URL ?? process.env.AUTH_URL;
  if (!value) {
    throw new Error("Neither STAGECRAFT_PUBLIC_URL nor AUTH_URL is set on the platform");
  }
  return value.replace(/\/$/, "");
}

/**
 * Throws when the public URL is unreachable from a deployed artist site
 * (e.g. localhost). Called at site-creation time so we fail fast instead
 * of baking a broken STAGECRAFT_PLATFORM_URL into the artist's env vars.
 */
export function assertPlatformPublicUrlReachable(): void {
  const url = getPlatformPublicUrl();
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|$|\/)/.test(url)) {
    throw new Error(
      `Platform URL is ${url}, which the deployed artist site can't reach. ` +
        `Set STAGECRAFT_PUBLIC_URL to a tunnel URL (e.g. ngrok) in .op.env before creating sites in dev.`,
    );
  }
}
