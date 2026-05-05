import { prisma } from "@stagecraft/db";

/**
 * Resend integration — each artist connects their own Resend account at
 * /settings → Connect Resend. The platform stores the API key + their
 * preferred from-address; at /create time we provision both as env vars
 * on the new site (`RESEND_API_KEY`, `MAGIC_LINK_FROM`) so the artist
 * site sends magic-link emails directly from the artist's own Resend
 * account. The platform never sees recipient addresses or sends mail
 * on the artist's behalf.
 */

const RESEND_API = "https://api.resend.com";

export interface ResendDomain {
  id: string;
  name: string;
  status: "pending" | "verified" | "temporary_failure" | "failed" | string;
}

export interface ResendTokenInfo {
  domains: ResendDomain[];
  /**
   * True when the API key is restricted to sending only — Resend hands
   * these out by default at signup ("Sending access" keys), and they
   * can't list domains. The artist can still send via Resend's sandbox
   * sender (`onboarding@resend.dev`) without giving us a full-access
   * key. Domains is always [] when restricted.
   */
  restricted: boolean;
}

/**
 * Validate a Resend API key by listing domains. Returns the list (status
 * included) so the UI can suggest verified sender addresses. Returns
 * `restricted: true` (not throwing) when the key is send-only —
 * the connect flow handles that by forcing the Resend sandbox sender.
 * Throws on any other non-2xx response.
 */
export async function validateResendToken(token: string): Promise<ResendTokenInfo> {
  const res = await fetch(`${RESEND_API}/domains`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) {
      try {
        const parsed = JSON.parse(body) as { name?: string };
        if (parsed.name === "restricted_api_key") {
          return { domains: [], restricted: true };
        }
      } catch {
        // fall through to generic error
      }
    }
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
  const json = (await res.json()) as { data?: ResendDomain[] };
  return { domains: json.data ?? [], restricted: false };
}

export interface ResendCredentials {
  apiKey: string;
  fromAddress: string;
}

/**
 * Look up the artist's connected Resend credentials for `userId`. Used
 * by `handleCreateSite` to provision env vars on the new artist site.
 * Returns null when the artist hasn't connected Resend.
 *
 * The verified admin email lives on `User.email` — the Resend connect
 * flow writes it there as part of the same transaction, so callers
 * read it from the User row, not from this struct.
 */
export async function getResendCredentials(userId: string): Promise<ResendCredentials | null> {
  const integration = await prisma.integrationAccount.findUnique({
    where: { userId_provider: { userId, provider: "resend" } },
  });
  if (!integration?.accessToken) return null;
  const meta = (integration.metadata as { fromAddress?: string } | null) ?? null;
  if (!meta?.fromAddress) return null;
  return {
    apiKey: integration.accessToken,
    fromAddress: meta.fromAddress,
  };
}

/**
 * Send a transactional email via Resend. Used at /settings → Connect
 * Resend to send the verification code to the artist's chosen admin
 * email; the artist site itself sends magic-link emails directly via
 * `resend` SDK from its template code.
 */
export async function sendResendEmail(args: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const res = await fetch(`${RESEND_API}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from,
      to: args.to,
      subject: args.subject,
      text: args.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend send failed (${res.status}): ${body}`);
  }
}
