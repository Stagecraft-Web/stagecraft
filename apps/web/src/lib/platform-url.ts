/**
 * The canonical public URL of the production Stagecraft platform.
 * Hardcoded because it's invariant: every artist site brokers against
 * this host, regardless of which environment the dashboard runs from.
 * Override via `STAGECRAFT_PUBLIC_URL` only when you genuinely need to
 * point artist sites elsewhere (preview environments, forks).
 */
const STAGECRAFT_PUBLIC_URL_DEFAULT = "https://stagecraft.website";

/**
 * The public URL of the Stagecraft platform — what artist sites use to
 * call back to us via the broker.
 *
 * Resolution order:
 *   1. `STAGECRAFT_PUBLIC_URL` env var (override for staging/fork)
 *   2. The hardcoded prod URL above
 *
 * Why not derive from `AUTH_URL`: `AUTH_URL` must point at the
 * platform's own host so NextAuth + OAuth-redirect flows work. In dev
 * that's `http://localhost:3000`, which can't be reached from artist
 * sites deployed on Vercel/Netlify. Defaulting here means a local
 * `/create` immediately produces artist sites that broker against
 * prod — no extra env var to remember.
 */
export function getPublicPlatformUrl(): string {
  // Use `||` (not `??`) so an empty `STAGECRAFT_PUBLIC_URL=` falls
  // through to the default rather than blocking it.
  const value = process.env.STAGECRAFT_PUBLIC_URL || STAGECRAFT_PUBLIC_URL_DEFAULT;
  return value.replace(/\/$/, "");
}
