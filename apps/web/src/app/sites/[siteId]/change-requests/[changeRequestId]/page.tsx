"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/Button";
import Textarea from "@/components/Textarea";

type ChangeRequestStatus =
  | "pending"
  | "in_progress"
  | "ready_for_review"
  | "approved"
  | "rejected"
  | "discarded";

interface SiteInfo {
  id: string;
  name: string;
  githubRepoOwner?: string;
  githubRepoName?: string;
  netlifySiteId?: string;
}

interface JobInfo {
  id: string;
  status: string;
  errorMessage?: string;
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
  createdAt: string;
  site: SiteInfo;
  job?: JobInfo;
}

const STATUS_LABEL: Record<ChangeRequestStatus, string> = {
  pending: "Queued",
  in_progress: "Working…",
  ready_for_review: "Ready for Review",
  approved: "Approved & Merged",
  rejected: "Rejected",
  discarded: "Discarded",
};

const STATUS_BG: Record<ChangeRequestStatus, string> = {
  pending: "var(--color-neutral-bg)",
  in_progress: "var(--color-warning-bg)",
  ready_for_review: "var(--color-info-bg)",
  approved: "var(--color-success-bg)",
  rejected: "var(--color-error-bg)",
  discarded: "var(--color-neutral-bg)",
};

export default function ChangeRequestReviewPage() {
  const { siteId, changeRequestId } = useParams<{
    siteId: string;
    changeRequestId: string;
  }>();

  const [changeRequest, setChangeRequest] = useState<ChangeRequest | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [showReviseForm, setShowReviseForm] = useState(false);
  const [reviseText, setReviseText] = useState("");
  const [actionError, setActionError] = useState("");

  async function fetchChangeRequest() {
    try {
      const res = await fetch(`/api/change-requests/${changeRequestId}`);
      if (!res.ok) {
        setError("Change request not found");
        setIsLoading(false);
        return;
      }
      const data = await res.json();
      setChangeRequest(data.changeRequest);
      setIsLoading(false);
    } catch {
      setError("Failed to load change request");
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchChangeRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeRequestId]);

  // Poll while pending or in_progress
  useEffect(() => {
    if (!changeRequest) return;
    if (changeRequest.status !== "pending" && changeRequest.status !== "in_progress") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/change-requests/${changeRequestId}`);
        if (res.ok) {
          const data = await res.json();
          setChangeRequest(data.changeRequest);
        }
      } catch {
        // ignore
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [changeRequest, changeRequestId]);

  async function handleApprove() {
    setIsApproving(true);
    setActionError("");
    try {
      const res = await fetch(`/api/change-requests/${changeRequestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json();
      if (res.ok) {
        setChangeRequest((prev) => prev ? { ...prev, status: "approved" } : prev);
      } else {
        setActionError(data.error || "Failed to approve");
      }
    } catch {
      setActionError("Failed to approve");
    } finally {
      setIsApproving(false);
    }
  }

  async function handleReject() {
    if (!confirm("Reject and close this PR?")) return;
    setIsRejecting(true);
    setActionError("");
    try {
      const res = await fetch(`/api/change-requests/${changeRequestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      const data = await res.json();
      if (res.ok) {
        setChangeRequest((prev) => prev ? { ...prev, status: "rejected" } : prev);
      } else {
        setActionError(data.error || "Failed to reject");
      }
    } catch {
      setActionError("Failed to reject");
    } finally {
      setIsRejecting(false);
    }
  }

  async function handleRevise() {
    if (!reviseText.trim()) return;
    setIsRevising(true);
    setActionError("");
    try {
      const res = await fetch(`/api/change-requests/${changeRequestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revise", requestText: reviseText.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        // Navigate to the new change request's review page
        window.location.href = `/sites/${siteId}/change-requests/${data.changeRequest.id}`;
      } else {
        setActionError(data.error || "Failed to submit revision");
        setIsRevising(false);
      }
    } catch {
      setActionError("Failed to submit revision");
      setIsRevising(false);
    }
  }

  if (isLoading) {
    return (
      <main style={{ maxWidth: "var(--max-width-narrow)", margin: "2.5rem auto", fontFamily: "var(--font-body)" }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (error || !changeRequest) {
    return (
      <main style={{ maxWidth: "var(--max-width-narrow)", margin: "2.5rem auto", fontFamily: "var(--font-body)" }}>
        <p><a href={`/sites/${siteId}`}>&larr; Back to site</a></p>
        <h1>Not found</h1>
        <p>{error || "Change request not found."}</p>
      </main>
    );
  }

  const { status } = changeRequest;
  const githubPrUrl =
    changeRequest.prNumber &&
    changeRequest.site.githubRepoOwner &&
    changeRequest.site.githubRepoName
      ? `https://github.com/${changeRequest.site.githubRepoOwner}/${changeRequest.site.githubRepoName}/pull/${changeRequest.prNumber}`
      : null;

  const isActionable = status === "ready_for_review";
  const isTerminal = status === "approved" || status === "rejected" || status === "discarded";

  return (
    <main style={{ maxWidth: "var(--max-width-narrow)", margin: "2.5rem auto", fontFamily: "var(--font-body)" }}>
      <p><a href={`/sites/${siteId}`}>&larr; {changeRequest.site.name}</a></p>

      <h1>Review Change Request</h1>

      {/* Status banner */}
      <div style={{
        padding: "0.75rem 1rem",
        background: STATUS_BG[status],
        borderRadius: "var(--radius-sm)",
        marginBottom: "1.5rem",
        fontWeight: "var(--font-weight-semibold)",
      }}>
        {STATUS_LABEL[status]}
        {(status === "pending" || status === "in_progress") && (
          <span style={{ fontWeight: "var(--font-weight-normal)", marginLeft: "0.5rem", fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
            — this page will update automatically
          </span>
        )}
      </div>

      {/* Request details */}
      <section>
        <h2 style={{ fontSize: "var(--font-size-base)", marginBottom: "0.375rem" }}>Request</h2>
        <p style={{ margin: 0, lineHeight: 1.6 }}>{changeRequest.requestText}</p>
        {changeRequest.classifiedMode && (
          <p style={{ margin: "0.375rem 0 0", fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
            Mode: <code>{changeRequest.classifiedMode.replace(/_/g, " ")}</code>
          </p>
        )}
      </section>

      {/* Summary */}
      {changeRequest.summary && (
        <section style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "var(--font-size-base)", marginBottom: "0.375rem" }}>What changed</h2>
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>{changeRequest.summary}</p>
        </section>
      )}

      {/* Links */}
      {(githubPrUrl || changeRequest.branchName) && (
        <section style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "var(--font-size-base)", marginBottom: "0.5rem" }}>Pull Request</h2>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <tbody>
              {githubPrUrl && (
                <tr>
                  <td style={{ padding: "0.25rem 0.5rem 0.25rem 0", fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-sm)", whiteSpace: "nowrap" }}>
                    GitHub PR
                  </td>
                  <td style={{ padding: "0.25rem 0", fontSize: "var(--font-size-sm)" }}>
                    <a href={githubPrUrl} target="_blank" rel="noopener noreferrer">
                      #{changeRequest.prNumber} &rarr;
                    </a>
                  </td>
                </tr>
              )}
              {changeRequest.branchName && (
                <tr>
                  <td style={{ padding: "0.25rem 0.5rem 0.25rem 0", fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-sm)", whiteSpace: "nowrap" }}>
                    Branch
                  </td>
                  <td style={{ padding: "0.25rem 0", fontSize: "var(--font-size-sm)" }}>
                    <code>{changeRequest.branchName}</code>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* Preview */}
      {changeRequest.previewUrl ? (
        <section style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "var(--font-size-base)", marginBottom: "0.5rem" }}>Preview</h2>
          <div style={{ marginBottom: "0.5rem" }}>
            <Button href={changeRequest.previewUrl} target="_blank" rel="noopener noreferrer" size="sm" variant="ghost">
              Open preview in new tab &rarr;
            </Button>
          </div>
          <iframe
            src={changeRequest.previewUrl}
            title="Deploy preview"
            style={{
              width: "100%",
              height: "480px",
              border: `1px solid var(--color-border)`,
              borderRadius: "var(--radius-sm)",
              background: "var(--color-neutral-bg)",
            }}
          />
        </section>
      ) : status === "ready_for_review" ? (
        <section style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "var(--font-size-base)", marginBottom: "0.25rem" }}>Preview</h2>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", margin: 0 }}>
            Deploy preview not yet available. This usually means the Netlify site isn&rsquo;t connected to
            GitHub auto-deploys yet.{" "}
            {githubPrUrl && (
              <a href={githubPrUrl} target="_blank" rel="noopener noreferrer">
                Review the diff on GitHub instead.
              </a>
            )}
          </p>
        </section>
      ) : null}

      {/* Actions */}
      {isActionable && (
        <section style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: "var(--font-size-base)", marginBottom: "0.75rem" }}>Decision</h2>

          {actionError && (
            <p style={{ color: "var(--color-error)", fontSize: "var(--font-size-sm)", marginBottom: "0.5rem" }}>
              {actionError}
            </p>
          )}

          {!showReviseForm ? (
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Button onClick={handleApprove} isDisabled={isApproving || isRejecting || isRevising}>
                {isApproving ? "Merging…" : "Approve & Merge"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowReviseForm(true)}
                isDisabled={isApproving || isRejecting}
              >
                Revise
              </Button>
              <Button
                variant="danger"
                onClick={handleReject}
                isDisabled={isApproving || isRejecting || isRevising}
              >
                {isRejecting ? "Rejecting…" : "Reject"}
              </Button>
            </div>
          ) : (
            <div>
              <Textarea
                id="revise-text"
                label="Describe the revision:"
                value={reviseText}
                onChange={setReviseText}
                placeholder="e.g. The bio is good but please also update the contact page email address"
              />
              {actionError && (
                <p style={{ color: "var(--color-error)", fontSize: "var(--font-size-sm)", margin: "0.25rem 0 0.5rem" }}>
                  {actionError}
                </p>
              )}
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                <Button onClick={handleRevise} isDisabled={isRevising || !reviseText.trim()}>
                  {isRevising ? "Submitting…" : "Submit Revision"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setShowReviseForm(false); setReviseText(""); setActionError(""); }}
                  isDisabled={isRevising}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Terminal states — offer revise from rejected/discarded */}
      {(status === "rejected" || status === "discarded") && (
        <section style={{ marginTop: "2rem" }}>
          {!showReviseForm ? (
            <Button variant="ghost" onClick={() => setShowReviseForm(true)}>
              Try a different request
            </Button>
          ) : (
            <div>
              <Textarea
                id="revise-text"
                label="New request:"
                value={reviseText}
                onChange={setReviseText}
                placeholder="Describe what you'd like to change"
              />
              {actionError && (
                <p style={{ color: "var(--color-error)", fontSize: "var(--font-size-sm)", margin: "0.25rem 0 0.5rem" }}>
                  {actionError}
                </p>
              )}
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                <Button onClick={handleRevise} isDisabled={isRevising || !reviseText.trim()}>
                  {isRevising ? "Submitting…" : "Submit New Request"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setShowReviseForm(false); setReviseText(""); setActionError(""); }}
                  isDisabled={isRevising}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {status === "approved" && (
        <section style={{ marginTop: "2rem" }}>
          <p style={{ color: "var(--color-success)", fontWeight: "var(--font-weight-semibold)" }}>
            Merged. Changes will deploy to production shortly.
          </p>
          <Button href={`/sites/${siteId}`} variant="ghost">
            &larr; Back to site
          </Button>
        </section>
      )}

      {/* Job error info for discarded */}
      {status === "discarded" && changeRequest.job?.errorMessage && (
        <section style={{ marginTop: "1rem" }}>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-error)" }}>
            Error: {changeRequest.job.errorMessage}
          </p>
        </section>
      )}

      {isTerminal && status !== "approved" && !showReviseForm && (
        <div style={{ marginTop: "1rem" }}>
          <Button href={`/sites/${siteId}`} variant="ghost">
            &larr; Back to site
          </Button>
        </div>
      )}
    </main>
  );
}
