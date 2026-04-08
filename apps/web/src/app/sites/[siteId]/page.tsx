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
  productionUrl: string | null;
  jobs: SiteJob[];
}

export default function SiteDetailPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
            // Stop polling once site is no longer creating
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

  const latestJob = site.jobs[0];
  const isCreating = site.status === "creating";
  const isError = site.status === "error";
  const githubUrl = site.githubRepoOwner && site.githubRepoName
    ? `https://github.com/${site.githubRepoOwner}/${site.githubRepoName}`
    : null;

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", fontFamily: "system-ui" }}>
      <p><a href="/dashboard">&larr; Dashboard</a></p>

      <h1>{site.name}</h1>

      <div style={{
        padding: 12,
        background: isCreating ? "#fff3cd" : isError ? "#f8d7da" : "#d4edda",
        borderRadius: 4,
        marginBottom: 16,
      }}>
        {isCreating && "Setting up your site... This may take a minute."}
        {isError && `Something went wrong: ${latestJob?.errorMessage ?? "Unknown error"}`}
        {site.status === "active" && "Your site is live!"}
      </div>

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
    </main>
  );
}
