import { Octokit } from "@octokit/rest";

export type FileToCommit = {
  /** Path relative to the repo root, e.g. "src/content/pages/home.json". */
  path: string;
  /** Content as a UTF-8 string, or as a base64-encoded string for binaries. */
  content: string;
  /**
   * Encoding of `content`. Defaults to "utf-8" for text. Set "base64" when
   * committing binary files (e.g. images), and pass `content` as the
   * base64-encoded payload (e.g. `buffer.toString("base64")`).
   */
  encoding?: "utf-8" | "base64";
};

export type CommitArgs = {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  /** Commit message subject + optional body. */
  message: string;
  files: FileToCommit[];
  /**
   * Paths to delete in the same commit (relative to repo root). Useful for
   * page deletion. Combined with `files` so a single publish can rename
   * (write new + delete old) atomically.
   */
  deletePaths?: string[];
  /** Author appears in `git log`. Defaults to a generic author if omitted. */
  author?: { name: string; email: string };
};

/**
 * Commit one or more files in a single commit using GitHub's Git Data API.
 * Pure function over the Octokit interface — no side effects beyond the API
 * calls. Returns the new commit SHA.
 *
 * The flow: get HEAD ref → get tree → create blobs → create tree →
 * create commit → update ref. See ADR-007 §5 and ADR-008.
 *
 * `deletePaths` items are added as tree entries with `sha: null`, which the
 * GitHub API treats as "remove from tree" relative to `base_tree`.
 */
export async function commitFiles(args: CommitArgs): Promise<string> {
  const octokit = new Octokit({ auth: args.token });
  const { owner, repo, branch } = args;

  const ref = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
  const headSha = ref.data.object.sha;

  const headCommit = await octokit.git.getCommit({ owner, repo, commit_sha: headSha });
  const baseTreeSha = headCommit.data.tree.sha;

  const blobs = await Promise.all(
    args.files.map(async (file) => {
      const blob = await octokit.git.createBlob({
        owner,
        repo,
        content: file.content,
        encoding: file.encoding ?? "utf-8",
      });
      return { path: file.path, sha: blob.data.sha };
    }),
  );

  // GitHub's TS types model the tree entry's `sha` as `string`, but the
  // REST API also accepts `null` to delete. Force-cast at the array level
  // so we can construct a heterogeneous tree without losing the rest of
  // the type-checking.
  type TreeEntry = {
    path: string;
    mode: "100644";
    type: "blob";
    sha: string | null;
  };
  const tree: TreeEntry[] = [
    ...blobs.map((b) => ({ path: b.path, mode: "100644" as const, type: "blob" as const, sha: b.sha })),
    ...(args.deletePaths ?? []).map((p) => ({
      path: p,
      mode: "100644" as const,
      type: "blob" as const,
      sha: null,
    })),
  ];

  // Octokit's TS type for `tree` doesn't model `sha: null` as a deletion,
  // but the REST endpoint accepts it. Cast to bypass the typed property
  // check; runtime behaviour is what we're asserting in git-commit.test.ts.
  const createdTree = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree,
  } as unknown as Parameters<typeof octokit.git.createTree>[0]);

  const commit = await octokit.git.createCommit({
    owner,
    repo,
    message: args.message,
    tree: createdTree.data.sha,
    parents: [headSha],
    author: args.author,
  });

  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commit.data.sha,
  });

  return commit.data.sha;
}
