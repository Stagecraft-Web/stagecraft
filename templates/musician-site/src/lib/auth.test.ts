import { beforeEach, describe, expect, it } from "vitest";

import {
  createMagicLinkToken,
  createSessionToken,
  verifyMagicLinkToken,
  verifySessionToken,
} from "./auth";

beforeEach(() => {
  process.env.MAGIC_LINK_SIGNING_SECRET = "test-secret-do-not-use-in-prod";
});

describe("auth tokens", () => {
  it("magic-link token round-trips", async () => {
    const token = await createMagicLinkToken("user@example.com");
    expect(await verifyMagicLinkToken(token)).toEqual({ email: "user@example.com" });
  });

  it("session token round-trips", async () => {
    const token = await createSessionToken("user@example.com");
    expect(await verifySessionToken(token)).toEqual({ email: "user@example.com" });
  });

  it("session tokens cannot pass as magic-link tokens", async () => {
    const token = await createSessionToken("user@example.com");
    expect(await verifyMagicLinkToken(token)).toBeNull();
  });

  it("magic-link tokens cannot pass as session tokens", async () => {
    const token = await createMagicLinkToken("user@example.com");
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("malformed tokens return null", async () => {
    expect(await verifyMagicLinkToken("not-a-jwt")).toBeNull();
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
  });

  it("tokens signed with a different secret are rejected", async () => {
    const token = await createSessionToken("user@example.com");
    process.env.MAGIC_LINK_SIGNING_SECRET = "different-secret";
    expect(await verifySessionToken(token)).toBeNull();
  });
});
