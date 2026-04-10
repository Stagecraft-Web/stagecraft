import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@stagecraft/db";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function normalizeFilename(original: string): string {
  const parts = original.split(".");
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : "";
  const base = parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  const suffix = Date.now();
  return ext ? `${base}-${suffix}.${ext}` : `${base}-${suffix}`;
}

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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file field is required" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only image files are allowed (jpg, png, webp, gif, svg)" },
      { status: 422 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File exceeds 10 MB limit" },
      { status: 422 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 422 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  const normalizedFilename = normalizeFilename(file.name);
  const alt = (formData.get("alt") as string | null)?.trim() ?? null;
  const caption = (formData.get("caption") as string | null)?.trim() ?? null;
  const credit = (formData.get("credit") as string | null)?.trim() ?? null;
  const usageSlot = (formData.get("usageSlot") as string | null)?.trim() ?? null;

  const asset = await prisma.assetUpload.create({
    data: {
      siteId,
      userId: session.user.id,
      originalFilename: file.name,
      normalizedFilename,
      mimeType: file.type,
      fileSize: file.size,
      uploadStatus: "ready",
      temporaryStorageRef: dataUrl,
      alt,
      caption,
      credit,
      usageSlot,
    },
    select: {
      id: true,
      siteId: true,
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

  return NextResponse.json({ asset }, { status: 201 });
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

  const assets = await prisma.assetUpload.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      siteId: true,
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

  return NextResponse.json({ assets });
}
