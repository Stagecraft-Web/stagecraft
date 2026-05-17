import { NextResponse } from "next/server";

import { createMagicLinkToken } from "@/lib/auth";
import { sendMagicLink } from "@/lib/email";

const isDev = process.env.NODE_ENV !== "production";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  const sentRedirect = NextResponse.redirect(new URL("/admin/login?sent=1", request.url), 303);

  const allowed = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!allowed) {
    if (!isDev) {
      // Production: silently no-op to avoid signalling that the site
      // is misconfigured.
      return sentRedirect;
    }
    console.warn(
      "[auth] ADMIN_EMAIL not set — dev fallback: sending magic link to " +
        `"${email}". Set ADMIN_EMAIL in .env.local for production-style ` +
        "lock-down to a single allowed email.",
    );
  } else if (email !== allowed) {
    if (isDev) {
      console.warn(
        `[auth] Email "${email}" doesn't match ADMIN_EMAIL ("${allowed}"). ` +
          "No magic link sent. (Production silently accepts any email to prevent enumeration.)",
      );
    }
    return sentRedirect;
  }

  const token = await createMagicLinkToken(email);
  const origin = new URL(request.url).origin;
  const url = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}`;
  await sendMagicLink(email, url);

  return sentRedirect;
}
