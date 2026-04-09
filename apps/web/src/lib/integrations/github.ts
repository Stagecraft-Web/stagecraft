import { prisma } from "@stagecraft/db";

interface CreateRepoOptions {
  userId: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
}

interface CreateRepoResult {
  id: number;
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
      auto_init: true,
    }),
  });

  return {
    id: data.id,
    owner: data.owner.login,
    name: data.name,
    fullName: data.full_name,
    htmlUrl: data.html_url,
    cloneUrl: data.clone_url,
    defaultBranch: data.default_branch,
  };
}

/**
 * Push a set of files to a repo using the Git Data API.
 * Fetches the current HEAD (from auto_init) and uses it as the parent commit.
 */
export async function pushFiles(
  userId: string,
  owner: string,
  repo: string,
  branch: string,
  files: PushFileEntry[],
  message: string
): Promise<{ commitSha: string }> {
  const token = await getGitHubToken(userId);

  // Get current HEAD commit SHA — retry because GitHub may still be
  // processing the auto_init commit right after repo creation.
  let parentSha: string;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const ref = await githubApi(token, `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
      parentSha = ref.object.sha;
      break;
    } catch {
      if (attempt === 4) throw new Error(`Timed out waiting for initial commit on ${branch}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

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

  // Create commit with parent
  const commit = await githubApi(token, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [parentSha!],
    }),
  });

  // Update branch ref
  await githubApi(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha }),
  });

  return { commitSha: commit.sha };
}

/**
 * Grant a GitHub App installation (e.g. Netlify) access to a specific repo.
 * Finds the installation by app slug, then adds the repo to it.
 */
export async function grantAppAccess(
  userId: string,
  repoId: number,
  appSlug: string
): Promise<void> {
  const token = await getGitHubToken(userId);

  // List all GitHub App installations on the user's account
  const data = await githubApi(token, "/user/installations");
  const installation = data.installations?.find(
    (inst: { app_slug: string }) => inst.app_slug === appSlug
  );

  if (!installation) {
    throw new Error(`GitHub App "${appSlug}" is not installed. Install it from the app's GitHub page.`);
  }

  // Add the repo to the installation's accessible repos
  await githubApi(token, `/user/installations/${installation.id}/repositories/${repoId}`, {
    method: "PUT",
  });
}

export async function setRepoArchived(
  userId: string,
  owner: string,
  repo: string,
  archived: boolean
): Promise<void> {
  const token = await getGitHubToken(userId);

  await githubApi(token, `/repos/${owner}/${repo}`, {
    method: "PATCH",
    body: JSON.stringify({ archived }),
  });
}

export async function deleteRepo(userId: string, owner: string, repo: string): Promise<void> {
  const token = await getGitHubToken(userId);

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  // 404 is fine — repo may already be deleted
  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(`Failed to delete GitHub repo (${res.status}): ${body}`);
  }
}
