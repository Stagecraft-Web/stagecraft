import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const SECRET_BYTES = 32;
const SECRET_PREFIX = "scbs_"; // stagecraft broker secret

export type GeneratedBrokerSecret = {
  /** The plaintext secret. Show to the user once; do not persist. */
  plaintext: string;
  /** Hash to store on Site.brokerSecretHash. */
  hash: string;
};

/**
 * Generate a new per-site broker secret. The plaintext is shown to the
 * artist (or written to their site's env) once at install; only the hash
 * is persisted on the platform.
 */
export function generateBrokerSecret(): GeneratedBrokerSecret {
  const plaintext = SECRET_PREFIX + randomBytes(SECRET_BYTES).toString("hex");
  return { plaintext, hash: hashBrokerSecret(plaintext) };
}

export function hashBrokerSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/**
 * Constant-time comparison of an incoming secret to a stored hash. Use this
 * (not ===) to defeat timing attacks on the secret comparison.
 */
export function brokerSecretMatches(incoming: string, storedHash: string): boolean {
  const incomingHash = hashBrokerSecret(incoming);
  if (incomingHash.length !== storedHash.length) return false;
  return timingSafeEqual(Buffer.from(incomingHash), Buffer.from(storedHash));
}
