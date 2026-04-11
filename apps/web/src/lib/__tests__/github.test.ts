import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.fn();
const mockFetch = vi.fn();

vi.mock("@stagecraft/db", () => ({
  prisma: {
    integrationAccount: { findUnique: mockFindUnique },
  },
}));

vi.stubGlobal("fetch", mockFetch);

const { createRepo, pushFiles, getAuthenticatedUser } = await import("../integrations/github");

describe("GitHub integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({ accessToken: "gh-token-123" });
  });

  describe("getAuthenticatedUser", () => {
    it("returns the authenticated user", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ login: "jclaw", id: 12345 }),
      });

      const user = await getAuthenticatedUser("gh-token-123");
      expect(user).toEqual({ login: "jclaw", id: 12345 });
    });
  });

  describe("createRepo", () => {
    it("creates a repo and returns structured result", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          owner: { login: "jclaw" },
          name: "my-site",
          full_name: "jclaw/my-site",
          html_url: "https://github.com/jclaw/my-site",
          clone_url: "https://github.com/jclaw/my-site.git",
          default_branch: "main",
        }),
      });

      const result = await createRepo({
        userId: "user-1",
        name: "my-site",
        description: "Test site",
      });

      expect(result).toEqual({
        owner: "jclaw",
        name: "my-site",
        fullName: "jclaw/my-site",
        htmlUrl: "https://github.com/jclaw/my-site",
        cloneUrl: "https://github.com/jclaw/my-site.git",
        defaultBranch: "main",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/user/repos",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("throws when GitHub account is not connected", async () => {
      mockFindUnique.mockResolvedValueOnce(null);

      await expect(
        createRepo({ userId: "user-1", name: "test" })
      ).rejects.toThrow("GitHub account not connected");
    });

    it("throws on GitHub API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: async () => '{"message":"name already exists"}',
      });

      await expect(
        createRepo({ userId: "user-1", name: "existing-repo" })
      ).rejects.toThrow("GitHub API error (422)");
    });
  });

  describe("pushFiles", () => {
    function mockPushSequence() {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ object: { sha: "parent-sha" } }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sha: "blob-sha-1" }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sha: "tree-sha-1" }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sha: "commit-sha-1" }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });
    }

    it("creates blobs, tree, commit, and ref", async () => {
      mockPushSequence();

      const result = await pushFiles(
        "user-1",
        "jclaw",
        "my-site",
        "main",
        [{ path: "README.md", content: "# Hello" }],
        "Initial commit"
      );

      expect(result).toEqual({ commitSha: "commit-sha-1" });
      // ref lookup + blob + tree + commit + ref update
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it("sends base64 encoding when specified", async () => {
      mockPushSequence();

      await pushFiles(
        "user-1",
        "jclaw",
        "my-site",
        "main",
        [{ path: "src/assets/images/photo.jpg", content: "abc123", encoding: "base64" }],
        "Add image"
      );

      // The blob creation call should include encoding: "base64"
      const blobCall = mockFetch.mock.calls.find((call: unknown[]) =>
        (call[0] as string).includes("/git/blobs")
      );
      expect(blobCall).toBeDefined();
      const blobBody = JSON.parse(blobCall![1].body as string);
      expect(blobBody.encoding).toBe("base64");
      expect(blobBody.content).toBe("abc123");
    });

    it("defaults to utf-8 encoding when not specified", async () => {
      mockPushSequence();

      await pushFiles(
        "user-1",
        "jclaw",
        "my-site",
        "main",
        [{ path: "README.md", content: "# Hello" }],
        "Add readme"
      );

      const blobCall = mockFetch.mock.calls.find((call: unknown[]) =>
        (call[0] as string).includes("/git/blobs")
      );
      const blobBody = JSON.parse(blobCall![1].body as string);
      expect(blobBody.encoding).toBe("utf-8");
    });
  });
});
