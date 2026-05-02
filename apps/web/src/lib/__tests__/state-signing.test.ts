import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { signInstallState, verifyInstallState } from "../state-signing";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.STAGECRAFT_STATE_SIGNING_SECRET = "test-state-secret-do-not-use";
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("install state signing", () => {
  it("round-trips siteId and userId", async () => {
    const token = await signInstallState({ siteId: "s1", userId: "u1" });
    expect(await verifyInstallState(token)).toEqual({ siteId: "s1", userId: "u1" });
  });

  it("returns null for malformed tokens", async () => {
    expect(await verifyInstallState("not-a-jwt")).toBeNull();
  });

  it("returns null for tokens signed with a different secret", async () => {
    const token = await signInstallState({ siteId: "s1", userId: "u1" });
    process.env.STAGECRAFT_STATE_SIGNING_SECRET = "different-secret";
    expect(await verifyInstallState(token)).toBeNull();
  });

  it("rejects tokens with the wrong type claim", async () => {
    // A token signed with the same secret but a different `type` should not
    // pass as an install state. Defends against state cross-use if other
    // signed tokens get added later.
    const secret = new TextEncoder().encode(process.env.STAGECRAFT_STATE_SIGNING_SECRET);
    const wrongType = await new SignJWT({ siteId: "s", userId: "u", type: "session" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(secret);
    expect(await verifyInstallState(wrongType)).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const secret = new TextEncoder().encode(process.env.STAGECRAFT_STATE_SIGNING_SECRET);
    const expired = await new SignJWT({ siteId: "s", userId: "u", type: "install-state" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(secret);
    expect(await verifyInstallState(expired)).toBeNull();
  });

  it("rejects tokens missing required claims", async () => {
    const secret = new TextEncoder().encode(process.env.STAGECRAFT_STATE_SIGNING_SECRET);
    const noUser = await new SignJWT({ siteId: "s", type: "install-state" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(secret);
    expect(await verifyInstallState(noUser)).toBeNull();
  });

  it("throws when the signing secret is not configured", async () => {
    delete process.env.STAGECRAFT_STATE_SIGNING_SECRET;
    await expect(signInstallState({ siteId: "s", userId: "u" })).rejects.toThrow(
      "STAGECRAFT_STATE_SIGNING_SECRET",
    );
  });
});
