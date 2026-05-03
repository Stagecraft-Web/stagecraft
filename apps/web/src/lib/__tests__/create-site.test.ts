import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { JobContext } from "@stagecraft/queue";

const mockSiteUpdate = vi.fn();
const mockUserFindUnique = vi.fn();
const mockIntegrationFindUnique = vi.fn();

vi.mock("@stagecraft/db", () => ({
  prisma: {
    site: { update: mockSiteUpdate },
    user: { findUnique: mockUserFindUnique },
    integrationAccount: { findUnique: mockIntegrationFindUnique },
  },
}));

const mockCreateRepo = vi.fn();
const mockPushFiles = vi.fn();
vi.mock("@/lib/integrations/github", () => ({
  createRepo: mockCreateRepo,
  pushFiles: mockPushFiles,
}));

const mockCreateNetlifySite = vi.fn();
const mockSetEnvVars = vi.fn();
vi.mock("@/lib/integrations/netlify", () => ({
  createSite: mockCreateNetlifySite,
  setEnvVars: mockSetEnvVars,
}));

const mockReadTemplateFiles = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/template-reader", () => ({
  readTemplateFiles: mockReadTemplateFiles,
  BINARY_EXTENSIONS: new Set(),
  TEMPLATE_SKIP_DIRS: new Set(),
  TEMPLATE_SKIP_FILES: new Set(),
}));

const { handleCreateSite } = await import("../jobs/create-site");

const ORIGINAL_ENV = { ...process.env };

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
    process.env = { ...ORIGINAL_ENV, AUTH_URL: "https://stagecraft.test" };
    mockSiteUpdate.mockResolvedValue({});
    mockIntegrationFindUnique.mockResolvedValue({ accessToken: "token" });
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "artist@example.com" });
    mockSetEnvVars.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
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

    // Netlify site created with Next.js build settings
    expect(mockCreateNetlifySite).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: expect.objectContaining({
          provider: "github",
          repo_path: "jclaw/sarah-chen-music",
          repo_branch: "main",
          cmd: "npm run build",
          dir: ".next",
        }),
      })
    );

    expect(mockSiteUpdate).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: expect.objectContaining({
        githubRepoOwner: "jclaw",
        githubRepoName: "sarah-chen-music",
      }),
    });

    expect(mockSiteUpdate).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: {
        netlifySiteId: "netlify-123",
        productionUrl: "https://sarah-chen-music.netlify.app",
        status: "active",
      },
    });
  });

  it("provisions the new template's runtime env vars on Netlify", async () => {
    mockCreateRepo.mockResolvedValue({
      owner: "jclaw", name: "sarah-chen-music", fullName: "jclaw/sarah-chen-music",
      htmlUrl: "", cloneUrl: "", defaultBranch: "main",
    });
    mockPushFiles.mockResolvedValue({ commitSha: "abc" });
    mockCreateNetlifySite.mockResolvedValue({
      siteId: "netlify-123", siteName: "x", url: "u", adminUrl: "a", sslUrl: "s",
    });

    await handleCreateSite(makeContext());

    expect(mockSetEnvVars).toHaveBeenCalledTimes(1);
    const [envUserId, envSiteId, envVars] = mockSetEnvVars.mock.calls[0];
    expect(envUserId).toBe("user-1");
    expect(envSiteId).toBe("netlify-123");
    expect(envVars).toEqual({
      MAGIC_LINK_SIGNING_SECRET: expect.stringMatching(/^[0-9a-f]{64}$/),
      ADMIN_EMAIL: "artist@example.com",
      STAGECRAFT_PLATFORM_URL: "https://stagecraft.test",
      STAGECRAFT_SITE_ID: "site-1",
    });
  });

  it("strips a trailing slash from AUTH_URL when setting STAGECRAFT_PLATFORM_URL", async () => {
    process.env.AUTH_URL = "https://stagecraft.test/";
    mockCreateRepo.mockResolvedValue({
      owner: "j", name: "n", fullName: "j/n", htmlUrl: "", cloneUrl: "", defaultBranch: "main",
    });
    mockPushFiles.mockResolvedValue({ commitSha: "abc" });
    mockCreateNetlifySite.mockResolvedValue({
      siteId: "netlify-123", siteName: "x", url: "u", adminUrl: "a", sslUrl: "s",
    });

    await handleCreateSite(makeContext());

    const envVars = mockSetEnvVars.mock.calls[0][2];
    expect(envVars.STAGECRAFT_PLATFORM_URL).toBe("https://stagecraft.test");
  });

  it("surfaces a netlifyEnvWarning when env-var provisioning fails (site still active)", async () => {
    mockCreateRepo.mockResolvedValue({
      owner: "j", name: "n", fullName: "j/n", htmlUrl: "", cloneUrl: "", defaultBranch: "main",
    });
    mockPushFiles.mockResolvedValue({ commitSha: "abc" });
    mockCreateNetlifySite.mockResolvedValue({
      siteId: "netlify-123", siteName: "x", url: "u", adminUrl: "a", sslUrl: "s",
    });
    mockSetEnvVars.mockRejectedValueOnce(new Error("Netlify rate limit"));

    const result = await handleCreateSite(makeContext());

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).netlifyEnvWarning).toBe("Netlify rate limit");
    // Site still marked active so the artist can recover by setting env vars manually
    expect(mockSiteUpdate).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: expect.objectContaining({ status: "active" }),
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

  it("marks site as error when the user has no email on file", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: "user-1", email: null });

    const result = await handleCreateSite(makeContext());

    expect(result.success).toBe(false);
    expect(result.message).toContain("email");
    expect(mockCreateRepo).not.toHaveBeenCalled();
    expect(mockSiteUpdate).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: { status: "error" },
    });
  });

  it("marks site as error when AUTH_URL is unset on the platform", async () => {
    delete process.env.AUTH_URL;
    mockCreateRepo.mockResolvedValue({
      owner: "j", name: "n", fullName: "j/n", htmlUrl: "", cloneUrl: "", defaultBranch: "main",
    });
    mockPushFiles.mockResolvedValue({ commitSha: "abc" });
    mockCreateNetlifySite.mockResolvedValue({
      siteId: "netlify-123", siteName: "x", url: "u", adminUrl: "a", sslUrl: "s",
    });

    const result = await handleCreateSite(makeContext());

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).netlifyEnvWarning).toContain("AUTH_URL");
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
