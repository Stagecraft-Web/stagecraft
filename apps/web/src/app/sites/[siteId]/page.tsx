"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/Button";
import AssetManager from "@/components/AssetManager";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";

type SiteStatus = "creating" | "active" | "error" | "deploy_failed" | "archived";
type BlueprintType = "solo-artist" | "band" | "composer-educator" | "epk-focused" | "tour-focused";
type JobType = "create_site" | "edit_site" | "migrate_site" | "repair_site" | "deploy_config";
type JobStatus = "queued" | "running" | "completed" | "failed" | "awaiting_review" | "canceled";
type ChangeRequestStatus =
  | "pending"
  | "in_progress"
  | "ready_for_review"
  | "approved"
  | "rejected"
  | "discarded";

interface SiteJob {
  id: string;
  type: JobType;
  status: JobStatus;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

interface Site {
  id: string;
  name: string;
  slug: string;
  status: SiteStatus;
  blueprintType: BlueprintType;
  githubRepoOwner?: string;
  githubRepoName?: string;
  netlifySiteId?: string;
  netlifyAdminUrl?: string;
  productionUrl?: string;
  archivedAt?: string;
  jobs: SiteJob[];
}

type FailureCategory =
  | "github_api_error"
  | "netlify_deploy_error"
  | "validation_error"
  | "ai_error"
  | "timeout"
  | "unknown";

interface CRJob {
  id: string;
  status: string;
  failureCategory?: FailureCategory | null;
  errorMessage?: string;
  repairAttempts?: number;
}

interface ChangeRequest {
  id: string;
  requestText: string;
  classifiedMode?: string;
  branchName?: string;
  prNumber?: number;
  previewUrl?: string;
  summary?: string;
  status: ChangeRequestStatus;
  failureCategory?: FailureCategory | null;
  createdAt: string;
  job?: CRJob | null;
}

const CR_STATUS_LABEL: Record<ChangeRequestStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  ready_for_review: "Ready for Review",
  approved: "Approved",
  rejected: "Rejected",
  discarded: "Discarded",
};

const CR_STATUS_COLOR: Record<ChangeRequestStatus, string> = {
  pending: "var(--color-text-muted)",
  in_progress: "var(--color-warning)",
  ready_for_review: "var(--color-info)",
  approved: "var(--color-success)",
  rejected: "var(--color-error)",
  discarded: "var(--color-text-faint)",
};

export default function SiteDetailPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [editRequestText, setEditRequestText] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [editRequestError, setEditRequestError] = useState("");

  const fetchChangeRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/sites/${siteId}/change-requests`);
      if (res.ok) {
        const data = await res.json();
        setChangeRequests(data.changeRequests ?? []);
      }
    } catch {
      // Non-fatal — CR list will just be empty
    }
  }, [siteId]);

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
    fetchChangeRequests();

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
  }, [siteId, fetchChangeRequests]);

  // Poll change requests while any are in_progress or pending
  useEffect(() => {
    const hasActiveRequests = changeRequests.some(
      (cr) => cr.status === "pending" || cr.status === "in_progress"
    );
    if (!hasActiveRequests) return;

    const interval = setInterval(fetchChangeRequests, 4000);
    return () => clearInterval(interval);
  }, [changeRequests, fetchChangeRequests]);

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

  async function handleSubmitEditRequest() {
    if (!editRequestText.trim()) return;
    setIsSubmittingRequest(true);
    setEditRequestError("");
    try {
      const res = await fetch(`/api/sites/${siteId}/change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestText: editRequestText.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setEditRequestText("");
        setChangeRequests((prev) => [data.changeRequest, ...prev]);
      } else {
        setEditRequestError(data.error || "Failed to submit request");
      }
    } catch {
      setEditRequestError("Failed to submit request");
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  async function handleRetryCR(crId: string) {
    try {
      const res = await fetch(`/api/sites/${siteId}/change-requests/${crId}/retry`, { method: "POST" });
      if (res.ok) {
        setChangeRequests((prev) =>
          prev.map((cr) =>
            cr.id === crId
              ? { ...cr, status: "in_progress" as ChangeRequestStatus, job: cr.job ? { ...cr.job, status: "queued", failureCategory: null } : cr.job }
              : cr
          )
        );
      }
    } catch {
      // Non-fatal — user can retry again
    }
  }

  async function handleDiscardCR(crId: string) {
    if (!confirm("Discard this change request?")) return;
    try {
      const res = await fetch(`/api/sites/${siteId}/change-requests/${crId}/discard`, { method: "POST" });
      if (res.ok) {
        setChangeRequests((prev) =>
          prev.map((cr) =>
            cr.id === crId ? { ...cr, status: "discarded" as ChangeRequestStatus } : cr
          )
        );
      }
    } catch {
      // Non-fatal
    }
  }

  const latestJob = site.jobs[0];
  const isCreating = site.status === "creating";
  const isError = site.status === "error" || site.status === "deploy_failed";
  const isArchived = site.status === "archived";
  const isActive = site.status === "active";
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
    ? "var(--color-neutral-bg)"
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

      {/* Edit request form — only for active sites */}
      {isActive && (
        <section style={{ marginTop: "2rem" }}>
          <h2>Request a Change</h2>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: 0, marginBottom: "0.75rem" }}>
            Describe what you&rsquo;d like to change in plain language. The AI will make the edit, open a PR, and show you a preview to approve.
          </p>
          <Textarea
            id="edit-request"
            label="What would you like to change?"
            value={editRequestText}
            onChange={setEditRequestText}
            placeholder="e.g. Update my bio to mention the new album, or Change the nav link order so Tour Dates comes first"
          />
          {editRequestError && (
            <p style={{ color: "var(--color-error)", fontSize: "var(--font-size-sm)", margin: "0.25rem 0 0.5rem" }}>
              {editRequestError}
            </p>
          )}
          <div style={{ marginTop: "0.5rem" }}>
            <Button
              onClick={handleSubmitEditRequest}
              isDisabled={isSubmittingRequest || !editRequestText.trim()}
            >
              {isSubmittingRequest ? "Submitting..." : "Submit Change Request"}
            </Button>
          </div>
        </section>
      )}

      {/* Asset management — only for active sites */}
      {isActive && <AssetManager siteId={siteId} />}

      {/* Change request history */}
      {changeRequests.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2>Change Requests</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {changeRequests.map((cr) => (
              <li
                key={cr.id}
                style={{
                  padding: "0.875rem",
                  border: `1px solid var(--color-border)`,
                  borderRadius: "var(--radius-lg)",
                  marginBottom: "0.625rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                  <p style={{ margin: 0, fontSize: "var(--font-size-sm)", flex: 1 }}>
                    {cr.requestText.length > 120
                      ? `${cr.requestText.slice(0, 120)}…`
                      : cr.requestText}
                  </p>
                  <span style={{
                    fontSize: "var(--font-size-xs)",
                    fontWeight: "var(--font-weight-semibold)",
                    color: CR_STATUS_COLOR[cr.status],
                    whiteSpace: "nowrap",
                  }}>
                    {CR_STATUS_LABEL[cr.status]}
                  </span>
                </div>
                {cr.classifiedMode && (
                  <p style={{ margin: "0.25rem 0 0", fontSize: "var(--font-size-xs)", color: "var(--color-text-faint)" }}>
                    {cr.classifiedMode.replace(/_/g, " ")}
                  </p>
                )}
                {cr.status === "ready_for_review" && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <Button
                      href={`/sites/${siteId}/change-requests/${cr.id}`}
                      size="sm"
                    >
                      Review &rarr;
                    </Button>
                  </div>
                )}
                {(cr.status === "pending" || cr.status === "in_progress") && (
                  <p style={{ margin: "0.375rem 0 0", fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                    Working on it…
                  </p>
                )}
                {cr.job?.status === "failed" && cr.status !== "discarded" && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <p style={{ margin: "0 0 0.375rem", fontSize: "var(--font-size-xs)", color: "var(--color-error)" }}>
                      Failed
                      {cr.job.errorMessage ? `: ${cr.job.errorMessage}` : ""}
                    </p>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <Button size="sm" onClick={() => handleRetryCR(cr.id)}>
                        Retry
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDiscardCR(cr.id)}>
                        Discard
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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

      {/* Delete — requires typing site name */}
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
