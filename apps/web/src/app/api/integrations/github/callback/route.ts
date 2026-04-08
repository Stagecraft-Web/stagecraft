import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exchangeGitHubCode } from "@/lib/integrations/oauth";
import { prisma } from "@stagecraft/db";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const storedState = cookieStore.get("github_oauth_state")?.value;

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(
      new URL("/settings?error=github_invalid_state", req.url)
    );
  }

  cookieStore.delete("github_oauth_state");

  try {
    const accessToken = await exchangeGitHubCode(code);

    // Fetch GitHub user info to get provider account ID
    const ghUser = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then((r) => r.json() as Promise<{ id: number; login: string }>);

    await prisma.integrationAccount.upsert({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider: "github",
        },
      },
      update: {
        accessToken,
        providerAccountId: String(ghUser.id),
        metadata: { login: ghUser.login },
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        provider: "github",
        providerAccountId: String(ghUser.id),
        accessToken,
        scopes: "repo",
        metadata: { login: ghUser.login },
      },
    });

    return NextResponse.redirect(
      new URL("/settings?success=github_connected", req.url)
    );
  } catch (error) {
    console.error("GitHub OAuth error:", error);
    return NextResponse.redirect(
      new URL("/settings?error=github_failed", req.url)
    );
  }
}
