import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.fn();
const mockFetch = vi.fn();

vi.mock("@stagecraft/db", () => ({
  prisma: {
    integrationAccount: { findUnique: mockFindUnique },
  },
}));

vi.stubGlobal("fetch", mockFetch);

const { createSite, setEnvVars } = await import("../integrations/netlify");

describe("Netlify integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({ accessToken: "netlify-token-123" });
  });

  describe("createSite", () => {
    it("creates a site linked to a GitHub repo", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "netlify-site-id",
          name: "my-site",
          url: "https://my-site.netlify.app",
          admin_url: "https://app.netlify.com/sites/my-site",
          ssl_url: "https://my-site.netlify.app",
        }),
      });

      const result = await createSite({
        userId: "user-1",
        name: "my-site",
        repoOwner: "jclaw",
        repoName: "my-site",
      });

      expect(result).toEqual({
        siteId: "netlify-site-id",
        siteName: "my-site",
        url: "https://my-site.netlify.app",
        adminUrl: "https://app.netlify.com/sites/my-site",
        sslUrl: "https://my-site.netlify.app",
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.repo.repo).toBe("jclaw/my-site");
      expect(body.repo.cmd).toBe("npm run build");
    });

    it("throws when Netlify account is not connected", async () => {
      mockFindUnique.mockResolvedValueOnce(null);

      await expect(
        createSite({ userId: "user-1", name: "test", repoOwner: "x", repoName: "y" })
      ).rejects.toThrow("Netlify account not connected");
    });
  });

  describe("setEnvVars", () => {
    it("posts environment variables for a site", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await setEnvVars("user-1", "site-id", {
        CONTACT_EMAIL: "test@example.com",
        RESEND_API_KEY: "re_123",
      });

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain("/accounts/me/env?site_id=site-id");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toHaveLength(2);
      expect(body[0].key).toBe("CONTACT_EMAIL");
    });
  });
});
