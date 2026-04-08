import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateState, getNetlifyOAuthUrl } from "@/lib/integrations/oauth";
import { cookies } from "next/headers";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = generateState();
  const cookieStore = await cookies();
  cookieStore.set("netlify_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(getNetlifyOAuthUrl(state));
}
