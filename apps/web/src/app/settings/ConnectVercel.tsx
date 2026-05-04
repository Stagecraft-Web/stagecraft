"use client";

import { useState } from "react";

type ConnectVercelProps = {
  /** When provided, shows "Connected as <username>" + a Disconnect button. */
  connectedUsername?: string | null;
};

/**
 * Client form for pasting a Vercel Personal Access Token. Posts to
 * /api/integrations/vercel/connect, which validates against /v2/user
 * before storing. Server-side route returns a clear error for invalid
 * tokens, surfaced inline below the input.
 */
export function ConnectVercel({ connectedUsername }: ConnectVercelProps) {
  const [token, setToken] = useState("");
  const [teamId, setTeamId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/vercel/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          ...(teamId.trim() ? { teamId: teamId.trim() } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to connect Vercel");
        setPending(false);
        return;
      }
      // Reload so the server-rendered page shows the new connected state
      window.location.assign("/settings?success=vercel_connected");
    } catch {
      setError("Network error connecting to Vercel");
      setPending(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Vercel? Existing sites stay deployed; you won't be able to create new Vercel-backed sites until you reconnect.")) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/vercel/connect", { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to disconnect Vercel");
        setPending(false);
        return;
      }
      window.location.assign("/settings?success=vercel_disconnected");
    } catch {
      setError("Network error disconnecting Vercel");
      setPending(false);
    }
  }

  if (connectedUsername) {
    return (
      <div>
        <p>
          Connected as <strong>{connectedUsername}</strong>
        </p>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={pending}
          style={{ marginTop: 8 }}
        >
          {pending ? "Disconnecting…" : "Disconnect"}
        </button>
        {error && (
          <p style={{ color: "#cc0000", marginTop: 8, fontSize: 14 }}>{error}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleConnect} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ color: "#555", fontSize: 14, marginTop: 0 }}>
        Generate a token at{" "}
        <a
          href="https://vercel.com/account/tokens"
          target="_blank"
          rel="noopener noreferrer"
        >
          vercel.com/account/tokens
        </a>
        , then paste it below. Token scope: <strong>Full Account</strong> (default).
      </p>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Personal access token</span>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="vercel_…"
          required
          autoComplete="off"
          spellCheck={false}
          style={{ padding: 8, fontFamily: "monospace" }}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          Team ID <span style={{ color: "#888", fontWeight: 400 }}>(optional — leave blank for personal account)</span>
        </span>
        <input
          type="text"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          placeholder="team_…"
          autoComplete="off"
          spellCheck={false}
          style={{ padding: 8, fontFamily: "monospace" }}
        />
      </label>
      <button type="submit" disabled={pending || !token.trim()} style={{ marginTop: 8 }}>
        {pending ? "Connecting…" : "Connect Vercel"}
      </button>
      {error && (
        <p style={{ color: "#cc0000", marginTop: 4, fontSize: 14 }}>{error}</p>
      )}
    </form>
  );
}
