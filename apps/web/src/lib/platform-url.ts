/**
 * The public URL of the Stagecraft platform — what artist sites use to
 * call back to us via the broker.
 *
 * Reads `STAGECRAFT_PUBLIC_URL` first, falling back to `AUTH_URL`.
 *
 * Why two env vars: `AUTH_URL` must point at the platform's own host so
 * NextAuth + OAuth-redirect flows work. In dev that's
 * `http://localhost:3000`, which can't be reached from artist sites
 * deployed on Vercel/Netlify. Setting `STAGECRAFT_PUBLIC_URL=
 * https://stagecraft.website` in `.op.env` lets `/create` and the
 * install-callback provision artist sites that broker against prod
 * while everything else still runs against localhost.
 *
 * In production, leave `STAGECRAFT_PUBLIC_URL` unset and `AUTH_URL`
 * IS the public URL — nothing changes.
 */
export function getPublicPlatformUrl(): string {
  // Use `||` (not `??`) so an empty `STAGECRAFT_PUBLIC_URL=` line in
  // .op.env doesn't shadow the AUTH_URL fallback.
  const value = process.env.STAGECRAFT_PUBLIC_URL || process.env.AUTH_URL;
  if (!value) {
    throw new Error(
      "Neither STAGECRAFT_PUBLIC_URL nor AUTH_URL is set on the platform",
    );
  }
  return value.replace(/\/$/, "");
}
