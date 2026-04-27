import { describe, it, expect, vi, beforeEach } from "vitest";
import type { JobContext } from "@stagecraft/queue";

const mockSiteUpdate = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@stagecraft/db", () => ({
  prisma: {
    site: { update: mockSiteUpdate },
    integrationAccount: { findUnique: mockFindUnique },
  },
}));

const mockCreateRepo = vi.fn();
const mockPushFiles = vi.fn();
vi.mock("@/lib/integrations/github", () => ({
  createRepo: mockCreateRepo,
  pushFiles: mockPushFiles,
}));

const mockCreateNetlifySite = vi.fn();
vi.mock("@/lib/integrations/netlify", () => ({
  createSite: mockCreateNetlifySite,
}));

const mockReadTemplateFiles = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/template-reader", () => ({
  readTemplateFiles: mockReadTemplateFiles,
  BINARY_EXTENSIONS: new Set(),
  TEMPLATE_SKIP_DIRS: new Set(),
  TEMPLATE_SKIP_FILES: new Set(),
}));

const { handleCreateSite } = await import("../jobs/create-site");

function makeContext(overrides = {}): JobContext {
  return {
    job: {
      id: "job-1",
      siteId: "site-1",
      userId: "user-1",
      type: "create_site",
      status: "running",
      requestPayload: { name: "Sarah Chen Music", slug: "sarah-chen-music", blueprintType: "solo-artist" },
      resultPayload: null,
      errorMessage: null,
      failureCategory: null,
      repairAttempts: 0,
      startedAt: new Date(),
      completedAt: null,
      createdAt: new Date(),
      ...overrides,
    },
  };
}

describe("handleCreateSite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSiteUpdate.mockResolvedValue({});
    mockFindUnique.mockResolvedValue({ accessToken: "token" });
  });

  it("creates repo, pushes files, creates linked Netlify site, and marks site active", async () => {
    mockCreateRepo.mockResolvedValue({
      owner: "jclaw",
      name: "sarah-chen-music",
      fullName: "jclaw/sarah-chen-music",
      htmlUrl: "https://github.com/jclaw/sarah-chen-music",
      cloneUrl: "https://github.com/jclaw/sarah-chen-music.git",
      defaultBranch: "main",
    });
    mockPushFiles.mockResolvedValue({ commitSha: "abc123" });
    mockCreateNetlifySite.mockResolvedValue({
      siteId: "netlify-123",
      siteName: "sarah-chen-music",
      url: "https://sarah-chen-music.netlify.app",
      adminUrl: "https://app.netlify.com/sites/sarah-chen-music",
      sslUrl: "https://sarah-chen-music.netlify.app",
    });

    const result = await handleCreateSite(makeContext());

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      githubUrl: "https://github.com/jclaw/sarah-chen-music",
      netlifyAdminUrl: "https://app.netlify.com/sites/sarah-chen-music",
      netlifySiteId: "netlify-123",
    });

    // Netlify site created with repo linking
    expect(mockCreateNetlifySite).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: expect.objectContaining({
          provider: "github",
          repo_path: "jclaw/sarah-chen-music",
          repo_branch: "main",
        }),
      })
    );

    // Updated site with GitHub info
    expect(mockSiteUpdate).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: expect.objectContaining({
        githubRepoOwner: "jclaw",
        githubRepoName: "sarah-chen-music",
      }),
    });

    // Updated site with Netlify info and active status (no netlifyAdminUrl — not in schema)
    expect(mockSiteUpdate).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: {
        netlifySiteId: "netlify-123",
        productionUrl: "https://sarah-chen-music.netlify.app",
        status: "active",
      },
    });
  });

  it("falls back to a plain Netlify site when repo linking fails and returns netlifyLinkUrl", async () => {
    mockCreateRepo.mockResolvedValue({
      owner: "jclaw",
      name: "sarah-chen-music",
      fullName: "jclaw/sarah-chen-music",
      htmlUrl: "https://github.com/jclaw/sarah-chen-music",
      cloneUrl: "https://github.com/jclaw/sarah-chen-music.git",
      defaultBranch: "main",
    });
    mockPushFiles.mockResolvedValue({ commitSha: "abc123" });
    // First call (with repo) fails; second (plain) succeeds
    mockCreateNetlifySite
      .mockRejectedValueOnce(new Error("installation_id required"))
      .mockResolvedValueOnce({
        siteId: "netlify-123",
        siteName: "stagecraft-site-sarah-chen-music",
        url: "https://stagecraft-site-sarah-chen-music.netlify.app",
        adminUrl: "https://app.netlify.com/sites/stagecraft-site-sarah-chen-music",
        sslUrl: "https://stagecraft-site-sarah-chen-music.netlify.app",
      });

    const result = await handleCreateSite(makeContext());

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).netlifyLinkUrl).toBe(
      "https://app.netlify.com/projects/stagecraft-site-sarah-chen-music/link"
    );
    // Fallback call was plain (no repo)
    expect(mockCreateNetlifySite).toHaveBeenCalledTimes(2);
    expect(mockCreateNetlifySite).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ repo: expect.anything() })
    );
  });

  it("returns failure for missing payload", async () => {
    const ctx = makeContext({ requestPayload: {} });
    const result = await handleCreateSite(ctx);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Missing required payload");
  });

  it("marks site as error when GitHub repo creation fails", async () => {
    mockCreateRepo.mockRejectedValue(new Error("name already exists"));

    const result = await handleCreateSite(makeContext());

    expect(result.success).toBe(false);
    expect(result.message).toBe("name already exists");

    expect(mockSiteUpdate).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: { status: "error" },
    });
  });

  it("marks site as error when Netlify fails", async () => {
    mockCreateRepo.mockResolvedValue({
      owner: "jclaw", name: "test", fullName: "jclaw/test",
      htmlUrl: "", cloneUrl: "", defaultBranch: "main",
    });
    mockPushFiles.mockResolvedValue({ commitSha: "abc" });
    mockCreateNetlifySite.mockRejectedValue(new Error("Netlify quota exceeded"));

    const result = await handleCreateSite(makeContext());

    expect(result.success).toBe(false);
    expect(result.message).toBe("Netlify quota exceeded");
    expect(mockSiteUpdate).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: { status: "error" },
    });
  });
});
