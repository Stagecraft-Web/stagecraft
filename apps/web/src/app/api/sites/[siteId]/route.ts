import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@stagecraft/db";
import { deleteRepo, setRepoArchived } from "@/lib/integrations/github";
import { deleteSite as deleteNetlifySite } from "@/lib/integrations/netlify";

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId } = await params;
  const body = await req.json();
  const { action } = body as { action: "archive" | "unarchive" };

  if (action !== "archive" && action !== "unarchive") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const site = await prisma.site.findFirst({
    where: { id: siteId, userId: session.user.id },
  });

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const archiving = action === "archive";
  const errors: string[] = [];

  // Archive/unarchive GitHub repo
  if (site.githubRepoOwner && site.githubRepoName) {
    try {
      await setRepoArchived(session.user.id, site.githubRepoOwner, site.githubRepoName, archiving);
    } catch (e) {
      errors.push(`GitHub: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }

  // Update site status
  await prisma.site.update({
    where: { id: siteId },
    data: {
      status: archiving ? "archived" : "active",
      archivedAt: archiving ? new Date() : null,
    },
  });

  return NextResponse.json({ site: { id: siteId, status: archiving ? "archived" : "active" }, errors });
}

export async function DELETE(
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

  const errors: string[] = [];

  // Best-effort cleanup of external resources
  if (site.githubRepoOwner && site.githubRepoName) {
    try {
      await deleteRepo(session.user.id, site.githubRepoOwner, site.githubRepoName);
    } catch (e) {
      const msg = `GitHub: ${e instanceof Error ? e.message : "unknown error"}`;
      console.error(`[delete-site] ${msg}`);
      errors.push(msg);
    }
  }

  if (site.netlifySiteId) {
    try {
      await deleteNetlifySite(session.user.id, site.netlifySiteId);
    } catch (e) {
      const msg = `Netlify: ${e instanceof Error ? e.message : "unknown error"}`;
      console.error(`[delete-site] ${msg}`);
      errors.push(msg);
    }
  }

  // Delete jobs first (FK constraint), then the site
  await prisma.siteJob.deleteMany({ where: { siteId } });
  await prisma.site.delete({ where: { id: siteId } });

  return NextResponse.json({ deleted: true, errors });
}
