import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify a GitHub webhook delivery's HMAC-SHA256 signature against
 * GITHUB_APP_WEBHOOK_SECRET. Returns true only when:
 *   - the secret is configured, AND
 *   - the header is well-formed (sha256=<hex>), AND
 *   - the computed digest matches in constant time.
 *
 * Pass the raw request body bytes — not parsed JSON — since GitHub
 * signs the byte sequence as transmitted. Different JSON serializers
 * can produce subtly different bytes; comparing the digest of a
 * re-serialized body would frequently mismatch.
 */
export function verifyGitHubSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signatureHeader) return false;

  const match = signatureHeader.match(/^sha256=([0-9a-f]+)$/i);
  if (!match) return false;
  const provided = match[1];

  const computed = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  if (provided.length !== computed.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(computed));
}
