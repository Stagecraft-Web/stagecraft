import { NextResponse } from "next/server";

import { createMagicLinkToken } from "@/lib/auth";
import { sendMagicLink } from "@/lib/email";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  const sentRedirect = NextResponse.redirect(new URL("/admin/login?sent=1", request.url), 303);

  const allowed = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!allowed || email !== allowed) {
    return sentRedirect;
  }

  const token = await createMagicLinkToken(email);
  const origin = new URL(request.url).origin;
  const url = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}`;
  await sendMagicLink(email, url);

  return sentRedirect;
}
