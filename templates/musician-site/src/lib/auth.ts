import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "mc_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const MAGIC_LINK_TTL = "10m";
const SESSION_TTL = "7d";

type TokenType = "magic-link" | "session";

function getSecret(): Uint8Array {
  const value = process.env.MAGIC_LINK_SIGNING_SECRET;
  if (!value) {
    throw new Error("MAGIC_LINK_SIGNING_SECRET is not set");
  }
  return new TextEncoder().encode(value);
}

async function signToken(email: string, type: TokenType, ttl: string): Promise<string> {
  return new SignJWT({ email, type })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(getSecret());
}

async function verifyToken(token: string, expected: TokenType): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
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
