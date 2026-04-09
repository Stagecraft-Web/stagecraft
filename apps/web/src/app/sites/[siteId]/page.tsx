"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/Button";
import FormGroup from "@/components/FormGroup";

type SiteStatus = "creating" | "active" | "error" | "deploy_failed" | "archived";
type BlueprintType = "solo-artist" | "band" | "composer-educator" | "epk-focused" | "tour-focused";
type JobType = "create_site" | "edit_site" | "migrate_site" | "repair_site" | "deploy_config";
type JobStatus = "queued" | "running" | "completed" | "failed" | "awaiting_review" | "canceled";

interface SiteJob {
  id: string;
  type: JobType;
  status: JobStatus;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface Site {
  id: string;
  name: string;
  slug: string;
  status: SiteStatus;
  blueprintType: BlueprintType;
  githubRepoOwner: string | null;
  githubRepoName: string | null;
  netlifySiteId: string | null;
  netlifyAdminUrl: string | null;
  productionUrl: string | null;
  archivedAt: string | null;
  jobs: SiteJob[];
}

export default function SiteDetailPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  useEffect(() => {
    let active = true;

    async function fetchSite() {
      try {
        const res = await fetch(`/api/sites/${siteId}`);
        if (!res.ok) {
          setError("Site not found");
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (active) {
          setSite(data.site);
          setLoading(false);
        }
      } catch {
        if (active) {
          setError("Failed to load site");
          setLoading(false);
        }
      }
    }

    fetchSite();

    // Poll while site is still creating
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

  if (loading) {
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
    setArchiving(true);
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        setSite((prev) => prev ? { ...prev, status: data.site.status, archivedAt: action === "archive" ? new Date().toISOString() : null } : prev);
      } else {
        const data = await res.json();
        setError(data.error || `Failed to ${action} site`);
      }
    } catch {
      setError(`Failed to ${action} site`);
    } finally {
      setArchiving(false);
    }
  }

  async function handleDelete() {
    if (deleteConfirmName !== site!.name) return;
    setDeleting(true);
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
        setDeleting(false);
      }
    } catch {
      setError("Failed to delete site");
      setDeleting(false);
    }
  }

  const latestJob = site.jobs[0];
  const isCreating = site.status === "creating";
  const isError = site.status === "error" || site.status === "deploy_failed";
  const isArchived = site.status === "archived";
  const githubUrl = site.githubRepoOwner && site.githubRepoName
    ? `https://github.com/${site.githubRepoOwner}/${site.githubRepoName}`
    : null;
  const needsRepoLink = site.status === "active" && site.netlifyAdminUrl && !site.productionUrl;
  const netlifyLinkRepoUrl = site.netlifyAdminUrl
    ? `${site.netlifyAdminUrl}/configuration/deploys#content`
    : null;

  const statusBg = isCreating
    ? "var(--color-warning-bg)"
    : isError
    ? "var(--color-error-bg)"
    : isArchived
    ? "#e2e3e5"
    : "var(--color-success-bg)";

  return (
    <main style={{ maxWidth: "var(--max-width-narrow)", margin: "2.5rem auto", fontFamily: "var(--font-body)" }}>
      <p><a href="/dashboard">&larr; Dashboard</a></p>

      <h1>{site.name}</h1>

      <div style={{ padding: "0.75rem", background: statusBg, borderRadius: "var(--radius-sm)", marginBottom: "1rem" }}>
        {isCreating && "Setting up your site... This may take a few minutes."}
        {site.status === "error" && `Something went wrong: ${latestJob?.errorMessage ?? "Unknown error"}`}
        {site.status === "active" && !needsRepoLink && "Your site is live!"}
        {isArchived && "This site is archived. The GitHub repo is read-only."}
      </div>

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
              <td style={{ padding: "0.5rem", fontWeight: "var(--font-weight-semibold)" }}>Blueprint</td>
              <td style={{ padding: "0.5rem" }}>{site.blueprintType}</td>
            </tr>
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
            {site.netlifyAdminUrl && (
              <tr>
                <td style={{ padding: "0.5rem", fontWeight: "var(--font-weight-semibold)" }}>Netlify</td>
                <td style={{ padding: "0.5rem" }}>
                  <a href={site.netlifyAdminUrl} target="_blank" rel="noopener noreferrer">Site settings</a>
                </td>
              </tr>
            )}
            {site.productionUrl && (
              <tr>
                <td style={{ padding: "0.5rem", fontWeight: "var(--font-weight-semibold)" }}>Production URL</td>
                <td style={{ padding: "0.5rem" }}>
                  <a href={site.productionUrl} target="_blank" rel="noopener noreferrer">{site.productionUrl}</a>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

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

      {/* Archive / Unarchive */}
      {(site.status === "active" || isArchived) && (
        <section style={{ marginTop: "2rem" }}>
          <Button
            variant={isArchived ? "primary" : "muted"}
            onClick={handleArchiveToggle}
            isDisabled={archiving}
          >
            {archiving
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

      {/* Delete — requires typing site name */}
      <section style={{ marginTop: "3rem", borderTop: `1px solid var(--color-border)`, paddingTop: "1.5rem" }}>
        <h2 style={{ color: "var(--color-error)" }}>Danger Zone</h2>
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
          Permanently delete this site, its GitHub repository, and Netlify deployment. This cannot be undone.
        </p>
        <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
          Type <strong>{site.name}</strong> to confirm:
        </p>
        <div style={{ maxWidth: "var(--max-width-narrow)" }}>
          <FormGroup
            id="delete-confirm"
            label=""
            value={deleteConfirmName}
            onChange={setDeleteConfirmName}
            placeholder={site.name}
          />
        </div>
        <div style={{ marginTop: "0.5rem" }}>
          <Button
            variant="danger"
            onClick={handleDelete}
            isDisabled={deleting || deleteConfirmName !== site.name}
          >
            {deleting ? "Deleting..." : "Permanently Delete Site"}
          </Button>
        </div>
      </section>
    </main>
  );
}
