import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "mc_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const MAGIC_LINK_TTL = "10m";
const SESSION_TTL = "7d";

type TokenType = "magic-link" | "session";

/**
 * Derive the magic-link signing secret deterministically from the
 * site's broker secret. Both are per-site secrets the artist site
 * uses internally; deriving one from the other saves provisioning a
 * second env var on every site.
 *
 * Uses Web Crypto's HMAC-SHA256 (rather than `node:crypto`) so this
 * code runs in the Edge runtime — middleware.ts imports
 * `verifySessionToken` from here and runs on Edge.
 *
 * Domain-separation tag `"magic-link/v1"` future-proofs the derivation
 * — if we ever need to rotate the magic-link secret independent of the
 * broker secret (e.g. cookie format change), bump to v2 to invalidate
 * existing sessions without touching STAGECRAFT_BROKER_SECRET.
 *
 * Rotating STAGECRAFT_BROKER_SECRET also rotates this — by design.
 * Existing magic-link sessions get invalidated, artists re-sign-in.
 * Tokens are short-lived (7d session, 10m magic-link), so the impact
 * is small.
 */
async function deriveMagicLinkSecret(brokerSecret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(brokerSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("magic-link/v1"),
  );
  return new Uint8Array(signature);
}

async function getSecret(): Promise<Uint8Array> {
  // Prefer an explicit MAGIC_LINK_SIGNING_SECRET so dev environments
  // and any legacy artist sites that have it set continue working.
  // New sites get just STAGECRAFT_BROKER_SECRET — derive from that.
  const explicit = process.env.MAGIC_LINK_SIGNING_SECRET;
  if (explicit) return new TextEncoder().encode(explicit);

  const brokerSecret = process.env.STAGECRAFT_BROKER_SECRET;
  if (brokerSecret) return deriveMagicLinkSecret(brokerSecret);

  throw new Error(
    "Neither MAGIC_LINK_SIGNING_SECRET nor STAGECRAFT_BROKER_SECRET is set",
  );
}

async function signToken(email: string, type: TokenType, ttl: string): Promise<string> {
  return new SignJWT({ email, type })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(await getSecret());
}

async function verifyToken(token: string, expected: TokenType): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, await getSecret());
    if (payload.type !== expected) return null;
    if (typeof payload.email !== "string") return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

export function createMagicLinkToken(email: string): Promise<string> {
  return signToken(email, "magic-link", MAGIC_LINK_TTL);
}

export function verifyMagicLinkToken(token: string): Promise<{ email: string } | null> {
  return verifyToken(token, "magic-link");
}

export function createSessionToken(email: string): Promise<string> {
  return signToken(email, "session", SESSION_TTL);
}

export function verifySessionToken(token: string): Promise<{ email: string } | null> {
  return verifyToken(token, "session");
}

export async function getSession(): Promise<{ email: string } | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};
