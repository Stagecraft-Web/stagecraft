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
}

/**
 * Validate a Resend API key by listing domains. Returns the list (status
 * included) so the UI can suggest verified sender addresses. Throws on
 * any non-2xx response.
 */
export async function validateResendToken(token: string): Promise<ResendTokenInfo> {
  const res = await fetch(`${RESEND_API}/domains`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
  const json = (await res.json()) as { data?: ResendDomain[] };
  return { domains: json.data ?? [] };
}

export interface ResendCredentials {
  apiKey: string;
  fromAddress: string;
}

/**
 * Look up the artist's connected Resend credentials for `userId`. Used
 * by `handleCreateSite` to provision env vars on the new artist site.
 * Returns null when the artist hasn't connected Resend.
 */
export async function getResendCredentials(userId: string): Promise<ResendCredentials | null> {
  const integration = await prisma.integrationAccount.findUnique({
    where: { userId_provider: { userId, provider: "resend" } },
  });
  if (!integration?.accessToken) return null;
  const meta = (integration.metadata as { fromAddress?: string } | null) ?? null;
  if (!meta?.fromAddress) return null;
  return { apiKey: integration.accessToken, fromAddress: meta.fromAddress };
}
