import { NextResponse } from "next/server";

import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
  verifyMagicLinkToken,
} from "@/lib/auth";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login?error=missing", request.url));
  }

  const result = await verifyMagicLinkToken(token);
  if (!result) {
    return NextResponse.redirect(new URL("/admin/login?error=invalid", request.url));
  }

  const session = await createSessionToken(result.email);
  const response = NextResponse.redirect(new URL("/admin", request.url));
  response.cookies.set(SESSION_COOKIE, session, SESSION_COOKIE_OPTIONS);
  return response;
}
