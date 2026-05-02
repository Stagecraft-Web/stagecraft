import { beforeEach, describe, expect, it, vi } from "vitest";

const { listReposMock, mintMock } = vi.hoisted(() => ({
  listReposMock: vi.fn(),
  mintMock: vi.fn(),
}));

vi.mock("@octokit/rest", () => ({
  Octokit: class {
    apps = { listReposAccessibleToInstallation: listReposMock };
  },
}));
vi.mock("../github-app-token", () => ({ mintInstallationToken: mintMock }));

import { listInstallationRepos } from "../github-app-install";

beforeEach(() => {
  listReposMock.mockReset();
  mintMock.mockReset();
  mintMock.mockResolvedValue({ token: "ghs_test", expiresAt: "2099-01-01T00:00:00.000Z" });
});

describe("listInstallationRepos", () => {
  it("returns empty array when installation has no repos", async () => {
    listReposMock.mockResolvedValue({ data: { repositories: [] } });
    expect(await listInstallationRepos(1)).toEqual([]);
  });

  it("maps GitHub repository payloads to { owner, name }", async () => {
    listReposMock.mockResolvedValue({
      data: {
        repositories: [
          { owner: { login: "artist" }, name: "site" },
          { owner: { login: "artist" }, name: "blog" },
        ],
      },
    });
    expect(await listInstallationRepos(1)).toEqual([
      { owner: "artist", name: "site" },
      { owner: "artist", name: "blog" },
    ]);
  });

  it("mints a token with the given installation id", async () => {
    listReposMock.mockResolvedValue({ data: { repositories: [] } });
    await listInstallationRepos(98765);
    expect(mintMock).toHaveBeenCalledWith(98765);
  });

  it("propagates token-mint errors", async () => {
    mintMock.mockRejectedValue(new Error("misconfigured"));
    await expect(listInstallationRepos(1)).rejects.toThrow("misconfigured");
  });

  it("propagates Octokit errors", async () => {
    listReposMock.mockRejectedValue(new Error("403 Forbidden"));
    await expect(listInstallationRepos(1)).rejects.toThrow("403");
  });
});
