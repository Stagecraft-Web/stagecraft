import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { sendResendEmail, validateResendToken } from "@/lib/integrations/resend";
import {
  generateVerificationCode,
  signVerificationToken,
} from "@/lib/resend-verification";

/**
 * Step 1 of the Resend connect flow: send a one-time verification code
 * to the artist's chosen admin email, using their own Resend account.
 *
 * Why: that artist site's `ADMIN_EMAIL` env var = magic-link recipient,
 * and we need to *prove* the artist can actually receive mail at that
 * address through the Resend setup they're configuring. Without this,
 * a user could pick the sandbox sender + a non-Resend-account email,
 * and every magic-link would get silently dropped by Resend's sandbox.
 *
 * Returns a signed verification token containing the code (HS256, 10
 * min TTL); client echoes it back at /connect along with what the user
 * typed.
 */
const sendSchema = z.object({
  token: z.string().trim().min(1, "API key is required"),
  fromAddress: z
    .string()
    .trim()
    .toLowerCase()
    .email("Sender address must be a valid email"),
  adminEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Admin email must be a valid email"),
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

  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { token, fromAddress, adminEmail } = parsed.data;

  // Validate the API key first (cheap; surfaces "wrong key" before we
  // try to send). Tolerates restricted (send-only) keys.
  try {
    await validateResendToken(token);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json(
      { error: `Resend rejected the API key: ${message}` },
      { status: 400 },
    );
  }

  const code = generateVerificationCode();

  try {
    await sendResendEmail({
      apiKey: token,
      from: fromAddress,
      to: adminEmail,
      subject: "Stagecraft: confirm your admin email",
      text:
        `Your Stagecraft verification code is: ${code}\n\n` +
        "Enter this in the Stagecraft Connect Resend form to finish wiring up your account.\n\n" +
        "If you didn't initiate this, you can ignore this email — the code expires in 10 minutes.",
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json(
      { error: `Couldn't send the verification email: ${message}` },
      { status: 502 },
    );
  }

  const verificationToken = await signVerificationToken({
    adminEmail,
    code,
    userId: session.user.id,
  });

  return NextResponse.json({ ok: true, verificationToken, sentTo: adminEmail });
}
