import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { JobContext } from "@stagecraft/queue";

const mockSiteUpdate = vi.fn();
const mockUserFindUnique = vi.fn();
const mockIntegrationFindUnique = vi.fn();
const mockIntegrationFindMany = vi.fn();

vi.mock("@stagecraft/db", () => ({
  prisma: {
    site: { update: mockSiteUpdate },
    user: { findUnique: mockUserFindUnique },
    integrationAccount: {
      findUnique: mockIntegrationFindUnique,
      findMany: mockIntegrationFindMany,
    },
  },
}));

const mockCreateRepo = vi.fn();
const mockPushFiles = vi.fn();
vi.mock("@/lib/integrations/github", () => ({
  createRepo: mockCreateRepo,
  pushFiles: mockPushFiles,
}));

const mockCreateNetlifySite = vi.fn();
const mockSetNetlifyEnvVars = vi.fn();
vi.mock("@/lib/integrations/netlify", () => ({
  createSite: mockCreateNetlifySite,
  setEnvVars: mockSetNetlifyEnvVars,
}));

const mockCreateVercelProject = vi.fn();
const mockSetVercelEnvVars = vi.fn();
vi.mock("@/lib/integrations/vercel", () => ({
  createProject: mockCreateVercelProject,
  setEnvVars: mockSetVercelEnvVars,
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

const REPO_RESULT = {
  owner: "jclaw",
  name: "sarah-chen-music",
  fullName: "jclaw/sarah-chen-music",
  htmlUrl: "https://github.com/jclaw/sarah-chen-music",
  cloneUrl: "https://github.com/jclaw/sarah-chen-music.git",
  defaultBranch: "main",
};

const NETLIFY_SITE_RESULT = {
  siteId: "netlify-123",
  siteName: "stagecraft-site-sarah-chen-music",
  url: "https://stagecraft-site-sarah-chen-music.netlify.app",
  adminUrl: "https://app.netlify.com/sites/stagecraft-site-sarah-chen-music",
  sslUrl: "https://stagecraft-site-sarah-chen-music.netlify.app",
};

const VERCEL_PROJECT_RESULT = {
  projectId: "prj_abc123",
  projectName: "stagecraft-site-sarah-chen-music",
  teamId: null,
  productionUrl: "https://stagecraft-site-sarah-chen-music.vercel.app",
  adminUrl: "https://vercel.com/stagecraft-site-sarah-chen-music",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV, AUTH_URL: "https://stagecraft.test" };
  mockSiteUpdate.mockResolvedValue({});
  mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "artist@example.com" });
  mockIntegrationFindUnique.mockResolvedValue({ accessToken: "token" });
  // Default: only Netlify connected → Netlify path
  mockIntegrationFindMany.mockResolvedValue([{ provider: "netlify", metadata: null }]);
  mockSetNetlifyEnvVars.mockResolvedValue(undefined);
  mockSetVercelEnvVars.mockResolvedValue(undefined);
  mockCreateRepo.mockResolvedValue(REPO_RESULT);
  mockPushFiles.mockResolvedValue({ commitSha: "abc123" });
  mockCreateNetlifySite.mockResolvedValue(NETLIFY_SITE_RESULT);
  mockCreateVercelProject.mockResolvedValue(VERCEL_PROJECT_RESULT);
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("handleCreateSite — common preconditions", () => {
  it("returns failure for missing payload", async () => {
    const result = await handleCreateSite(makeContext({ requestPayload: {} }));
    expect(result.success).toBe(false);
    expect(result.message).toContain("Missing required payload");
  });

  it("marks site as error when the user has no email on file", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: "user-1", email: null });
    const result = await handleCreateSite(makeContext());
    expect(result.success).toBe(false);
    expect(result.message).toContain("email");
    expect(mockCreateRepo).not.toHaveBeenCalled();
  });

  it("marks site as error when no deploy-target integration is connected", async () => {
    mockIntegrationFindMany.mockResolvedValueOnce([]); // neither netlify nor vercel
    const result = await handleCreateSite(makeContext());
    expect(result.success).toBe(false);
    expect(result.message).toContain("No deploy-target integration");
    expect(mockCreateRepo).not.toHaveBeenCalled();
  });

  it("marks site as error when GitHub repo creation fails", async () => {
    mockCreateRepo.mockRejectedValueOnce(new Error("name already exists"));
    const result = await handleCreateSite(makeContext());
    expect(result.success).toBe(false);
    expect(result.message).toBe("name already exists");
  });
});

describe("handleCreateSite — Netlify path (only Netlify connected)", () => {
  beforeEach(() => {
    mockIntegrationFindMany.mockResolvedValue([{ provider: "netlify", metadata: null }]);
  });

  it("happy path: creates linked Netlify site, persists deployTarget=netlify, marks active", async () => {
    const result = await handleCreateSite(makeContext());

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      deployTarget: "netlify",
      githubUrl: "https://github.com/jclaw/sarah-chen-music",
      netlifySiteId: "netlify-123",
      netlifyAdminUrl: NETLIFY_SITE_RESULT.adminUrl,
    });

    expect(mockCreateNetlifySite).toHaveBeenCalledWith(
      expect.objectContaining({
        repo: expect.objectContaining({
          provider: "github",
          repo_path: "jclaw/sarah-chen-music",
          repo_branch: "main",
          cmd: "npm run build",
          dir: ".next",
        }),
      }),
    );
    expect(mockCreateVercelProject).not.toHaveBeenCalled();

    expect(mockSiteUpdate).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: expect.objectContaining({
        githubRepoOwner: "jclaw",
        githubRepoName: "sarah-chen-music",
        deployTarget: "netlify",
      }),
    });
    expect(mockSiteUpdate).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: expect.objectContaining({
        netlifySiteId: "netlify-123",
        netlifyAdminUrl: NETLIFY_SITE_RESULT.adminUrl,
        productionUrl: NETLIFY_SITE_RESULT.sslUrl,
        status: "active",
      }),
    });
  });

  it("provisions runtime env vars on Netlify (the four artist-site vars)", async () => {
    await handleCreateSite(makeContext());

    expect(mockSetNetlifyEnvVars).toHaveBeenCalledTimes(1);
    const [envUserId, envSiteId, envVars] = mockSetNetlifyEnvVars.mock.calls[0];
    expect(envUserId).toBe("user-1");
    expect(envSiteId).toBe("netlify-123");
    expect(envVars).toEqual({
      MAGIC_LINK_SIGNING_SECRET: expect.stringMatching(/^[0-9a-f]{64}$/),
      ADMIN_EMAIL: "artist@example.com",
      STAGECRAFT_PLATFORM_URL: "https://stagecraft.test",
      STAGECRAFT_SITE_ID: "site-1",
    });
  });

  it("falls back to plain Netlify site when repo linking fails", async () => {
    mockCreateNetlifySite
      .mockRejectedValueOnce(new Error("installation_id required"))
      .mockResolvedValueOnce(NETLIFY_SITE_RESULT);

    const result = await handleCreateSite(makeContext());

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).netlifyLinkUrl).toBe(
      "https://app.netlify.com/projects/stagecraft-site-sarah-chen-music/link",
    );
    expect(mockCreateNetlifySite).toHaveBeenCalledTimes(2);
    expect(mockCreateNetlifySite).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ repo: expect.anything() }),
    );
  });

  it("surfaces envWarning when env-var provisioning fails (site still active)", async () => {
    mockSetNetlifyEnvVars.mockRejectedValueOnce(new Error("Netlify rate limit"));

    const result = await handleCreateSite(makeContext());

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).envWarning).toBe("Netlify rate limit");
    expect(mockSiteUpdate).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: expect.objectContaining({ status: "active" }),
    });
  });

  it("marks site as error when Netlify project creation fails (no fallback recovery)", async () => {
    mockCreateNetlifySite.mockRejectedValue(new Error("Netlify quota exceeded"));

    const result = await handleCreateSite(makeContext());

    expect(result.success).toBe(false);
    expect(result.message).toBe("Netlify quota exceeded");
  });
});

describe("handleCreateSite — Vercel path (Vercel connected)", () => {
  beforeEach(() => {
    mockIntegrationFindMany.mockResolvedValue([{ provider: "vercel", metadata: null }]);
  });

  it("happy path: creates Vercel project with the GitHub repo + nextjs framework", async () => {
    const result = await handleCreateSite(makeContext());

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      deployTarget: "vercel",
      githubUrl: "https://github.com/jclaw/sarah-chen-music",
      vercelProjectId: "prj_abc123",
      vercelProjectName: "stagecraft-site-sarah-chen-music",
      productionUrl: VERCEL_PROJECT_RESULT.productionUrl,
    });
    expect(mockCreateVercelProject).toHaveBeenCalledWith({
      userId: "user-1",
      name: "stagecraft-site-sarah-chen-music",
      teamId: undefined,
      repo: { repo: "jclaw/sarah-chen-music" },
      framework: "nextjs",
    });
    expect(mockCreateNetlifySite).not.toHaveBeenCalled();

    expect(mockSiteUpdate).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: expect.objectContaining({
        deployTarget: "vercel",
      }),
    });
    expect(mockSiteUpdate).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: expect.objectContaining({
        vercelProjectId: "prj_abc123",
        vercelProjectName: "stagecraft-site-sarah-chen-music",
        vercelTeamId: null,
        productionUrl: VERCEL_PROJECT_RESULT.productionUrl,
        status: "active",
      }),
    });
  });

  it("provisions runtime env vars on Vercel using the project id", async () => {
    await handleCreateSite(makeContext());

    expect(mockSetVercelEnvVars).toHaveBeenCalledTimes(1);
    const [args] = mockSetVercelEnvVars.mock.calls[0];
    expect(args.userId).toBe("user-1");
    expect(args.projectId).toBe("prj_abc123");
    expect(args.vars).toEqual({
      MAGIC_LINK_SIGNING_SECRET: expect.stringMatching(/^[0-9a-f]{64}$/),
      ADMIN_EMAIL: "artist@example.com",
      STAGECRAFT_PLATFORM_URL: "https://stagecraft.test",
      STAGECRAFT_SITE_ID: "site-1",
    });
  });

  it("forwards teamId from IntegrationAccount.metadata into both create + setEnvVars", async () => {
    mockIntegrationFindMany.mockResolvedValue([
      { provider: "vercel", metadata: { teamId: "team_xyz" } },
    ]);
    mockIntegrationFindUnique.mockResolvedValue({
      metadata: { teamId: "team_xyz" },
    });
    mockCreateVercelProject.mockResolvedValue({
      ...VERCEL_PROJECT_RESULT,
      teamId: "team_xyz",
    });

    await handleCreateSite(makeContext());

    expect(mockCreateVercelProject).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: "team_xyz" }),
    );
    const [args] = mockSetVercelEnvVars.mock.calls[0];
    expect(args.teamId).toBe("team_xyz");
  });

  it("surfaces envWarning when Vercel env-var provisioning fails (site still active)", async () => {
    mockSetVercelEnvVars.mockRejectedValueOnce(new Error("Vercel rate limit"));

    const result = await handleCreateSite(makeContext());

    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).envWarning).toBe("Vercel rate limit");
    expect(mockSiteUpdate).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: expect.objectContaining({ status: "active" }),
    });
  });

  it("marks site as error when Vercel project creation fails", async () => {
    mockCreateVercelProject.mockRejectedValue(new Error("Vercel name conflict"));

    const result = await handleCreateSite(makeContext());

    expect(result.success).toBe(false);
    expect(result.message).toBe("Vercel name conflict");
  });
});

describe("handleCreateSite — Vercel preferred when both connected", () => {
  it("picks vercel when both vercel and netlify integrations are connected", async () => {
    mockIntegrationFindMany.mockResolvedValue([
      { provider: "netlify", metadata: null },
      { provider: "vercel", metadata: null },
    ]);

    const result = await handleCreateSite(makeContext());

    expect(result.success).toBe(true);
    expect(mockCreateVercelProject).toHaveBeenCalledTimes(1);
    expect(mockCreateNetlifySite).not.toHaveBeenCalled();
    expect((result.data as Record<string, unknown>).deployTarget).toBe("vercel");
  });
});
