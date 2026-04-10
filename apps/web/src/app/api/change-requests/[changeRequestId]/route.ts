import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@stagecraft/db";
import { classifyEditRequest } from "@/lib/classifier";
import { mergePullRequest, closePullRequest } from "@/lib/integrations/github";
import { getDeployPreviewForPR } from "@/lib/integrations/netlify";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ changeRequestId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { changeRequestId } = await params;

  const changeRequest = await prisma.changeRequest.findFirst({
    where: { id: changeRequestId, userId: session.user.id },
    include: {
      site: {
        select: {
          id: true,
          name: true,
          githubRepoOwner: true,
          githubRepoName: true,
          netlifySiteId: true,
        },
      },
      job: {
        select: { id: true, status: true, errorMessage: true },
      },
    },
  });

  if (!changeRequest) {
    return NextResponse.json({ error: "Change request not found" }, { status: 404 });
  }

  // If ready_for_review and no preview URL yet, try fetching from Netlify
  let previewUrl = changeRequest.previewUrl;
  if (
    changeRequest.status === "ready_for_review" &&
    !previewUrl &&
    changeRequest.prNumber &&
    changeRequest.site.netlifySiteId
  ) {
    try {
      const preview = await getDeployPreviewForPR(
        session.user.id,
        changeRequest.site.netlifySiteId,
        changeRequest.prNumber
      );
      if (preview.previewUrl) {
        previewUrl = preview.previewUrl;
        await prisma.changeRequest.update({
          where: { id: changeRequestId },
          data: { previewUrl },
        });
      }
    } catch {
      // Non-fatal — preview discovery is best-effort
    }
  }

  return NextResponse.json({ changeRequest: { ...changeRequest, previewUrl } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ changeRequestId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { changeRequestId } = await params;

  const changeRequest = await prisma.changeRequest.findFirst({
    where: { id: changeRequestId, userId: session.user.id },
    include: {
      site: {
        select: {
          id: true,
          githubRepoOwner: true,
          githubRepoName: true,
          status: true,
        },
      },
    },
  });

  if (!changeRequest) {
    return NextResponse.json({ error: "Change request not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    action?: "approve" | "reject" | "revise";
    requestText?: string;
  };

  const { action } = body;

  if (action !== "approve" && action !== "reject" && action !== "revise") {
    return NextResponse.json({ error: "action must be approve, reject, or revise" }, { status: 400 });
  }

  const { site } = changeRequest;

  if (action === "approve") {
    if (changeRequest.status !== "ready_for_review") {
      return NextResponse.json(
        { error: "Only ready_for_review requests can be approved" },
        { status: 400 }
      );
    }

    if (!changeRequest.prNumber || !site.githubRepoOwner || !site.githubRepoName) {
      return NextResponse.json({ error: "No PR to merge" }, { status: 400 });
    }

    await mergePullRequest(
      session.user.id,
      site.githubRepoOwner,
      site.githubRepoName,
      changeRequest.prNumber
    );

    const updated = await prisma.changeRequest.update({
      where: { id: changeRequestId },
      data: { status: "approved" },
    });

    return NextResponse.json({ changeRequest: updated });
  }

  if (action === "reject") {
    if (changeRequest.status !== "ready_for_review") {
      return NextResponse.json(
        { error: "Only ready_for_review requests can be rejected" },
        { status: 400 }
      );
    }

    if (changeRequest.prNumber && site.githubRepoOwner && site.githubRepoName) {
      try {
        await closePullRequest(
          session.user.id,
          site.githubRepoOwner,
          site.githubRepoName,
          changeRequest.prNumber
        );
      } catch {
        // Non-fatal — PR may already be closed
      }
    }

    const updated = await prisma.changeRequest.update({
      where: { id: changeRequestId },
      data: { status: "rejected" },
    });

    return NextResponse.json({ changeRequest: updated });
  }

  // action === "revise"
  if (!body.requestText?.trim()) {
    return NextResponse.json({ error: "requestText is required for revise" }, { status: 400 });
  }

  const requestText = body.requestText.trim();

  if (requestText.length > 1000) {
    return NextResponse.json(
      { error: "requestText must be 1000 characters or fewer" },
      { status: 400 }
    );
  }

  // Discard the current request
  await prisma.changeRequest.update({
    where: { id: changeRequestId },
    data: { status: "discarded" },
  });

  // Close the existing PR if open
  if (changeRequest.prNumber && site.githubRepoOwner && site.githubRepoName) {
    try {
      await closePullRequest(
        session.user.id,
        site.githubRepoOwner,
        site.githubRepoName,
        changeRequest.prNumber
      );
    } catch {
      // Non-fatal
    }
  }

  const classifiedMode = classifyEditRequest(requestText);

  // Create a fresh change request
  const newChangeRequest = await prisma.changeRequest.create({
    data: {
      siteId: site.id,
      userId: session.user.id,
      requestText,
      classifiedMode,
      status: "pending",
    },
  });

  const job = await prisma.siteJob.create({
    data: {
      siteId: site.id,
      userId: session.user.id,
      type: "edit_site",
      status: "queued",
      requestPayload: {
        changeRequestId: newChangeRequest.id,
        requestText,
        classifiedMode,
      },
    },
  });

  await prisma.changeRequest.update({
    where: { id: newChangeRequest.id },
    data: { jobId: job.id },
  });

  return NextResponse.json(
    { changeRequest: { ...newChangeRequest, jobId: job.id } },
    { status: 201 }
  );
}
