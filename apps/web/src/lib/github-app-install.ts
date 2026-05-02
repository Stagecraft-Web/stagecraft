import { Octokit } from "@octokit/rest";

import { mintInstallationToken } from "./github-app-token";

export type InstallationRepo = {
  owner: string;
  name: string;
};

/**
 * List the repositories an installation has access to. Used during the
 * install callback to identify which repo the artist selected.
 *
 * The installation token used for this call is short-lived (~1hr) and
 * scoped to this installation; we discard it after this call.
 */
export async function listInstallationRepos(installationId: number): Promise<InstallationRepo[]> {
  const { token } = await mintInstallationToken(installationId);
  const octokit = new Octokit({ auth: token });

  // Per-installation repo list. Caps at 100; the install screen lets users
  // pick repos, but we expect exactly one in practice.
  const result = await octokit.apps.listReposAccessibleToInstallation({ per_page: 100 });
  return result.data.repositories.map((r) => ({
    owner: r.owner.login,
    name: r.name,
  }));
}
