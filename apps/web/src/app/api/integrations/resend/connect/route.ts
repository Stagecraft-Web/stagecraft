import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@stagecraft/db";

import { auth } from "@/lib/auth";
import { validateResendToken } from "@/lib/integrations/resend";
import { verifyVerificationToken } from "@/lib/resend-verification";

/**
 * Step 2 of the Resend connect flow. Step 1 (POST /verify-send) sent a
 * one-time code to the chosen admin email and returned a signed
 * `verificationToken`. Here we:
 *
 *   1. Re-validate the API key (defense — request body is client-controlled).
 *   2. Re-check the chosen sender against the artist's verified Resend
 *      domains (or accept the `resend.dev` sandbox sender as a fallback).
 *   3. Verify the JWT + match the user-entered code against what we
 *      embedded at /verify-send. This proves the artist actually
 *      receives mail at adminEmail through the configured Resend setup
 *      (no silent sandbox-drop on first sign-in).
 *   4. Persist `IntegrationAccount{provider:"resend"}` with both
 *      fromAddress and adminEmail in metadata. handleCreateSite reads
 *      adminEmail to provision ADMIN_EMAIL on each new artist site.
 */
const connectSchema = z.object({
  token: z.string().trim().min(1, "API key is required"),
  fromAddress: z
    .string()
    .trim()
    .toLowerCase()
    .email("Sender address must be a valid email"),
  verificationToken: z.string().min(1, "Verification token is required"),
  code: z.string().trim().regex(/^\d{6}$/, "Code must be 6 digits"),
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

  const { token, fromAddress, verificationToken, code } = parsed.data;

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

  // Sender domain check — see comment in verify-send route for context.
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

  const verification = await verifyVerificationToken(verificationToken);
  if (!verification) {
    return NextResponse.json(
      {
        error:
          "Verification link expired or invalid — request a new code.",
      },
      { status: 400 },
    );
  }
  if (verification.userId !== session.user.id) {
    return NextResponse.json(
      { error: "Verification token belongs to a different user." },
      { status: 403 },
    );
  }
  if (verification.code !== code) {
    return NextResponse.json(
      { error: "Code didn't match — check the email and try again." },
      { status: 400 },
    );
  }

  const adminEmail = verification.adminEmail;

  await prisma.integrationAccount.upsert({
    where: {
      userId_provider: { userId: session.user.id, provider: "resend" },
    },
    update: {
      accessToken: token,
      providerAccountId: adminEmail,
      metadata: { fromAddress, adminEmail },
      updatedAt: new Date(),
    },
    create: {
      userId: session.user.id,
      provider: "resend",
      providerAccountId: adminEmail,
      accessToken: token,
      metadata: { fromAddress, adminEmail },
    },
  });

  return NextResponse.json({ ok: true, fromAddress, adminEmail });
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
