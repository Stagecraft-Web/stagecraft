import { NextResponse } from "next/server";

import { prisma } from "@stagecraft/db";

import { auth } from "@/lib/auth";
import { buildInstallUrl } from "@/lib/install-url";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId } = await params;
  const site = await prisma.site.findFirst({
    where: { id: siteId, userId: session.user.id },
    select: { id: true },
  });
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  try {
    const url = await buildInstallUrl({ siteId: site.id, userId: session.user.id });
    return NextResponse.json({ url });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json({ error: `Install URL not configured: ${message}` }, { status: 500 });
  }
}
