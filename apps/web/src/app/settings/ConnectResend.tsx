"use client";

import { useState } from "react";

type ConnectResendProps = {
  /** When provided, shows "Sending from <fromAddress>" + a Disconnect button. */
  connectedFromAddress?: string | null;
};

/**
 * Client form for connecting the artist's own Resend account. Posts to
 * /api/integrations/resend/connect, which validates the API key (lists
 * Resend domains) and asserts the chosen sender lives on a verified
 * domain before storing.
 */
export function ConnectResend({ connectedFromAddress }: ConnectResendProps) {
  const [token, setToken] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/resend/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          fromAddress: fromAddress.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to connect Resend");
        setPending(false);
        return;
      }
      window.location.assign("/settings?success=resend_connected");
    } catch {
      setError("Network error connecting to Resend");
      setPending(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Resend? Existing artist sites keep working until their next deploy; new /create runs will be blocked until you reconnect.")) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/resend/connect", { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to disconnect Resend");
        setPending(false);
        return;
      }
      window.location.assign("/settings?success=resend_disconnected");
    } catch {
      setError("Network error disconnecting Resend");
      setPending(false);
    }
  }

  if (connectedFromAddress) {
    return (
      <div>
        <p>
          Sending magic-link emails from <strong>{connectedFromAddress}</strong>
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
        Generate an API key at{" "}
        <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer">
          resend.com/api-keys
        </a>{" "}
        and verify a sender domain at{" "}
        <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer">
          resend.com/domains
        </a>
        . Each artist site you create gets its own copy of these credentials —
        Stagecraft never sends mail on your behalf.
      </p>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Resend API key</span>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="re_…"
          required
          autoComplete="off"
          spellCheck={false}
          style={{ padding: 8, fontFamily: "monospace" }}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Sender address</span>
        <input
          type="email"
          value={fromAddress}
          onChange={(e) => setFromAddress(e.target.value)}
          placeholder="noreply@your-verified-domain.com"
          required
          autoComplete="off"
          spellCheck={false}
          style={{ padding: 8, fontFamily: "monospace" }}
        />
      </label>
      <button type="submit" disabled={pending || !token.trim() || !fromAddress.trim()} style={{ marginTop: 8 }}>
        {pending ? "Connecting…" : "Connect Resend"}
      </button>
      {error && (
        <p style={{ color: "#cc0000", marginTop: 4, fontSize: 14 }}>{error}</p>
      )}
    </form>
  );
}
