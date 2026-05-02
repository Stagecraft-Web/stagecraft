import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildInstallUrl } from "../install-url";
import { verifyInstallState } from "../state-signing";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.STAGECRAFT_STATE_SIGNING_SECRET = "test-state-secret-do-not-use";
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("buildInstallUrl", () => {
  it("returns base URL with a state param that round-trips", async () => {
    process.env.GITHUB_APP_INSTALL_URL = "https://github.com/apps/test-app/installations/new";
    const url = await buildInstallUrl({ siteId: "s1", userId: "u1" });
    const parsed = new URL(url);
    expect(parsed.host).toBe("github.com");
    expect(parsed.pathname).toBe("/apps/test-app/installations/new");
    const state = parsed.searchParams.get("state");
    expect(state).toBeTruthy();
    expect(await verifyInstallState(state!)).toEqual({ siteId: "s1", userId: "u1" });
  });

  it("preserves existing query params on the base URL", async () => {
    process.env.GITHUB_APP_INSTALL_URL = "https://github.com/apps/test-app/installations/new?foo=bar";
    const url = await buildInstallUrl({ siteId: "s1", userId: "u1" });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("foo")).toBe("bar");
    expect(parsed.searchParams.get("state")).toBeTruthy();
  });

  it("throws when GITHUB_APP_INSTALL_URL is not set", async () => {
    delete process.env.GITHUB_APP_INSTALL_URL;
    await expect(buildInstallUrl({ siteId: "s", userId: "u" })).rejects.toThrow(
      "GITHUB_APP_INSTALL_URL",
    );
  });
});
