import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@stagecraft/db";

type Params = { params: Promise<{ siteId: string; assetId: string }> };

/** Serve the raw image binary for use in <img> tags. */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { siteId, assetId } = await params;

  const asset = await prisma.assetUpload.findFirst({
    where: { id: assetId, siteId, site: { userId: session.user.id } },
    select: { mimeType: true, temporaryStorageRef: true },
  });

  if (!asset?.temporaryStorageRef) {
    return new Response("Not found", { status: 404 });
  }

  // temporaryStorageRef is stored as a data URL: "data:<mime>;base64,<data>"
  const commaIdx = asset.temporaryStorageRef.indexOf(",");
  if (commaIdx === -1) {
    return new Response("Corrupt asset data", { status: 500 });
  }

  const base64Data = asset.temporaryStorageRef.slice(commaIdx + 1);
  const buffer = Buffer.from(base64Data, "base64");

  return new Response(buffer, {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}

/** Update alt, caption, credit, usageSlot for an asset. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId, assetId } = await params;

  const asset = await prisma.assetUpload.findFirst({
    where: { id: assetId, siteId, site: { userId: session.user.id } },
  });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    alt?: string;
    caption?: string;
    credit?: string;
    usageSlot?: string | null;
  };

  const VALID_SLOTS = new Set(["hero", "gallery", "about", "press", "logo", ""]);
  if (body.usageSlot !== undefined && !VALID_SLOTS.has(body.usageSlot ?? "")) {
    return NextResponse.json(
      { error: "usageSlot must be one of: hero, gallery, about, press, logo" },
      { status: 422 }
    );
  }

  const updated = await prisma.assetUpload.update({
    where: { id: assetId },
    data: {
      ...(body.alt !== undefined && { alt: body.alt.trim() || null }),
      ...(body.caption !== undefined && { caption: body.caption.trim() || null }),
      ...(body.credit !== undefined && { credit: body.credit.trim() || null }),
      ...(body.usageSlot !== undefined && { usageSlot: body.usageSlot || null }),
    },
    select: {
      id: true,
      originalFilename: true,
      normalizedFilename: true,
      mimeType: true,
      fileSize: true,
      uploadStatus: true,
      targetRepoPath: true,
      alt: true,
      caption: true,
      credit: true,
      usageSlot: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ asset: updated });
}

/** Delete an asset record and its stored data. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { siteId, assetId } = await params;

  const asset = await prisma.assetUpload.findFirst({
    where: { id: assetId, siteId, site: { userId: session.user.id } },
  });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  await prisma.assetUpload.delete({ where: { id: assetId } });

  return NextResponse.json({ deleted: true });
}
