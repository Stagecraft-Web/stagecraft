import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@stagecraft/db";

import { auth } from "@/lib/auth";
import { validateResendToken } from "@/lib/integrations/resend";

/**
 * Connect a Resend account so the artist's musician sites can send
 * magic-link auth emails using the artist's *own* Resend account — no
 * shared platform-side key. Validates the token by listing domains
 * (also confirms the chosen `fromAddress` lives under one of the
 * artist's verified domains, so misconfigurations are caught at
 * connect time instead of at first login attempt).
 */
const connectSchema = z.object({
  token: z.string().trim().min(1, "API key is required"),
  fromAddress: z
    .string()
    .trim()
    .toLowerCase()
    .email("Sender address must be a valid email"),
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

  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { token, fromAddress } = parsed.data;

  let info;
  try {
    info = await validateResendToken(token);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json(
      { error: `Resend rejected the API key: ${message}` },
      { status: 400 },
    );
  }

  // Require the from-address's domain to be either:
  //   (a) one of the artist's verified Resend domains, or
  //   (b) `resend.dev` — Resend's pre-verified sandbox sender, available
  //       to every account (including send-only API keys). We accept this
  //       so artists who haven't verified a custom domain can still ship
  //       working magic-link auth on day one — emails come from
  //       `onboarding@resend.dev` (looks generic, hurts deliverability),
  //       but it unblocks them.
  // Catching this here avoids shipping a site whose first login attempt
  // fails with Resend's "domain not verified" error.
  //
  // When the key is restricted (send-only), we can't verify domain
  // membership at all, so only the sandbox sender is accepted — anything
  // else would silently fail at first send.
  const fromDomain = fromAddress.split("@")[1] ?? "";
  const isResendSandbox = fromDomain === "resend.dev";
  const hasVerifiedDomain = info.domains.some(
    (d) => d.status === "verified" && d.name.toLowerCase() === fromDomain,
  );
  if (info.restricted && !isResendSandbox) {
    return NextResponse.json(
      {
        error:
          "This API key is restricted to sending only — we can't verify your custom domains. Use `onboarding@resend.dev` as the sender, or generate a Full-access key at resend.com/api-keys to enable a custom domain.",
      },
      { status: 400 },
    );
  }
  if (!hasVerifiedDomain && !isResendSandbox) {
    const verified = info.domains
      .filter((d) => d.status === "verified")
      .map((d) => d.name);
    const hint = verified.length
      ? `Verified domains on this Resend account: ${verified.join(", ")}.`
      : "No verified domains on this Resend account yet — use `onboarding@resend.dev` to ship now, or add a custom domain at resend.com/domains.";
    return NextResponse.json(
      {
        error: `Sender address @${fromDomain} isn't on a verified Resend domain. ${hint}`,
      },
      { status: 400 },
    );
  }

  await prisma.integrationAccount.upsert({
    where: {
      userId_provider: { userId: session.user.id, provider: "resend" },
    },
    update: {
      accessToken: token,
      providerAccountId: fromAddress,
      metadata: { fromAddress },
      updatedAt: new Date(),
    },
    create: {
      userId: session.user.id,
      provider: "resend",
      providerAccountId: fromAddress,
      accessToken: token,
      metadata: { fromAddress },
    },
  });

  return NextResponse.json({ ok: true, fromAddress });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.integrationAccount.deleteMany({
    where: { userId: session.user.id, provider: "resend" },
  });

  return NextResponse.json({ ok: true });
}
