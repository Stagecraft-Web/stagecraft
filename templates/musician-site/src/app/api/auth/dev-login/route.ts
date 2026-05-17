import { NextResponse } from "next/server";

import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
} from "@/lib/auth";

/**
 * Dev-only escape hatch: POST email, get a session cookie back
 * without the magic-link round-trip. 404 in production.
 *
 * Surfaces as a button on /admin/login when NODE_ENV !== "production"
 * so a fresh clone can sign into /admin without configuring any env
 * vars or clicking through a magic-link URL in the dev console.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const formData = await request.formData();
  const submitted = String(formData.get("email") ?? "").trim().toLowerCase();
  const allowed = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  // Prefer ADMIN_EMAIL when set so the session matches the production
  // contract; otherwise accept whatever the form sent, then fall back
  // to a sentinel so a clone with no env vars and an empty form still
  // gets a usable session.
  const email = allowed || submitted || "dev@localhost";

  const session = await createSessionToken(email);
  const response = NextResponse.redirect(new URL("/admin", request.url), 303);
  response.cookies.set(SESSION_COOKIE, session, SESSION_COOKIE_OPTIONS);
  return response;
}
