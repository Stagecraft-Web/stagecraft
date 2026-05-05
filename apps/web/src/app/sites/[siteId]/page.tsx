"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/Button";
import AssetManager from "@/components/AssetManager";
import Input from "@/components/Input";

type SiteStatus = "creating" | "active" | "error" | "deploy_failed" | "archived";
type JobType = "create_site" | "edit_site" | "migrate_site" | "repair_site" | "deploy_config";
type JobStatus = "queued" | "running" | "completed" | "failed" | "awaiting_review" | "canceled";

interface MigrationReportItem {
  label: string;
  status: "imported" | "partial" | "skipped" | "manual_review";
  detail: string;
}

interface MigrationReport {
  summary: string[];
  overallConfidence: number;
  importedItems: MigrationReportItem[];
  manualReviewItems: MigrationReportItem[];
  skippedItems: MigrationReportItem[];
  pagesCrawled: number;
  pagesMapped: number;
  imagesFound: number;
  embedsFound: number;
  socialLinksFound: number;
}

interface MigrateJobResult {
  sourceUrl?: string;
  pagesCrawled?: number;
  pagesMapped?: number;
  overallConfidence?: number;
  report?: MigrationReport;
}

interface SiteJob {
  id: string;
  type: JobType;
  status: JobStatus;
  errorMessage?: string;
  resultPayload?: MigrateJobResult;
  createdAt: string;
  completedAt?: string;
}

interface Site {
  id: string;
  name: string;
  slug: string;
  status: SiteStatus;
  blueprintType: string;
  githubRepoOwner?: string;
  githubRepoName?: string;
  githubInstallationId?: number | null;
  githubAppSuspended?: boolean;
  /** "netlify" | "vercel" — which provider hosts this site. */
  deployTarget?: string;
  netlifySiteId?: string;
  netlifyAdminUrl?: string;
  vercelProjectId?: string;
  vercelProjectName?: string;
  vercelTeamId?: string;
  vercelTeamSlug?: string;
  productionUrl?: string;
  archivedAt?: string;
  jobs: SiteJob[];
}

type DeployState = "queued" | "building" | "ready" | "error" | "unknown";

interface DeployStatus {
  id: string | null;
  state: DeployState;
  url: string | null;
  errorMessage?: string | null;
  createdAt: string | null;
}

export default function SiteDetailPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [deploy, setDeploy] = useState<DeployStatus | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchSite() {
      try {
        const res = await fetch(`/api/sites/${siteId}`);
        if (!res.ok) {
          setError("Site not found");
          setIsLoading(false);
          return;
        }
        const data = await res.json();
        if (active) {
          setSite(data.site);
          setIsLoading(false);
        }
      } catch {
        if (active) {
          setError("Failed to load site");
          setIsLoading(false);
        }
      }
    }

    fetchSite();

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/sites/${siteId}`);
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setSite(data.site);
            if (data.site.status !== "creating") {
              clearInterval(interval);
            }
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [siteId]);

  // Poll the deploy target (Vercel/Netlify) for first-build status. Runs
  // only once Site.status flips to "active" (the deploy project exists)
  // and stops once the build is "ready" or "error" — after that the URL
  // either works or the artist has actionable info.
  useEffect(() => {
    if (!site || site.status !== "active") return;
    if (deploy?.state === "ready" || deploy?.state === "error") return;

    let active = true;
    async function fetchDeploy() {
      try {
        const res = await fetch(`/api/sites/${siteId}/deploy-status`);
        if (!res.ok) return;
        const data = (await res.json()) as { deploy?: DeployStatus };
        if (active && data.deploy) setDeploy(data.deploy);
      } catch {
        // Transient errors don't block the UI; the next tick retries.
      }
    }
    fetchDeploy();
    const id = setInterval(fetchDeploy, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [siteId, site, deploy?.state]);

  if (isLoading) {
    return (
      <main style={{ maxWidth: "var(--max-width-narrow)", margin: "2.5rem auto", fontFamily: "var(--font-body)" }}>
        <p>Loading...</p>
      </main>
    );
  }

  if (error || !site) {
    return (
      <main style={{ maxWidth: "var(--max-width-narrow)", margin: "2.5rem auto", fontFamily: "var(--font-body)" }}>
        <h1>Error</h1>
        <p>{error || "Site not found"}</p>
        <a href="/dashboard">&larr; Dashboard</a>
      </main>
    );
  }

  async function handleArchiveToggle() {
    const action = site!.status === "archived" ? "unarchive" : "archive";
    if (action === "archive" && !confirm(`Archive "${site!.name}"? The GitHub repo will become read-only.`)) return;
    setIsArchiving(true);
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        setSite((prev) => prev ? { ...prev, status: data.site.status, archivedAt: action === "archive" ? new Date().toISOString() : undefined } : prev);
      } else {
        const data = await res.json();
        setError(data.error || `Failed to ${action} site`);
      }
    } catch {
      setError(`Failed to ${action} site`);
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleConnectGithubApp() {
    setIsConnecting(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/install-url`);
      const data = (await res.json()) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || "Could not start install flow");
    } catch {
      setError("Could not start install flow");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDelete() {
    if (deleteConfirmName !== site!.name) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/sites/${siteId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        if (data.errors?.length) {
          alert(`Site deleted, but some cleanup failed:\n${data.errors.join("\n")}`);
        }
        window.location.href = "/dashboard";
      } else {
        setError(data.error || "Failed to delete site");
        setIsDeleting(false);
      }
    } catch {
      setError("Failed to delete site");
      setIsDeleting(false);
    }
  }

  const latestJob = site.jobs[0];
  const isCreating = site.status === "creating";
  const isError = site.status === "error" || site.status === "deploy_failed";
  const isArchived = site.status === "archived";
  const isActive = site.status === "active";

  const migrationJob = site.jobs.find((j) => j.type === "migrate_site" && j.status === "completed");
  const migrationReport = migrationJob?.resultPayload?.report ?? null;
  const githubUrl = site.githubRepoOwner && site.githubRepoName
    ? `https://github.com/${site.githubRepoOwner}/${site.githubRepoName}`
    : null;
  const needsRepoLink = site.status === "active" && site.netlifyAdminUrl && !site.productionUrl;
  const netlifyLinkRepoUrl = site.netlifyAdminUrl
    ? `${site.netlifyAdminUrl}/configuration/deploys#content`
    : null;

  // Treat the first-build state the same as platform-side "creating":
  // until the deploy target says "ready", the production URL won't
  // render anything useful and the success banner would be misleading.
  const isBuilding = isActive && (deploy?.state === "queued" || deploy?.state === "building" || (deploy === null && site.productionUrl));
  const isDeployError = isActive && deploy?.state === "error";
  const isReady = isActive && deploy?.state === "ready";

  const statusBg = isCreating || isBuilding
    ? "var(--color-warning-bg)"
    : isError || isDeployError
    ? "var(--color-error-bg)"
    : isArchived
    ? "var(--color-neutral-bg)"
    : "var(--color-success-bg)";

  return (
    <main style={{ maxWidth: "var(--max-width-narrow)", margin: "2.5rem auto", fontFamily: "var(--font-body)" }}>
      <p><a href="/dashboard">&larr; Dashboard</a></p>

      <h1>{site.name}</h1>

      <div style={{ padding: "0.75rem", background: statusBg, borderRadius: "var(--radius-sm)", marginBottom: "1rem" }}>
        {isCreating && latestJob?.type === "migrate_site" && "Migrating your site\u2026 Crawling pages and building your repo. This may take a minute."}
        {isCreating && latestJob?.type !== "migrate_site" && "Setting up your site\u2026 This may take a few minutes."}
        {site.status === "error" && `Something went wrong: ${latestJob?.errorMessage ?? "Unknown error"}`}
        {isBuilding && (deploy?.state === "queued" ? "First build queued\u2026 it'll start in a few seconds." : "Building your site\u2026 1\u20133 minutes for the first deploy.")}
        {isDeployError && `First deploy failed${deploy?.errorMessage ? `: ${deploy.errorMessage}` : "."} Check the deploy logs.`}
        {isReady && !needsRepoLink && "Your site is live!"}
        {isArchived && "This site is archived. The GitHub repo is read-only."}
        {(isCreating || isBuilding) && (
          <div style={{ marginTop: "0.5rem" }}>
            <FirstDeployProgressBar />
          </div>
        )}
      </div>

      {/* GitHub App publishing — connect / suspended states */}
      {!isArchived && !site.githubInstallationId && (
        <div style={{
          padding: "1rem",
          background: "var(--color-info-bg)",
          border: `1px solid var(--color-info-border)`,
          borderRadius: "var(--radius-sm)",
          marginBottom: "1rem",
        }}>
          <strong>Connect your GitHub App for publishing</strong>
          <p style={{ margin: "0.5rem 0 0.75rem", fontSize: "var(--font-size-sm)", color: "var(--color-text-faint)" }}>
            Install the Stagecraft GitHub App on this site&rsquo;s repo so the editor can publish edits as commits. You&rsquo;ll see your broker secret once after install &mdash; copy it to your site&rsquo;s deployment env vars.
          </p>
          <Button onClick={handleConnectGithubApp} isDisabled={isConnecting} size="sm">
            {isConnecting ? "Starting install…" : "Connect GitHub App"}
          </Button>
        </div>
      )}

      {site.githubInstallationId && site.githubAppSuspended && (
        <div style={{
          padding: "1rem",
          background: "var(--color-warning-bg)",
          border: `1px solid var(--color-warning-border)`,
          borderRadius: "var(--radius-sm)",
          marginBottom: "1rem",
        }}>
          <strong>GitHub App is suspended</strong>
          <p style={{ margin: "0.5rem 0 0", fontSize: "var(--font-size-sm)", color: "var(--color-text-faint)" }}>
            Publishing is paused until the App is unsuspended on GitHub.
          </p>
        </div>
      )}

      {needsRepoLink && netlifyLinkRepoUrl && (
        <div style={{
          padding: "1rem",
          background: "var(--color-info-bg)",
          border: `1px solid var(--color-info-border)`,
          borderRadius: "var(--radius-sm)",
          marginBottom: "1rem",
        }}>
          <strong>Next step: connect your GitHub repo to Netlify</strong>
          <p style={{ margin: "0.5rem 0 0.75rem", fontSize: "var(--font-size-sm)", color: "var(--color-text-faint)" }}>
            Your GitHub repo and Netlify site are created. Link them to enable auto-deploys on push.
          </p>
          <Button href={netlifyLinkRepoUrl} target="_blank" rel="noopener noreferrer" size="sm">
            Connect repo in Netlify &rarr;
          </Button>
        </div>
      )}

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Details</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ padding: "0.5rem", fontWeight: "var(--font-weight-semibold)" }}>Status</td>
              <td style={{ padding: "0.5rem" }}>{site.status}</td>
            </tr>
            {githubUrl && (
              <tr>
                <td style={{ padding: "0.5rem", fontWeight: "var(--font-weight-semibold)" }}>GitHub</td>
                <td style={{ padding: "0.5rem" }}>
                  <a href={githubUrl} target="_blank" rel="noopener noreferrer">{githubUrl}</a>
                </td>
              </tr>
            )}
            <tr>
              <td style={{ padding: "0.5rem", fontWeight: "var(--font-weight-semibold)" }}>GitHub App</td>
              <td style={{ padding: "0.5rem" }}>
                {site.githubInstallationId
                  ? site.githubAppSuspended
                    ? <span style={{ color: "var(--color-warning)" }}>installed (suspended)</span>
                    : <span style={{ color: "var(--color-success)" }}>installed</span>
                  : <span style={{ color: "var(--color-text-muted)" }}>not connected</span>}
              </td>
            </tr>
            {site.netlifyAdminUrl && (
              <tr>
                <td style={{ padding: "0.5rem", fontWeight: "var(--font-weight-semibold)" }}>Netlify</td>
                <td style={{ padding: "0.5rem" }}>
                  <a href={site.netlifyAdminUrl} target="_blank" rel="noopener noreferrer">Site settings</a>
                </td>
              </tr>
            )}
            {site.vercelProjectName && (
              <tr>
                <td style={{ padding: "0.5rem", fontWeight: "var(--font-weight-semibold)" }}>Vercel</td>
                <td style={{ padding: "0.5rem" }}>
                  <a
                    href={
                      site.vercelTeamSlug
                        ? `https://vercel.com/${site.vercelTeamSlug}/${site.vercelProjectName}`
                        : `https://vercel.com/${site.vercelProjectName}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Project settings
                  </a>
                </td>
              </tr>
            )}
            {site.productionUrl && (
              <tr>
                <td style={{ padding: "0.5rem", fontWeight: "var(--font-weight-semibold)" }}>Production URL</td>
                <td style={{ padding: "0.5rem" }}>
                  {isReady ? (
                    <a href={site.productionUrl} target="_blank" rel="noopener noreferrer">{site.productionUrl}</a>
                  ) : (
                    <span style={{ color: "var(--color-text-faint)" }}>
                      {site.productionUrl} <em>(available once the first build finishes)</em>
                    </span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {migrationReport && (
        <section style={{ marginTop: "2rem" }}>
          <h2>Migration Report</h2>

          <ul style={{ paddingLeft: "1.25rem", margin: "0 0 1rem" }}>
            {migrationReport.summary.map((line, i) => (
              <li key={i} style={{ fontSize: "var(--font-size-sm)", marginBottom: "0.25rem" }}>{line}</li>
            ))}
          </ul>

          <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginBottom: "1rem" }}>
            Overall import confidence: <strong>{Math.round(migrationReport.overallConfidence * 100)}%</strong>
            {" "}&mdash; higher means more content was accurately mapped.
          </p>

          {migrationReport.importedItems.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "var(--font-size-sm)", marginBottom: "0.5rem", color: "var(--color-success)" }}>
                Imported
              </h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {migrationReport.importedItems.map((item, i) => (
                  <li key={i} style={{ padding: "0.5rem", border: `1px solid var(--color-border)`, borderRadius: "var(--radius-sm)", marginBottom: "0.375rem" }}>
                    <strong style={{ fontSize: "var(--font-size-sm)" }}>{item.label}</strong>
                    <p style={{ margin: "0.125rem 0 0", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{item.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {migrationReport.manualReviewItems.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "var(--font-size-sm)", marginBottom: "0.5rem", color: "var(--color-warning)" }}>
                Needs your attention
              </h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {migrationReport.manualReviewItems.map((item, i) => (
                  <li key={i} style={{ padding: "0.5rem", border: `1px solid var(--color-border)`, borderRadius: "var(--radius-sm)", marginBottom: "0.375rem" }}>
                    <strong style={{ fontSize: "var(--font-size-sm)" }}>{item.label}</strong>
                    <p style={{ margin: "0.125rem 0 0", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{item.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {migrationReport.skippedItems.length > 0 && (
            <div>
              <h3 style={{ fontSize: "var(--font-size-sm)", marginBottom: "0.5rem", color: "var(--color-text-muted)" }}>
                Not imported
              </h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {migrationReport.skippedItems.map((item, i) => (
                  <li key={i} style={{ padding: "0.5rem", border: `1px solid var(--color-border)`, borderRadius: "var(--radius-sm)", marginBottom: "0.375rem" }}>
                    <strong style={{ fontSize: "var(--font-size-sm)" }}>{item.label}</strong>
                    <p style={{ margin: "0.125rem 0 0", fontSize: "var(--font-size-xs)", color: "var(--color-text-faint)" }}>{item.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {isActive && <AssetManager siteId={siteId} />}

      {site.jobs.length > 0 && (
        <section style={{ marginTop: "1.5rem" }}>
          <h2>Jobs</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {site.jobs.map((job) => (
              <li key={job.id} style={{ padding: "0.75rem", border: `1px solid var(--color-border)`, borderRadius: "var(--radius-lg)", marginBottom: "0.5rem" }}>
                <strong>{job.type}</strong>
                <span style={{ marginLeft: "0.5rem", color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>{job.status}</span>
                {job.errorMessage && (
                  <p style={{ color: "var(--color-error)", fontSize: "var(--font-size-sm)", margin: "0.25rem 0 0" }}>{job.errorMessage}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(site.status === "active" || isArchived) && (
        <section style={{ marginTop: "2rem" }}>
          <Button
            variant={isArchived ? "primary" : "muted"}
            onClick={handleArchiveToggle}
            isDisabled={isArchiving}
          >
            {isArchiving
              ? (isArchived ? "Unarchiving..." : "Archiving...")
              : (isArchived ? "Unarchive Site" : "Archive Site")}
          </Button>
          {!isArchived && (
            <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "0.375rem" }}>
              Archiving makes the GitHub repo read-only. You can unarchive later.
            </p>
          )}
        </section>
      )}

      <section style={{ marginTop: "3rem", borderTop: `1px solid var(--color-border)`, paddingTop: "1.5rem" }}>
        <h2 style={{ color: "var(--color-error)" }}>Danger Zone</h2>
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
          Permanently delete this site, its GitHub repository, and Netlify deployment. This cannot be undone.
        </p>
        <div style={{ maxWidth: "18.75rem" }}>
          <Input
            id="delete-confirm"
            label={`Type "${site.name}" to confirm:`}
            value={deleteConfirmName}
            onChange={setDeleteConfirmName}
            placeholder={site.name}
          />
        </div>
        <div style={{ marginTop: "0.5rem" }}>
          <Button
            variant="danger"
            onClick={handleDelete}
            isDisabled={isDeleting || deleteConfirmName !== site.name}
          >
            {isDeleting ? "Deleting..." : "Permanently Delete Site"}
          </Button>
        </div>
      </section>
    </main>
  );
}

/**
 * Progress bar shown while a site is creating or its first build is
 * queued/building on Vercel/Netlify. Pure CSS animation that fills 0→95%
 * over the typical first-deploy duration; asymptote at 95% means we only
 * declare "Live" when the provider state actually flips to ready (in
 * which case this component unmounts and the "Your site is live!" copy
 * renders instead).
 *
 * Single bar across the whole creating → queued → building arc so the
 * artist sees one continuous indicator, not three. Slight mismatch
 * between bar progress and actual phase is acceptable — the goal is
 * "this is happening, not stuck", not frame-accurate timing.
 */
const FIRST_DEPLOY_PROGRESS_MS = 90_000;

function FirstDeployProgressBar() {
  return (
    <span
      aria-hidden
      style={{
        display: "block",
        width: "100%",
        height: "0.375rem",
        background: "var(--color-surface-raised)",
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          background: "var(--color-brand)",
          transformOrigin: "left",
          animation: `stagecraftFirstDeployProgress ${FIRST_DEPLOY_PROGRESS_MS}ms ease-out forwards`,
        }}
      />
    </span>
  );
}
