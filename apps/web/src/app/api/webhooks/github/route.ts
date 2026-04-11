import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@stagecraft/db";
import { log } from "@/lib/telemetry";
import { verifyGitHubSignature } from "@/lib/webhooks";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const event = req.headers.get("x-github-event") ?? "unknown";
  const signature = req.headers.get("x-hub-signature-256");
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[webhook/github] GITHUB_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (!verifyGitHubSignature(rawBody, signature, secret)) {
    log("webhook.rejected", { source: "github", event });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  log("webhook.received", { source: "github", event });

  if (event === "pull_request") {
    await handlePullRequest(payload);
  } else if (event === "deployment_status") {
    await handleDeploymentStatus(payload);
  }

  return NextResponse.json({ ok: true });
}

async function handlePullRequest(payload: Record<string, unknown>) {
  const repo = payload.repository as
    | { name: string; owner: { login: string } }
    | undefined;
  const pr = payload.pull_request as
    | { number: number; merged: boolean }
    | undefined;
  const action = payload.action as string | undefined;

  if (!repo || !pr) return;

  const site = await prisma.site.findFirst({
    where: { githubRepoOwner: repo.owner.login, githubRepoName: repo.name },
  });
  if (!site) return;

  let newStatus: string | undefined;
  if (action === "closed" && pr.merged) {
    newStatus = "approved";
  } else if (action === "closed") {
    newStatus = "rejected";
  }
  if (!newStatus) return;

  const updated = await prisma.changeRequest.updateMany({
    where: { siteId: site.id, prNumber: pr.number },
    data: { status: newStatus },
  });

  log("webhook.processed", {
    source: "github",
    event: "pull_request",
    action,
    prNumber: pr.number,
    siteId: site.id,
    updatedCount: updated.count,
  });
}

async function handleDeploymentStatus(payload: Record<string, unknown>) {
  const repo = payload.repository as
    | { name: string; owner: { login: string } }
    | undefined;
  const deploymentStatus = payload.deployment_status as
    | { state: string; environment_url?: string }
    | undefined;

  if (!repo || !deploymentStatus) return;

  const site = await prisma.site.findFirst({
    where: { githubRepoOwner: repo.owner.login, githubRepoName: repo.name },
  });
  if (!site) return;

  if (deploymentStatus.state !== "success" || !deploymentStatus.environment_url) return;

  const job = await prisma.siteJob.findFirst({
    where: { siteId: site.id, status: { in: ["running", "queued"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!job) return;

  await prisma.siteJob.update({
    where: { id: job.id },
    data: { status: "completed", completedAt: new Date() },
  });

  await prisma.changeRequest.updateMany({
    where: { siteId: site.id, jobId: job.id },
    data: {
      previewUrl: deploymentStatus.environment_url,
      status: "ready_for_review",
    },
  });

  log("webhook.processed", {
    source: "github",
    event: "deployment_status",
    state: deploymentStatus.state,
    siteId: site.id,
    jobId: job.id,
    previewUrl: deploymentStatus.environment_url,
  });
}
