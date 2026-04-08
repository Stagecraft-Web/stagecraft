import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { slugify } from "@/lib/slugify";
import { prisma } from "@stagecraft/db";
import type { BlueprintType } from "@stagecraft/shared";

const VALID_BLUEPRINTS: BlueprintType[] = [
  "solo-artist",
  "band",
  "composer-educator",
  "epk-focused",
  "tour-focused",
];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    name?: string;
    blueprintType?: string;
  };

  if (!body.name || !body.blueprintType) {
    return NextResponse.json(
      { error: "name and blueprintType are required" },
      { status: 400 }
    );
  }

  if (!VALID_BLUEPRINTS.includes(body.blueprintType as BlueprintType)) {
    return NextResponse.json(
      { error: `Invalid blueprint type. Must be one of: ${VALID_BLUEPRINTS.join(", ")}` },
      { status: 400 }
    );
  }

  // Check integrations are connected
  const integrations = await prisma.integrationAccount.findMany({
    where: { userId: session.user.id },
  });

  const hasGithub = integrations.some((i: { provider: string }) => i.provider === "github");
  const hasNetlify = integrations.some((i: { provider: string }) => i.provider === "netlify");

  if (!hasGithub || !hasNetlify) {
    return NextResponse.json(
      { error: "GitHub and Netlify must be connected before creating a site" },
      { status: 400 }
    );
  }

  const slug = slugify(body.name);

  // Check slug uniqueness
  const existing = await prisma.site.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(
      { error: "A site with this name already exists" },
      { status: 409 }
    );
  }

  const site = await prisma.site.create({
    data: {
      userId: session.user.id,
      name: body.name,
      slug,
      blueprintType: body.blueprintType,
      status: "creating",
    },
  });

  // Enqueue create_site job
  const job = await prisma.siteJob.create({
    data: {
      siteId: site.id,
      userId: session.user.id,
      type: "create_site",
      status: "queued",
      requestPayload: {
        name: body.name,
        slug,
        blueprintType: body.blueprintType,
      },
    },
  });

  return NextResponse.json({ site, jobId: job.id }, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sites = await prisma.site.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json({ sites });
}
