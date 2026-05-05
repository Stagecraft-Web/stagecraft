"use client";

import { useState } from "react";

type ConnectResendProps = {
  /** When provided, shows "Sending from <fromAddress>" + a Disconnect button. */
  connectedFromAddress?: string | null;
};

const RESEND_SANDBOX_FROM = "onboarding@resend.dev";

/**
 * Two-step form: artist pastes API key → we hit /preview to fetch their
 * verified Resend domains → they pick a sender from a dropdown (or fall
 * back to the Resend sandbox sender). Single submit. Less typing,
 * fewer ways to get the sender address wrong.
 */
export function ConnectResend({ connectedFromAddress }: ConnectResendProps) {
  const [token, setToken] = useState("");
  const [verifiedDomains, setVerifiedDomains] = useState<string[] | null>(null);
  const [fromAddress, setFromAddress] = useState("");
  const [pendingPreview, setPendingPreview] = useState(false);
  const [pendingConnect, setPendingConnect] = useState(false);
  const [pendingDisconnect, setPendingDisconnect] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLookupDomains() {
    if (!token.trim()) return;
    setPendingPreview(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/resend/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = (await res.json()) as { error?: string; verifiedDomains?: string[] };
      if (!res.ok) {
        setError(data.error ?? "Failed to look up Resend domains");
        setVerifiedDomains(null);
        setPendingPreview(false);
        return;
      }
      const domains = data.verifiedDomains ?? [];
      setVerifiedDomains(domains);
      setFromAddress(
        domains.length > 0 ? `noreply@${domains[0]}` : RESEND_SANDBOX_FROM,
      );
      setPendingPreview(false);
    } catch {
      setError("Network error looking up Resend domains");
      setPendingPreview(false);
    }
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setPendingConnect(true);
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
        setPendingConnect(false);
        return;
      }
      window.location.assign("/settings?success=resend_connected");
    } catch {
      setError("Network error connecting to Resend");
      setPendingConnect(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Resend? Existing artist sites keep working until their next deploy; new /create runs will be blocked until you reconnect.")) {
      return;
    }
    setPendingDisconnect(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/resend/connect", { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to disconnect Resend");
        setPendingDisconnect(false);
        return;
      }
      window.location.assign("/settings?success=resend_disconnected");
    } catch {
      setError("Network error disconnecting Resend");
      setPendingDisconnect(false);
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
          disabled={pendingDisconnect}
          style={{ marginTop: 8 }}
        >
          {pendingDisconnect ? "Disconnecting…" : "Disconnect"}
        </button>
        {error && (
          <p style={{ color: "#cc0000", marginTop: 8, fontSize: 14 }}>{error}</p>
        )}
      </div>
    );
  }

  const showSenderStep = verifiedDomains !== null;
  const usingSandbox = fromAddress === RESEND_SANDBOX_FROM || verifiedDomains?.length === 0;

  return (
    <form onSubmit={handleConnect} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ color: "#555", fontSize: 14, marginTop: 0 }}>
        Generate an API key at{" "}
        <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer">
          resend.com/api-keys
        </a>
        . Each artist site you create gets its own copy of the key —
        Stagecraft never sends mail on your behalf.
      </p>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Resend API key</span>
        <input
          type="password"
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            setVerifiedDomains(null);
            setFromAddress("");
            setError(null);
          }}
          onBlur={handleLookupDomains}
          placeholder="re_…"
          required
          autoComplete="off"
          spellCheck={false}
          style={{ padding: 8, fontFamily: "monospace" }}
        />
        {pendingPreview && (
          <span style={{ fontSize: 12, color: "#666" }}>Checking key…</span>
        )}
      </label>

      {showSenderStep && (
        <>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Sender</span>
            {verifiedDomains && verifiedDomains.length > 0 ? (
              <>
                <select
                  value={fromAddress.startsWith("noreply@") ? fromAddress.slice("noreply@".length) : "__custom__"}
                  onChange={(e) => {
                    if (e.target.value === RESEND_SANDBOX_FROM) {
                      setFromAddress(RESEND_SANDBOX_FROM);
                    } else if (e.target.value === "__custom__") {
                      // keep current fromAddress; user can edit below
                    } else {
                      setFromAddress(`noreply@${e.target.value}`);
                    }
                  }}
                  style={{ padding: 8, fontFamily: "monospace" }}
                >
                  {verifiedDomains.map((d) => (
                    <option key={d} value={d}>
                      noreply@{d}
                    </option>
                  ))}
                  <option value={RESEND_SANDBOX_FROM}>{RESEND_SANDBOX_FROM} (sandbox)</option>
                </select>
                <input
                  type="email"
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                  placeholder="custom-prefix@your-verified-domain.com"
                  style={{ padding: 8, fontFamily: "monospace", marginTop: 4 }}
                  required
                />
              </>
            ) : (
              <>
                <input
                  type="email"
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                  placeholder={RESEND_SANDBOX_FROM}
                  style={{ padding: 8, fontFamily: "monospace" }}
                  required
                />
                <span style={{ fontSize: 12, color: "#92400e" }}>
                  No verified domains on this Resend account yet — defaulting to Resend&rsquo;s sandbox sender.
                  This works immediately, but emails come from <code>{RESEND_SANDBOX_FROM}</code> (looks generic, hurts deliverability).
                  Verify a domain at{" "}
                  <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer">resend.com/domains</a>{" "}
                  to send from your own address.
                </span>
              </>
            )}
            {usingSandbox && verifiedDomains && verifiedDomains.length > 0 && (
              <span style={{ fontSize: 12, color: "#92400e" }}>
                Heads up: <code>{RESEND_SANDBOX_FROM}</code> works but is a shared Resend sender. Pick one of your verified domains for branded emails.
              </span>
            )}
          </label>
        </>
      )}

      <button
        type="submit"
        disabled={pendingConnect || !token.trim() || !fromAddress.trim() || pendingPreview}
        style={{ marginTop: 8 }}
      >
        {pendingConnect ? "Connecting…" : "Connect Resend"}
      </button>
      {error && (
        <p style={{ color: "#cc0000", marginTop: 4, fontSize: 14 }}>{error}</p>
      )}
    </form>
  );
}
