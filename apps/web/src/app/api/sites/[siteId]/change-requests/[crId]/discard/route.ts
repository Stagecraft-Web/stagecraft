import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@stagecraft/db";

interface Params {
  siteId: string;
  crId: string;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId, crId } = await params;

  const cr = await prisma.changeRequest.findFirst({
    where: { id: crId, siteId, userId: session.user.id },
  });

  if (!cr) {
    return NextResponse.json({ error: "Change request not found" }, { status: 404 });
  }

  if (cr.status === "discarded") {
    return NextResponse.json({ error: "Already discarded" }, { status: 422 });
  }

  if (cr.status === "approved") {
    return NextResponse.json(
      { error: "Approved change requests cannot be discarded" },
      { status: 422 }
    );
  }

  await prisma.changeRequest.update({
    where: { id: crId },
    data: { status: "discarded" },
  });

  return NextResponse.json({ ok: true });
}
