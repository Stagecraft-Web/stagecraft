import { describe, expect, it, vi, beforeEach } from "vitest";

const getRef = vi.fn();
const getCommit = vi.fn();
const createBlob = vi.fn();
const createTree = vi.fn();
const createCommit = vi.fn();
const updateRef = vi.fn();

vi.mock("@octokit/rest", () => ({
  Octokit: class {
    git = { getRef, getCommit, createBlob, createTree, createCommit, updateRef };
  },
}));

import { commitFiles } from "./git-commit";

beforeEach(() => {
  getRef.mockReset();
  getCommit.mockReset();
  createBlob.mockReset();
  createTree.mockReset();
  createCommit.mockReset();
  updateRef.mockReset();
});

function setupHappyPath() {
  getRef.mockResolvedValue({ data: { object: { sha: "head-sha" } } });
  getCommit.mockResolvedValue({ data: { tree: { sha: "tree-sha" } } });
  createBlob.mockImplementation(({ content }) =>
    Promise.resolve({ data: { sha: `blob-${content.slice(0, 8)}` } }),
  );
  createTree.mockResolvedValue({ data: { sha: "new-tree-sha" } });
  createCommit.mockResolvedValue({ data: { sha: "new-commit-sha" } });
  updateRef.mockResolvedValue({ data: {} });
}

describe("commitFiles", () => {
  it("returns the new commit SHA on success", async () => {
    setupHappyPath();
    const sha = await commitFiles({
      token: "t",
      owner: "o",
      repo: "r",
      branch: "main",
      message: "msg",
      files: [{ path: "a.txt", content: "hello" }],
    });
    expect(sha).toBe("new-commit-sha");
  });

  it("creates one blob per file", async () => {
    setupHappyPath();
    await commitFiles({
      token: "t",
      owner: "o",
      repo: "r",
      branch: "main",
      message: "msg",
      files: [
        { path: "a.txt", content: "alpha" },
        { path: "b.txt", content: "beta" },
        { path: "c.txt", content: "gamma" },
      ],
    });
    expect(createBlob).toHaveBeenCalledTimes(3);
  });

  it("uses base_tree from HEAD's commit, not from arbitrary tree fetch", async () => {
    setupHappyPath();
    await commitFiles({
      token: "t",
      owner: "o",
      repo: "r",
      branch: "main",
      message: "msg",
      files: [{ path: "a.txt", content: "x" }],
    });
    expect(createTree).toHaveBeenCalledWith(
      expect.objectContaining({ base_tree: "tree-sha" }),
    );
  });

  it("propagates author when provided", async () => {
    setupHappyPath();
    await commitFiles({
      token: "t",
      owner: "o",
      repo: "r",
      branch: "main",
      message: "msg",
      files: [{ path: "a.txt", content: "x" }],
      author: { name: "Artist", email: "artist@example.com" },
    });
    expect(createCommit).toHaveBeenCalledWith(
      expect.objectContaining({ author: { name: "Artist", email: "artist@example.com" } }),
    );
  });

  it("updates the ref with the new commit SHA", async () => {
    setupHappyPath();
    await commitFiles({
      token: "t",
      owner: "o",
      repo: "r",
      branch: "main",
      message: "msg",
      files: [{ path: "a.txt", content: "x" }],
    });
    expect(updateRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "heads/main", sha: "new-commit-sha" }),
    );
  });

  it("defaults to utf-8 encoding when not specified", async () => {
    setupHappyPath();
    await commitFiles({
      token: "t", owner: "o", repo: "r", branch: "main", message: "msg",
      files: [{ path: "a.txt", content: "hello" }],
    });
    expect(createBlob).toHaveBeenCalledWith(
      expect.objectContaining({ encoding: "utf-8" }),
    );
  });

  it("forwards base64 encoding when committing binary files", async () => {
    setupHappyPath();
    await commitFiles({
      token: "t", owner: "o", repo: "r", branch: "main", message: "msg",
      files: [
        { path: "img.webp", content: "AAAA", encoding: "base64" },
        { path: "page.json", content: "{}", encoding: "utf-8" },
      ],
    });
    expect(createBlob).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ encoding: "base64", content: "AAAA" }),
    );
    expect(createBlob).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ encoding: "utf-8", content: "{}" }),
    );
  });

  it("includes delete tree entries (sha: null) for deletePaths", async () => {
    setupHappyPath();
    await commitFiles({
      token: "t",
      owner: "o",
      repo: "r",
      branch: "main",
      message: "msg",
      files: [{ path: "src/content/pages/new.json", content: "{}" }],
      deletePaths: ["src/content/pages/old.json"],
    });
    // Blob is created only for the write — deletes have no blob.
    expect(createBlob).toHaveBeenCalledTimes(1);

    const treeArg = createTree.mock.calls[0][0] as { tree: { path: string; sha: string | null }[] };
    expect(treeArg.tree).toHaveLength(2);
    expect(treeArg.tree).toContainEqual(
      expect.objectContaining({ path: "src/content/pages/new.json", sha: expect.any(String) }),
    );
    expect(treeArg.tree).toContainEqual(
      expect.objectContaining({ path: "src/content/pages/old.json", sha: null }),
    );
  });

  it("supports a deletion-only commit (no writes)", async () => {
    setupHappyPath();
    await commitFiles({
      token: "t",
      owner: "o",
      repo: "r",
      branch: "main",
      message: "delete page",
      files: [],
      deletePaths: ["src/content/pages/gone.json"],
    });
    expect(createBlob).not.toHaveBeenCalled();
    expect(createCommit).toHaveBeenCalledTimes(1);
  });

  it("propagates octokit errors", async () => {
    getRef.mockRejectedValue(new Error("404"));
    await expect(
      commitFiles({
        token: "t",
        owner: "o",
        repo: "r",
        branch: "main",
        message: "msg",
        files: [{ path: "a.txt", content: "x" }],
      }),
    ).rejects.toThrow("404");
  });
});
