"use client";

import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";
import { useCallback, useEffect, useRef, useState } from "react";

import { puckConfig } from "@/puck/config";
import type { PageData } from "@/lib/content";
import type { DeployState } from "@/lib/deploy-status";

type Props = {
  initialData: PageData;
  pageSlug: string;
  email: string;
};

/**
 * Publish lifecycle:
 *   idle → publishing → queued → building → live
 *                                    ↘ stalled (poll timeout, build still running)
 *   any → error(message)
 *
 * "publishing" = the /api/publish round-trip (broker → GitHub commit).
 * "queued"     = commit on disk on the artist's repo, deploy not yet started.
 * "building"   = deploy actively building on Vercel/Netlify.
 * "live"       = the public site now serves the new commit (provider state=ready).
 * "stalled"    = poll timed out at ~90s; build may still be running, but we
 *                stop polling so we don't spin forever.
 *
 * Provider state comes from `GET /api/publish-status`, which proxies to the
 * platform's broker (`POST /api/broker/deploy-status`) which calls
 * Vercel/Netlify directly. Real signal — no time-based dead reckoning for
 * the *transitions* (the visible bar fill within the building state is
 * still time-based; neither provider exposes granular progress).
 */
type PublishState =
  | { status: "idle" }
  | { status: "publishing" }
  | { status: "queued"; publishedAt: number }
  | { status: "building"; publishedAt: number }
  | { status: "live" }
  | { status: "stalled"; publishedAt: number }
  | { status: "error"; message: string };

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90_000;

// Expected end-to-end build time (roughly the median observed for a
// Next.js musician-site template on Vercel/Netlify). Used for the
// progress bar fill animation while in the "building" state. Asymptote
// at 95% — we only claim "Live" when the provider says ready.
const EXPECTED_BUILD_MS = 60_000;

type DeployStatusBody = {
  ok: true;
  deploy: {
    id: string | null;
    state: DeployState;
    url: string | null;
    errorMessage?: string | null;
    createdAt: string | null;
  };
};

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
          throw new Error(message);
        }
        if (body && body.ok && body.commitSha) {
          // Production: real commit, deploy will follow. Polling kicks in
          // via the useEffect below.
          setPublishState({ status: "queued", publishedAt: Date.now() });
        } else {
          // Dev fallback (no STAGECRAFT_PLATFORM_URL configured): publish
          // wrote JSON to local disk, no deploy, nothing to poll for.
          setPublishState({ status: "live" });
        }
      } catch (cause) {
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

  // While we're waiting on a deploy (queued or building), poll the
  // platform's broker via /api/publish-status for real provider state.
  // Stale-deploy guard: ignore any deploy whose createdAt predates the
  // moment we hit publish, since that's a build kicked off by something
  // earlier (or another author) and isn't the one we care about.
  useEffect(() => {
    if (publishState.status !== "queued" && publishState.status !== "building") return;
    const publishedAt = publishState.publishedAt;
    let cancelled = false;
    const start = Date.now();

    async function tick(): Promise<boolean> {
      try {
        const res = await fetch("/api/publish-status", { cache: "no-store" });
        if (!res.ok) return false;
        const body = (await res.json()) as DeployStatusBody | { ok: false };
        if (!("deploy" in body)) return false;
        const { deploy } = body;
        if (cancelled) return true;

        const deployTime = deploy.createdAt ? Date.parse(deploy.createdAt) : 0;
        // Allow a 30s grace window — Vercel sometimes records createdAt
        // slightly before our publish (clock skew, queue ordering).
        const isOurs = !deploy.createdAt || deployTime >= publishedAt - 30_000;

        if (deploy.state === "ready" && isOurs) {
          setPublishState({ status: "live" });
          return true;
        }
        if (deploy.state === "error" && isOurs) {
          setPublishState({
            status: "error",
            message: deploy.errorMessage ?? "Build failed on the deploy provider",
          });
          return true;
        }
        if (deploy.state === "building" && isOurs) {
          setPublishState((current) =>
            current.status === "building" ? current : { status: "building", publishedAt },
          );
        }
        // queued / unknown / pre-publish deploys: keep polling.
        return false;
      } catch {
        return false; // transient — try again next tick
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
          setPublishState({ status: "stalled", publishedAt });
        }
      }
    }, POLL_INTERVAL_MS);

    // First check immediately so a fast deploy doesn't wait for the first
    // interval tick before we discover it.
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
    case "queued":
      return (
        <span
          role="status"
          style={{
            ...base,
            background: "var(--color-surface-raised)",
            color: "var(--color-text-muted)",
          }}
          title="Build queued"
        >
          <Spinner /> Queued…
        </span>
      );
    case "building":
      return (
        <span
          role="status"
          style={{
            ...base,
            background: "var(--color-surface-raised)",
            color: "var(--color-text-muted)",
          }}
          title={`Building (~${EXPECTED_BUILD_MS / 1000}s typical)`}
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
            background: "var(--color-surface-raised)",
            color: "var(--color-text)",
          }}
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
          title="Build still running — refresh to check status"
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
