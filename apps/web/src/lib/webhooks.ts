import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify GitHub webhook signature (HMAC-SHA256).
 * GitHub sends: X-Hub-Signature-256: sha256=<hex>
 */
export function verifyGitHubSignature(
  rawBody: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Verify Netlify webhook token.
 *
 * Since Netlify does not sign deploy notification payloads, verification uses a
 * shared secret that must appear in one of two places:
 *   1. Authorization header — "Authorization: Bearer <NETLIFY_WEBHOOK_SECRET>"
 *   2. Query parameter   — "/api/webhooks/netlify?token=<NETLIFY_WEBHOOK_SECRET>"
 *
 * Configure the Netlify webhook URL to include the token as a query parameter,
 * e.g. https://app.example.com/api/webhooks/netlify?token=<secret>
 */
export function verifyNetlifyToken(
  tokenFromQuery: string | null,
  authHeader: string | null,
  secret: string
): boolean {
  const candidate = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : tokenFromQuery;

  if (!candidate) return false;
  if (candidate.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(secret));
}
