import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@stagecraft/db";
import { enqueue } from "@stagecraft/queue";

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
    include: { job: true },
  });

  if (!cr) {
    return NextResponse.json({ error: "Change request not found" }, { status: 404 });
  }

  if (!cr.job || cr.job.status !== "failed") {
    return NextResponse.json(
      { error: "Only failed jobs can be retried" },
      { status: 422 }
    );
  }

  const newJob = await enqueue({
    siteId,
    userId: session.user.id,
    type: cr.job.type as Parameters<typeof enqueue>[0]["type"],
    payload: (cr.job.requestPayload as Record<string, unknown>) ?? { changeRequestId: crId },
  });

  await prisma.changeRequest.update({
    where: { id: crId },
    data: {
      jobId: newJob.id,
      status: "in_progress",
      failureCategory: null,
    },
  });

  return NextResponse.json({ jobId: newJob.id }, { status: 201 });
}
