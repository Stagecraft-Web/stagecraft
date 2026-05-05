"use client";

import { useState } from "react";

type ConnectResendProps = {
  /** When provided, shows the connected state + Disconnect. */
  connectedFromAddress?: string | null;
  connectedAdminEmail?: string | null;
  /**
   * Where to send the artist after a successful connect. Defaults to
   * the settings page's own success-banner route; the /onboarding flow
   * overrides to "/dashboard" so the first-time setup hands the artist
   * to the dashboard instead of looping back to /settings.
   */
  successRedirect?: string;
};

const RESEND_SANDBOX_FROM = "onboarding@resend.dev";

type Phase = "key" | "sender" | "verify";

/**
 * Three-phase connect flow:
 *   1. Paste API key → preview verified domains.
 *   2. Pick sender + enter admin email → /verify-send fires a code.
 *   3. Enter code → /connect persists the integration.
 *
 * The third step proves the artist actually receives mail at the
 * configured admin address through the configured Resend setup, so the
 * sandbox-sender silent-drop trap can't catch them on first sign-in.
 */
export function ConnectResend({
  connectedFromAddress,
  connectedAdminEmail,
  successRedirect = "/settings?success=resend_connected",
}: ConnectResendProps) {
  const [phase, setPhase] = useState<Phase>("key");
  const [token, setToken] = useState("");
  const [verifiedDomains, setVerifiedDomains] = useState<string[] | null>(null);
  const [restricted, setRestricted] = useState(false);
  const [fromAddress, setFromAddress] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingDisconnect, setPendingDisconnect] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetToKey() {
    setPhase("key");
    setVerifiedDomains(null);
    setRestricted(false);
    setFromAddress("");
    setAdminEmail("");
    setVerificationToken("");
    setCode("");
    setError(null);
  }

  async function handleLookupDomains() {
    if (!token.trim()) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/resend/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = (await res.json()) as {
        error?: string;
        verifiedDomains?: string[];
        restricted?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Failed to look up Resend domains");
        setPending(false);
        return;
      }
      const domains = data.verifiedDomains ?? [];
      const isRestricted = data.restricted ?? false;
      setVerifiedDomains(domains);
      setRestricted(isRestricted);
      setFromAddress(
        isRestricted || domains.length === 0
          ? RESEND_SANDBOX_FROM
          : `noreply@${domains[0]}`,
      );
      setPhase("sender");
      setPending(false);
    } catch {
      setError("Network error looking up Resend domains");
      setPending(false);
    }
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/resend/verify-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          fromAddress: fromAddress.trim(),
          adminEmail: adminEmail.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string; verificationToken?: string };
      if (!res.ok || !data.verificationToken) {
        setError(data.error ?? "Failed to send verification code");
        setPending(false);
        return;
      }
      setVerificationToken(data.verificationToken);
      setPhase("verify");
      setPending(false);
    } catch {
      setError("Network error sending verification code");
      setPending(false);
    }
  }

  async function handleConfirmCode(e: React.FormEvent) {
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
          verificationToken,
          code: code.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to connect Resend");
        setPending(false);
        return;
      }
      window.location.assign(successRedirect);
    } catch {
      setError("Network error connecting to Resend");
      setPending(false);
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
          {connectedAdminEmail && (
            <>
              {" "}
              to <strong>{connectedAdminEmail}</strong>
            </>
          )}
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

  const noVerifiedDomainOptions = restricted || (verifiedDomains?.length ?? 0) === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
            if (phase !== "key") resetToKey();
          }}
          onBlur={() => {
            if (phase === "key") handleLookupDomains();
          }}
          placeholder="re_…"
          required
          autoComplete="off"
          spellCheck={false}
          disabled={phase !== "key" || pending}
          style={{ padding: 8, fontFamily: "monospace" }}
        />
        {pending && phase === "key" && (
          <span style={{ fontSize: 12, color: "#666" }}>Checking key…</span>
        )}
      </label>

      {phase !== "key" && (
        <form onSubmit={handleSendCode} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Sender</span>
            {!noVerifiedDomainOptions && verifiedDomains && verifiedDomains.length > 0 ? (
              <>
                <select
                  value={fromAddress.startsWith("noreply@") ? fromAddress.slice("noreply@".length) : "__custom__"}
                  onChange={(e) => {
                    if (e.target.value === RESEND_SANDBOX_FROM) {
                      setFromAddress(RESEND_SANDBOX_FROM);
                    } else if (e.target.value === "__custom__") {
                      // keep current
                    } else {
                      setFromAddress(`noreply@${e.target.value}`);
                    }
                  }}
                  disabled={phase === "verify" || pending}
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
                  required
                  disabled={phase === "verify" || pending}
                  style={{ padding: 8, fontFamily: "monospace", marginTop: 4 }}
                />
              </>
            ) : (
              <>
                <input
                  type="email"
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                  placeholder={RESEND_SANDBOX_FROM}
                  required
                  readOnly={restricted}
                  disabled={phase === "verify" || pending}
                  style={{ padding: 8, fontFamily: "monospace" }}
                />
                {restricted ? (
                  <span style={{ fontSize: 12, color: "#92400e" }}>
                    Resend gave you a <strong>send-only</strong> API key (the default at signup). It can send via
                    Resend&rsquo;s sandbox sender <code>{RESEND_SANDBOX_FROM}</code> right away. To send from your own domain, generate a
                    Full-access key at{" "}
                    <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer">resend.com/api-keys</a>{" "}
                    and verify a domain at{" "}
                    <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer">resend.com/domains</a>.
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: "#92400e" }}>
                    No verified domains on this Resend account yet — defaulting to Resend&rsquo;s sandbox sender.
                    This works immediately, but emails come from a generic Resend address.
                    Verify a domain at{" "}
                    <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer">resend.com/domains</a>{" "}
                    to send from your own address.
                  </span>
                )}
              </>
            )}
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Admin email</span>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={phase === "verify" || pending}
              style={{ padding: 8, fontFamily: "monospace" }}
            />
            <span style={{ fontSize: 12, color: "#666" }}>
              Where magic-link sign-in emails go for every artist site you create. We&rsquo;ll send a one-time code here to verify it&rsquo;s reachable.
            </span>
          </label>

          {phase === "sender" && (
            <button
              type="submit"
              disabled={pending || !fromAddress.trim() || !adminEmail.trim()}
              style={{ marginTop: 4 }}
            >
              {pending ? "Sending code…" : "Send verification code"}
            </button>
          )}
        </form>
      )}

      {phase === "verify" && (
        <form onSubmit={handleConfirmCode} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Verification code</span>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="\d{6}"
              style={{ padding: 8, fontFamily: "monospace", letterSpacing: 4, fontSize: 18 }}
            />
            <span style={{ fontSize: 12, color: "#666" }}>
              Check <strong>{adminEmail}</strong> for the 6-digit code (expires in 10 min). Didn&rsquo;t arrive?{" "}
              <button
                type="button"
                onClick={() => {
                  setPhase("sender");
                  setCode("");
                  setError(null);
                }}
                style={{ background: "none", border: "none", color: "#0070f3", padding: 0, cursor: "pointer" }}
              >
                Change email and resend
              </button>
            </span>
          </label>
          <button type="submit" disabled={pending || code.length !== 6}>
            {pending ? "Connecting…" : "Connect Resend"}
          </button>
        </form>
      )}

      {error && (
        <p style={{ color: "#cc0000", marginTop: 4, fontSize: 14 }}>{error}</p>
      )}
    </div>
  );
}
