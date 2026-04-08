import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@stagecraft/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId } = await params;

  const site = await prisma.site.findFirst({
    where: { id: siteId, userId: session.user.id },
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  return NextResponse.json({ site });
}
