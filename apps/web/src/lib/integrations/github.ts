import { prisma } from "@stagecraft/db";

interface CreateRepoOptions {
  userId: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
}

interface CreateRepoResult {
  owner: string;
  name: string;
  fullName: string;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
}

interface PushFileEntry {
  path: string;
  content: string;
}

async function getGitHubToken(userId: string): Promise<string> {
  const integration = await prisma.integrationAccount.findUnique({
    where: { userId_provider: { userId, provider: "github" } },
  });

  if (!integration?.accessToken) {
    throw new Error("GitHub account not connected");
  }

  return integration.accessToken;
}

async function githubApi(token: string, path: string, options?: RequestInit) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${body}`);
  }

  return res.json();
}

export async function getAuthenticatedUser(token: string): Promise<{ login: string; id: number }> {
  return githubApi(token, "/user");
}

export async function createRepo(options: CreateRepoOptions): Promise<CreateRepoResult> {
  const token = await getGitHubToken(options.userId);

  const data = await githubApi(token, "/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name: options.name,
      description: options.description ?? "",
      private: options.isPrivate ?? false,
      auto_init: false,
    }),
  });

  return {
    owner: data.owner.login,
    name: data.name,
    fullName: data.full_name,
    htmlUrl: data.html_url,
    cloneUrl: data.clone_url,
    defaultBranch: data.default_branch,
  };
}

/**
 * Push a set of files to a repo as an initial commit using the Git Data API.
 * Works on empty repos (no existing commits required).
 */
export async function pushFiles(
  userId: string,
  owner: string,
  repo: string,
  files: PushFileEntry[],
  message: string
): Promise<{ commitSha: string }> {
  const token = await getGitHubToken(userId);

  // Create blobs for each file
  const blobs = await Promise.all(
    files.map(async (file) => {
      const blob = await githubApi(token, `/repos/${owner}/${repo}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({
          content: file.content,
          encoding: "utf-8",
        }),
      });
      return { path: file.path, sha: blob.sha, mode: "100644" as const, type: "blob" as const };
    })
  );

  // Create tree
  const tree = await githubApi(token, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ tree: blobs }),
  });

  // Create commit (no parent for initial commit)
  const commit = await githubApi(token, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: tree.sha,
    }),
  });

  // Point main branch to the commit
  try {
    // Try to update existing ref
    await githubApi(token, `/repos/${owner}/${repo}/git/refs/heads/main`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha }),
    });
  } catch {
    // Create ref if it doesn't exist (empty repo)
    await githubApi(token, `/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: "refs/heads/main", sha: commit.sha }),
    });
  }

  return { commitSha: commit.sha };
}

export async function deleteRepo(userId: string, owner: string, repo: string): Promise<void> {
  const token = await getGitHubToken(userId);

  await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
}
