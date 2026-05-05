import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { validateResendToken } from "@/lib/integrations/resend";

/**
 * Probe a not-yet-stored Resend API key for the artist's verified
 * domains. Used by the /settings → Connect Resend form to populate the
 * sender-address dropdown immediately after key paste, so the artist
 * doesn't have to remember/copy a domain name.
 *
 * Read-only: the key is not persisted by this route — only by /connect.
 * Auth-gated to the platform (must be signed in) so it can't be used as
 * a generic Resend-key probing oracle.
 */
const previewSchema = z.object({
  token: z.string().trim().min(1, "API key is required"),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  let info;
  try {
    info = await validateResendToken(parsed.data.token);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json(
      { error: `Resend rejected the API key: ${message}` },
      { status: 400 },
    );
  }

  const verifiedDomains = info.domains
    .filter((d) => d.status === "verified")
    .map((d) => d.name);

  return NextResponse.json({ ok: true, verifiedDomains });
}
