import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@stagecraft/db";
import { classifyEditRequest } from "@/lib/classifier";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId } = await params;

  const site = await prisma.site.findFirst({
    where: { id: siteId, userId: session.user.id },
  });

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  if (site.status !== "active") {
    return NextResponse.json(
      { error: "Edit requests can only be submitted for active sites" },
      { status: 400 }
    );
  }

  const body = (await req.json()) as { requestText?: string };

  if (!body.requestText?.trim()) {
    return NextResponse.json({ error: "requestText is required" }, { status: 400 });
  }

  const requestText = body.requestText.trim();

  if (requestText.length > 1000) {
    return NextResponse.json(
      { error: "requestText must be 1000 characters or fewer" },
      { status: 400 }
    );
  }

  const classifiedMode = classifyEditRequest(requestText);

  // Create the ChangeRequest first so we have its id for the branch name
  const changeRequest = await prisma.changeRequest.create({
    data: {
      siteId,
      userId: session.user.id,
      requestText,
      classifiedMode,
      status: "pending",
    },
  });

  // Enqueue the edit_site job
  const job = await prisma.siteJob.create({
    data: {
      siteId,
      userId: session.user.id,
      type: "edit_site",
      status: "queued",
      requestPayload: {
        changeRequestId: changeRequest.id,
        requestText,
        classifiedMode,
      },
    },
  });

  // Link the job to the change request
  await prisma.changeRequest.update({
    where: { id: changeRequest.id },
    data: { jobId: job.id },
  });

  return NextResponse.json({ changeRequest: { ...changeRequest, jobId: job.id } }, { status: 201 });
}

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
  });

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const changeRequests = await prisma.changeRequest.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ changeRequests });
}
