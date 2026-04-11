import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@stagecraft/db";
import { log } from "@/lib/telemetry";
import { verifyNetlifyToken } from "@/lib/webhooks";

interface NetlifyDeployPayload {
  id: string;
  site_id: string;
  state?: string; // "enqueued" | "building" | "ready" | "error"
  ssl_url?: string;
  deploy_url?: string;
  branch?: string;
  error_message?: string;
  commit_ref?: string;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const secret = process.env.NETLIFY_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[webhook/netlify] NETLIFY_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const tokenFromQuery = req.nextUrl.searchParams.get("token");
  const authHeader = req.headers.get("authorization");

  if (!verifyNetlifyToken(tokenFromQuery, authHeader, secret)) {
    log("webhook.rejected", { source: "netlify" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: NetlifyDeployPayload;
  try {
    payload = JSON.parse(rawBody) as NetlifyDeployPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  log("webhook.received", {
    source: "netlify",
    state: payload.state,
    netlifySiteId: payload.site_id,
  });

  await handleNetlifyDeploy(payload);

  return NextResponse.json({ ok: true });
}

async function handleNetlifyDeploy(payload: NetlifyDeployPayload) {
  const site = await prisma.site.findFirst({
    where: { netlifySiteId: payload.site_id },
  });
  if (!site) return;

  const job = await prisma.siteJob.findFirst({
    where: { siteId: site.id, status: { in: ["running", "queued"] } },
    orderBy: { createdAt: "desc" },
  });

  if (payload.state === "building") {
    if (job) {
      await prisma.siteJob.update({
        where: { id: job.id },
        data: { status: "running", startedAt: new Date() },
      });
    }
    return;
  }

  if (payload.state === "ready") {
    const deployUrl = payload.ssl_url ?? payload.deploy_url;

    if (job) {
      await prisma.siteJob.update({
        where: { id: job.id },
        data: { status: "completed", completedAt: new Date() },
      });

      if (deployUrl) {
        await prisma.changeRequest.updateMany({
          where: { siteId: site.id, jobId: job.id },
          data: { previewUrl: deployUrl, status: "ready_for_review" },
        });
      }
    }

    // Update the site's production URL for main-branch deploys
    if (deployUrl && (!payload.branch || payload.branch === site.githubDefaultBranch)) {
      await prisma.site.update({
        where: { id: site.id },
        data: { productionUrl: deployUrl, status: "active" },
      });
    }

    log("webhook.processed", {
      source: "netlify",
      state: "ready",
      siteId: site.id,
      deployUrl,
    });
    return;
  }

  if (payload.state === "error") {
    if (job) {
      await prisma.siteJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          errorMessage: payload.error_message ?? "Netlify deploy failed",
          completedAt: new Date(),
        },
      });
    }

    log("webhook.processed", {
      source: "netlify",
      state: "error",
      siteId: site.id,
      error: payload.error_message,
    });
  }
}
