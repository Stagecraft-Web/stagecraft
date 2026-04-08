import { describe, it, expect, vi, beforeEach } from "vitest";

describe("oauth", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe("generateState", () => {
    it("returns a 64-character hex string", async () => {
      const { generateState } = await import("../integrations/oauth");
      const state = generateState();
      expect(state).toMatch(/^[a-f0-9]{64}$/);
    });

    it("returns unique values", async () => {
      const { generateState } = await import("../integrations/oauth");
      const a = generateState();
      const b = generateState();
      expect(a).not.toBe(b);
    });
  });

  describe("getNetlifyOAuthUrl", () => {
    it("builds a valid Netlify OAuth URL", async () => {
      vi.stubEnv("NETLIFY_CLIENT_ID", "test-client-id");
      vi.stubEnv("AUTH_URL", "http://localhost:3000");

      const { getNetlifyOAuthUrl } = await import("../integrations/oauth");
      const url = new URL(getNetlifyOAuthUrl("test-state"));

      expect(url.origin).toBe("https://app.netlify.com");
      expect(url.pathname).toBe("/authorize");
      expect(url.searchParams.get("client_id")).toBe("test-client-id");
      expect(url.searchParams.get("redirect_uri")).toBe(
        "http://localhost:3000/api/integrations/netlify/callback"
      );
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("state")).toBe("test-state");
    });

    it("throws when NETLIFY_CLIENT_ID is missing", async () => {
      vi.stubEnv("NETLIFY_CLIENT_ID", "");
      delete process.env.NETLIFY_CLIENT_ID;

      const mod = await import("../integrations/oauth");
      expect(() => mod.getNetlifyOAuthUrl("state")).toThrow(
        "NETLIFY_CLIENT_ID not configured"
      );
    });
  });
});
