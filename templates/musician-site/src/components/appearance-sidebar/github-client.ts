// ============================================================
// GitHub GraphQL client for the Appearance sidebar.
//
// The sidebar uses the same `keystatic-gh-access-token` cookie that
// Keystatic's admin UI sets on sign-in. We don't manage OAuth ourselves —
// Keystatic handles that. We just read the cookie and attach the token to
// our GraphQL requests.
//
// All writes go through GitHub's `createCommitOnBranch` mutation so we can
// target a specific `expectedHeadOid` and avoid clobbering concurrent edits.
// Commit content must be base64-encoded UTF-8 bytes.
// ============================================================

const KEYSTATIC_COOKIE_NAME = "keystatic-gh-access-token";
const GRAPHQL_URL = "https://api.github.com/graphql";

/** Reads the GitHub access token Keystatic stored in a cookie during sign-in.
 *  Non-httpOnly by Keystatic's design; readable from page JS. */
export function getGitHubToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${KEYSTATIC_COOKIE_NAME}=([^;]+)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/** Keystatic refreshes the access token via a same-origin endpoint using
 *  the encrypted httpOnly refresh cookie. We call the same endpoint and then
 *  re-read the cookie. Returns the fresh token or null if refresh failed. */
export async function refreshGitHubToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/keystatic/github/refresh-token", {
      method: "GET",
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    return getGitHubToken();
  } catch {
    return null;
  }
}

interface GraphQLRequest<V extends Record<string, unknown>> {
  query: string;
  variables?: V;
}

async function graphql<T, V extends Record<string, unknown> = Record<string, unknown>>(
  token: string,
  request: GraphQLRequest<V>,
): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (res.status === 401) {
    throw new AuthExpiredError("GitHub token rejected (401)");
  }

  const payload = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };

  if (payload.errors && payload.errors.length > 0) {
    throw new Error(payload.errors.map((e) => e.message).join("; "));
  }
  if (!payload.data) {
    throw new Error("GitHub GraphQL returned no data");
  }
  return payload.data;
}

export class AuthExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthExpiredError";
  }
}

// ----------------------------------------------------------------
// Queries
// ----------------------------------------------------------------

interface RepoInfoResponse {
  repository: {
    defaultBranchRef: { name: string; target: { oid: string } };
    refs: {
      nodes: Array<{ name: string; target: { oid: string } }>;
    };
  } | null;
}

/** Fetch the repo's default branch, its head OID, and a page of other
 *  branches so the sidebar can show a branch selector. */
export async function getRepoInfo(
  token: string,
  owner: string,
  name: string,
): Promise<{
  defaultBranch: string;
  defaultBranchOid: string;
  branches: Array<{ name: string; oid: string }>;
}> {
  const data = await graphql<RepoInfoResponse>(token, {
    query: /* GraphQL */ `
      query RepoInfo($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          defaultBranchRef {
            name
            target { ... on Commit { oid } }
          }
          refs(first: 50, refPrefix: "refs/heads/", orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
            nodes {
              name
              target { ... on Commit { oid } }
            }
          }
        }
      }
    `,
    variables: { owner, name },
  });

  if (!data.repository) {
    throw new Error(`Repository ${owner}/${name} not found or token lacks access.`);
  }
  if (!data.repository.defaultBranchRef) {
    throw new Error(`Repository ${owner}/${name} has no default branch.`);
  }

  return {
    defaultBranch: data.repository.defaultBranchRef.name,
    defaultBranchOid: data.repository.defaultBranchRef.target.oid,
    branches: data.repository.refs.nodes.map((n) => ({ name: n.name, oid: n.target.oid })),
  };
}

interface BranchHeadResponse {
  repository: {
    ref: { target: { oid: string } } | null;
  } | null;
}

/** Look up the current HEAD OID of a specific branch. Needed before each
 *  commit so we can pass `expectedHeadOid` and get proper concurrency control. */
export async function getBranchHeadOid(
  token: string,
  owner: string,
  name: string,
  branch: string,
): Promise<string | null> {
  const data = await graphql<BranchHeadResponse>(token, {
    query: /* GraphQL */ `
      query BranchHead($owner: String!, $name: String!, $qualified: String!) {
        repository(owner: $owner, name: $name) {
          ref(qualifiedName: $qualified) { target { ... on Commit { oid } } }
        }
      }
    `,
    variables: { owner, name, qualified: `refs/heads/${branch}` },
  });
  return data.repository?.ref?.target.oid ?? null;
}

// ----------------------------------------------------------------
// Mutation
// ----------------------------------------------------------------

export interface CommitResult {
  /** URL to the commit on GitHub, suitable for linking to in a toast. */
  commitUrl: string | null;
  /** New HEAD oid of the branch after the commit. */
  newHeadOid: string;
}

interface CreateCommitResponse {
  createCommitOnBranch: {
    commit: { oid: string; url: string };
  };
}

/** Commit a single-file change (add-or-update) to `branch`. Uses
 *  `createCommitOnBranch` with `expectedHeadOid` for concurrency safety. */
export async function commitFile(
  token: string,
  params: {
    repoWithOwner: string;
    branch: string;
    expectedHeadOid: string;
    path: string;
    contents: string;
    message: string;
    description?: string;
  },
): Promise<CommitResult> {
  const data = await graphql<CreateCommitResponse>(token, {
    query: /* GraphQL */ `
      mutation Commit($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) {
          commit { oid url }
        }
      }
    `,
    variables: {
      input: {
        branch: {
          repositoryNameWithOwner: params.repoWithOwner,
          branchName: params.branch,
        },
        expectedHeadOid: params.expectedHeadOid,
        message: {
          headline: params.message,
          ...(params.description ? { body: params.description } : {}),
        },
        fileChanges: {
          additions: [
            {
              path: params.path,
              contents: encodeBase64Utf8(params.contents),
            },
          ],
          deletions: [],
        },
      },
    },
  });

  return {
    commitUrl: data.createCommitOnBranch.commit.url,
    newHeadOid: data.createCommitOnBranch.commit.oid,
  };
}

/** UTF-8-safe base64. `btoa` handles only Latin-1; this handles the whole BMP. */
function encodeBase64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
