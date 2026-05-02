import { SignJWT, jwtVerify } from "jose";

const STATE_TTL = "10m";

function getSecret(): Uint8Array {
  const value = process.env.STAGECRAFT_STATE_SIGNING_SECRET;
  if (!value) {
    throw new Error("STAGECRAFT_STATE_SIGNING_SECRET is not set");
  }
  return new TextEncoder().encode(value);
}

export type InstallStatePayload = {
  siteId: string;
  userId: string;
};

/**
 * Sign a short-lived state token to round-trip through GitHub's install
 * flow. Carries the artist's user id and site id so the install callback
 * can verify the user installing matches the user who initiated, and
 * route the installation to the correct Site row.
 *
 * 10-minute TTL — the artist has that long to complete the install
 * before the link expires.
 */
export async function signInstallState(payload: InstallStatePayload): Promise<string> {
  return new SignJWT({ ...payload, type: "install-state" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(STATE_TTL)
    .sign(getSecret());
}

export async function verifyInstallState(token: string): Promise<InstallStatePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.type !== "install-state") return null;
    if (typeof payload.siteId !== "string" || typeof payload.userId !== "string") return null;
    return { siteId: payload.siteId, userId: payload.userId };
  } catch {
    return null;
  }
}
