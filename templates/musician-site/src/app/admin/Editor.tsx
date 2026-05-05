"use client";

import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";
import { useCallback, useEffect, useRef, useState } from "react";

import { puckConfig } from "@/puck/config";
import type { PageData } from "@/lib/content";
import { parseDeployedSha } from "@/lib/deployed-sha";

type Props = {
  initialData: PageData;
  pageSlug: string;
  email: string;
};

/**
 * Publish lifecycle:
 *   idle → publishing → published(commitSha) → live(commitSha)
 *                              ↘ stalled (poll timeout, build still running)
 *   any → error(message)
 *
 * "publishing" = the /api/publish round-trip (broker → GitHub commit).
 * "published" = commit on disk on the artist's repo, deploy now in flight.
 * "live"      = the public site is now serving the new commit (matched via
 *               polling for the `stagecraft-deployed-sha` meta tag).
 * "stalled"   = poll timed out at ~90s; build may still be running, but
 *               we stop polling so we don't spin forever.
 */
type PublishState =
  | { status: "idle" }
  | { status: "publishing" }
  | { status: "published"; commitSha: string }
  | { status: "live"; commitSha: string }
  | { status: "stalled"; commitSha: string }
  | { status: "error"; message: string };

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90_000;

// Expected end-to-end build time (roughly the median observed for a
// Next.js musician-site template on Vercel/Netlify). The progress bar
// in the "Building…" pill animates from 0 → 95% over this window. We
// asymptote at 95% so we never claim "done" until the public site
// actually serves the new commit (state → "live"). If the build runs
// longer, the bar holds at 95% until POLL_TIMEOUT_MS, then transitions
// to "stalled".
const EXPECTED_BUILD_MS = 60_000;

export function Editor({ initialData, pageSlug, email }: Props) {
  const [publishState, setPublishState] = useState<PublishState>({ status: "idle" });

  const onPublish = useCallback(
    async (data: PageData) => {
      setPublishState({ status: "publishing" });
      try {
        const res = await fetch("/api/publish", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pageSlug, data }),
        });
        const body = (await res.json().catch(() => null)) as
          | { ok: true; commitSha: string | null }
          | { ok: false; error?: string }
          | null;
        if (!res.ok) {
          const message =
            (body && "error" in body && body.error) ||
            `Publish failed (HTTP ${res.status})`;
          setPublishState({ status: "error", message });
          // Re-throw so Puck sees an error too (it has its own subtle
          // visual feedback via console + error boundary).
          throw new Error(message);
        }
        if (body && body.ok && body.commitSha) {
          // Production: real commit, deploy will follow. Polling kicks in
          // via the useEffect below.
          setPublishState({ status: "published", commitSha: body.commitSha });
        } else {
          // Dev fallback (no STAGECRAFT_PLATFORM_URL configured): publish
          // wrote JSON to local disk, no deploy, nothing to poll for.
          setPublishState({ status: "live", commitSha: "dev" });
        }
      } catch (cause) {
        // Already set to error above for HTTP failures; this catches
        // network/parse errors that happen before we got a response.
        setPublishState((current) =>
          current.status === "error"
            ? current
            : {
                status: "error",
                message: cause instanceof Error ? cause.message : "Publish failed",
              },
        );
      }
    },
    [pageSlug],
  );

  // Poll the public site for the matching `stagecraft-deployed-sha` meta
  // tag. Bypass any CDN cache with a per-request `?_t=` parameter — the
  // root page is SSR/ISR'd, so a query param defeats whatever caching
  // layer Vercel/Netlify put in front of it.
  useEffect(() => {
    if (publishState.status !== "published") return;
    const targetSha = publishState.commitSha;
    let cancelled = false;
    const start = Date.now();

    async function tick() {
      try {
        const res = await fetch(`/?_publishCheck=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return false;
        const html = await res.text();
        const liveSha = parseDeployedSha(html);
        if (liveSha && liveSha === targetSha) {
          if (!cancelled) {
            setPublishState({ status: "live", commitSha: targetSha });
          }
          return true;
        }
        return false;
      } catch {
        return false; // transient failure; keep trying
      }
    }

    const interval = setInterval(async () => {
      if (cancelled) {
        clearInterval(interval);
        return;
      }
      if (await tick()) {
        clearInterval(interval);
        return;
      }
      if (Date.now() - start > POLL_TIMEOUT_MS) {
        clearInterval(interval);
        if (!cancelled) {
          setPublishState({ status: "stalled", commitSha: targetSha });
        }
      }
    }, POLL_INTERVAL_MS);

    // First check immediately so a fast deploy doesn't have to wait
    // for the first interval tick.
    void tick();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [publishState]);

  return (
    <Puck
      config={puckConfig}
      data={initialData}
      onPublish={onPublish}
      overrides={{
        headerActions: ({ children }) => (
          <>
            <PublishStatusPill state={publishState} />
            {children}
            <UserMenu email={email} />
          </>
        ),
      }}
    />
  );
}

function PublishStatusPill({ state }: { state: PublishState }) {
  // Common pill base style. Each branch picks color via CSS variables —
  // no raw hex (CLAUDE.md §7).
  const base = {
    display: "inline-flex" as const,
    alignItems: "center",
    gap: "var(--space-1)",
    padding: "var(--space-1) var(--space-2)",
    fontSize: "var(--font-size-xs)",
    fontWeight: "var(--font-weight-semibold)" as unknown as number,
    borderRadius: "var(--radius-sm)",
    whiteSpace: "nowrap" as const,
  };

  switch (state.status) {
    case "idle":
      return null;
    case "publishing":
      return (
        <span
          role="status"
          style={{
            ...base,
            background: "var(--color-surface-raised)",
            color: "var(--color-text-muted)",
          }}
        >
          <Spinner /> Publishing…
        </span>
      );
    case "published":
      return (
        <span
          role="status"
          style={{
            ...base,
            background: "var(--color-surface-raised)",
            color: "var(--color-text-muted)",
          }}
          title={`Commit ${state.commitSha.slice(0, 7)} pushed; waiting for deploy (~${EXPECTED_BUILD_MS / 1000}s typical)`}
        >
          Building… <ProgressBar />
        </span>
      );
    case "live":
      return (
        <span
          role="status"
          style={{
            ...base,
            // Subtle success treatment; site CSS doesn't have a green
            // semantic token yet, so use the action color (matches the
            // primary button so it reads as "good, done").
            background: "var(--color-surface-raised)",
            color: "var(--color-text)",
          }}
          title={
            state.commitSha === "dev"
              ? "Saved locally (dev mode)"
              : `Live: commit ${state.commitSha.slice(0, 7)}`
          }
        >
          <Dot /> Live
        </span>
      );
    case "stalled":
      return (
        <span
          role="status"
          style={{
            ...base,
            background: "var(--color-surface-raised)",
            color: "var(--color-text-muted)",
          }}
          title={`Commit ${state.commitSha.slice(0, 7)} — build still running`}
        >
          Still building…
        </span>
      );
    case "error":
      return (
        <span
          role="alert"
          style={{
            ...base,
            background: "var(--color-surface-raised)",
            color: "var(--color-text-error)",
          }}
          title={state.message}
        >
          Publish failed
        </span>
      );
  }
}

function ProgressBar() {
  // Pure CSS animation — `transform: scaleX` is GPU-composited and
  // doesn't trigger layout, so it stays smooth even while Puck does its
  // own work in the editor. `forwards` keeps the bar at 95% after the
  // animation completes, so a slow build still shows "almost done".
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: "3rem",
        height: "0.25rem",
        background: "var(--color-border)",
        borderRadius: "var(--radius-sm)",
        overflow: "hidden",
        verticalAlign: "middle",
      }}
    >
      <span
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          background: "var(--color-text-muted)",
          transformOrigin: "left",
          animation: `stagecraftPublishProgress ${EXPECTED_BUILD_MS}ms ease-out forwards`,
        }}
      />
    </span>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: "0.625rem",
        height: "0.625rem",
        border: "2px solid var(--color-border-strong)",
        borderTopColor: "var(--color-text-muted)",
        borderRadius: "50%",
        animation: "stagecraftSpin 0.8s linear infinite",
      }}
    />
  );
}

function Dot() {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: "0.5rem",
        height: "0.5rem",
        borderRadius: "50%",
        background: "var(--color-action)",
      }}
    />
  );
}

function UserMenu({ email }: { email: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Click-outside to close. The dropdown floats over the canvas, so users
  // expect it to dismiss on any click off the menu.
  useEffect(() => {
    if (!isOpen) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isOpen]);

  const initial = (email[0] ?? "?").toUpperCase();

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={`Account menu (signed in as ${email || "unknown"})`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        style={{
          width: "1.75rem",
          height: "1.75rem",
          borderRadius: "50%",
          border: "1px solid var(--color-border)",
          background: "var(--color-surface-raised)",
          color: "var(--color-text)",
          fontSize: "var(--font-size-xs)",
          fontWeight: "var(--font-weight-semibold)" as unknown as number,
          cursor: "pointer",
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {initial}
      </button>
      {isOpen ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + var(--space-1))",
            right: 0,
            minWidth: "12rem",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            padding: "var(--space-2)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          <div
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--color-text-muted)",
            }}
          >
            Signed in as
          </div>
          <div
            style={{
              fontSize: "var(--font-size-sm)",
              fontWeight: "var(--font-weight-semibold)" as unknown as number,
              color: "var(--color-text)",
              wordBreak: "break-all",
            }}
          >
            {email || "(unknown)"}
          </div>
          <form
            action="/api/auth/logout"
            method="POST"
            style={{ margin: 0 }}
            onSubmit={() => setIsOpen(false)}
          >
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "var(--space-1) var(--space-3)",
                fontSize: "var(--font-size-sm)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                cursor: "pointer",
                borderRadius: "var(--radius-sm)",
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
