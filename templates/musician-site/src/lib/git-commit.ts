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

  const tree = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: blobs.map((b) => ({ path: b.path, mode: "100644", type: "blob", sha: b.sha })),
  });

  const commit = await octokit.git.createCommit({
    owner,
    repo,
    message: args.message,
    tree: tree.data.sha,
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
