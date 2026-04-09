"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface SiteJob {
  id: string;
  type: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface Site {
  id: string;
  name: string;
  slug: string;
  status: string;
  blueprintType: string;
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
      <main style={{ maxWidth: 640, margin: "40px auto", fontFamily: "system-ui" }}>
        <p>Loading...</p>
      </main>
    );
  }

  if (error || !site) {
    return (
      <main style={{ maxWidth: 640, margin: "40px auto", fontFamily: "system-ui" }}>
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

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", fontFamily: "system-ui" }}>
      <p><a href="/dashboard">&larr; Dashboard</a></p>

      <h1>{site.name}</h1>

      <div style={{
        padding: 12,
        background: isCreating ? "#fff3cd" : isError ? "#f8d7da" : isArchived ? "#e2e3e5" : "#d4edda",
        borderRadius: 4,
        marginBottom: 16,
      }}>
        {isCreating && "Setting up your site... This may take a few minutes."}
        {site.status === "error" && `Something went wrong: ${latestJob?.errorMessage ?? "Unknown error"}`}
        {site.status === "active" && !needsRepoLink && "Your site is live!"}
        {isArchived && "This site is archived. The GitHub repo is read-only."}
      </div>

      {needsRepoLink && netlifyLinkRepoUrl && (
        <div style={{
          padding: 16,
          background: "#e8f4fd",
          border: "1px solid #b8daff",
          borderRadius: 4,
          marginBottom: 16,
        }}>
          <strong>Next step: connect your GitHub repo to Netlify</strong>
          <p style={{ margin: "8px 0 12px", fontSize: 14, color: "#444" }}>
            Your GitHub repo and Netlify site are created. Link them to enable auto-deploys on push.
          </p>
          <a
            href={netlifyLinkRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "8px 16px",
              background: "#0066cc",
              color: "#fff",
              borderRadius: 4,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Connect repo in Netlify &rarr;
          </a>
        </div>
      )}

      <section style={{ marginTop: 24 }}>
        <h2>Details</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ padding: 8, fontWeight: 600 }}>Blueprint</td>
              <td style={{ padding: 8 }}>{site.blueprintType}</td>
            </tr>
            <tr>
              <td style={{ padding: 8, fontWeight: 600 }}>Status</td>
              <td style={{ padding: 8 }}>{site.status}</td>
            </tr>
            {githubUrl && (
              <tr>
                <td style={{ padding: 8, fontWeight: 600 }}>GitHub</td>
                <td style={{ padding: 8 }}>
                  <a href={githubUrl} target="_blank" rel="noopener noreferrer">{githubUrl}</a>
                </td>
              </tr>
            )}
            {site.netlifyAdminUrl && (
              <tr>
                <td style={{ padding: 8, fontWeight: 600 }}>Netlify</td>
                <td style={{ padding: 8 }}>
                  <a href={site.netlifyAdminUrl} target="_blank" rel="noopener noreferrer">Site settings</a>
                </td>
              </tr>
            )}
            {site.productionUrl && (
              <tr>
                <td style={{ padding: 8, fontWeight: 600 }}>Production URL</td>
                <td style={{ padding: 8 }}>
                  <a href={site.productionUrl} target="_blank" rel="noopener noreferrer">{site.productionUrl}</a>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {site.jobs.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Jobs</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {site.jobs.map((job) => (
              <li key={job.id} style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 8 }}>
                <strong>{job.type}</strong>
                <span style={{ marginLeft: 8, color: "#666", fontSize: 14 }}>{job.status}</span>
                {job.errorMessage && (
                  <p style={{ color: "#c00", fontSize: 14, margin: "4px 0 0" }}>{job.errorMessage}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Archive / Unarchive */}
      {(site.status === "active" || isArchived) && (
        <section style={{ marginTop: 32 }}>
          <button
            onClick={handleArchiveToggle}
            disabled={archiving}
            style={{
              background: isArchived ? "#0066cc" : "#6c757d",
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: 4,
              cursor: archiving ? "not-allowed" : "pointer",
              opacity: archiving ? 0.6 : 1,
            }}
          >
            {archiving
              ? (isArchived ? "Unarchiving..." : "Archiving...")
              : (isArchived ? "Unarchive Site" : "Archive Site")}
          </button>
          {!isArchived && (
            <p style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
              Archiving makes the GitHub repo read-only. You can unarchive later.
            </p>
          )}
        </section>
      )}

      {/* Delete — requires typing site name */}
      <section style={{ marginTop: 48, borderTop: "1px solid #ddd", paddingTop: 24 }}>
        <h2 style={{ color: "#c00" }}>Danger Zone</h2>
        <p style={{ fontSize: 14, color: "#666" }}>
          Permanently delete this site, its GitHub repository, and Netlify deployment. This cannot be undone.
        </p>
        <p style={{ fontSize: 14, color: "#666" }}>
          Type <strong>{site.name}</strong> to confirm:
        </p>
        <input
          type="text"
          value={deleteConfirmName}
          onChange={(e) => setDeleteConfirmName(e.target.value)}
          placeholder={site.name}
          style={{
            padding: "6px 10px",
            border: "1px solid #ddd",
            borderRadius: 4,
            width: "100%",
            maxWidth: 300,
            fontSize: 14,
          }}
        />
        <div style={{ marginTop: 8 }}>
          <button
            onClick={handleDelete}
            disabled={deleting || deleteConfirmName !== site.name}
            style={{
              background: "#c00",
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: 4,
              cursor: deleting || deleteConfirmName !== site.name ? "not-allowed" : "pointer",
              opacity: deleting || deleteConfirmName !== site.name ? 0.6 : 1,
            }}
          >
            {deleting ? "Deleting..." : "Permanently Delete Site"}
          </button>
        </div>
      </section>
    </main>
  );
}
