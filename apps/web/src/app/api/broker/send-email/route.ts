import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@stagecraft/db";

import { brokerSecretMatches } from "@/lib/broker-secret";
import { sendBrokeredEmail } from "@/lib/email-broker";

const requestSchema = z.object({
  siteId: z.string().min(1),
  to: z.string().trim().email(),
  subject: z.string().min(1).max(200),
  text: z.string().min(1).max(10_000),
});

type ErrorCode =
  | "missing-bearer"
  | "invalid-body"
  | "site-not-found"
  | "invalid-secret"
  | "send-failed"
  | "not-configured"
  | "to-not-allowed";

function err(status: number, code: ErrorCode, message?: string) {
  return NextResponse.json({ ok: false, code, error: message }, { status });
}

function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/**
 * Broker route: send a transactional email on behalf of an artist site
 * using the platform's shared Resend account. Replaces per-site
 * RESEND_API_KEY env vars and stops the platform's API key from being
 * exposed to every artist deployment.
 *
 * Auth mirrors /api/publish-token: per-site STAGECRAFT_BROKER_SECRET as
 * Bearer + STAGECRAFT_SITE_ID in the body to look up the Site, then a
 * constant-time hash compare.
 *
 * Anti-abuse: the `to` address must match the Site's `adminEmail` (or
 * historically: the email associated with the User who owns the site).
 * This pins the broker to magic-link / admin notifications and stops it
 * from being used as a generic relay.
 */
export async function POST(request: Request) {
  const secret = extractBearer(request.headers.get("authorization"));
  if (!secret) return err(401, "missing-bearer");

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return err(400, "invalid-body", "Body must be JSON.");
  }

  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return err(400, "invalid-body", parsed.error.message);
  }

  const site = await prisma.site.findUnique({
    where: { id: parsed.data.siteId },
    include: { user: { select: { email: true } } },
  });
  if (!site) return err(404, "site-not-found");
  if (!site.brokerSecretHash || !brokerSecretMatches(secret, site.brokerSecretHash)) {
    return err(401, "invalid-secret");
  }

  // Restrict `to` to the site owner's email. Admin notifications (magic
  // link sign-in) only ever go to the artist themselves; anything else
  // would turn this into an open relay.
  const ownerEmail = site.user.email?.toLowerCase().trim();
  if (!ownerEmail || parsed.data.to.toLowerCase().trim() !== ownerEmail) {
    return err(403, "to-not-allowed", "Recipient must be the site owner's email.");
  }

  const result = await sendBrokeredEmail({
    to: parsed.data.to,
    subject: parsed.data.subject,
    text: parsed.data.text,
  });
  if (!result.ok) {
    return err(result.code === "not-configured" ? 503 : 502, result.code, result.message);
  }
  return NextResponse.json({ ok: true, messageId: result.messageId });
}
