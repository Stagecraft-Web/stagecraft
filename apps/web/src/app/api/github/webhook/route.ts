import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@stagecraft/db";

import {
  handleInstallationEvent,
  handleRepositoriesEvent,
  type InstallationAction,
  type RepositoriesAction,
} from "@/lib/github-webhook-handlers";
import { verifyGitHubSignature } from "@/lib/github-webhook-signature";

const installationPayloadSchema = z.object({
  action: z.enum(["created", "deleted", "suspend", "unsuspend", "new_permissions_accepted"]),
  installation: z.object({ id: z.number().int().positive() }),
});

const repositoriesPayloadSchema = z.object({
  action: z.enum(["added", "removed"]),
  installation: z.object({ id: z.number().int().positive() }),
  repositories_added: z.array(z.object({ name: z.string() })).optional(),
  repositories_removed: z.array(z.object({ name: z.string() })).optional(),
});

function ok(body: unknown) {
  return NextResponse.json(body, { status: 200 });
}
function bad(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyGitHubSignature(rawBody, signature)) {
    return bad(401, "invalid signature");
  }

  const event = request.headers.get("x-github-event") ?? "";
  const deliveryId = request.headers.get("x-github-delivery") ?? "";
  if (!event || !deliveryId) {
    return bad(400, "missing event headers");
  }

  // Idempotency: a unique constraint on (provider, deliveryId) means a
  // duplicate redelivery throws on insert. We treat that as success.
  try {
    await prisma.webhookDelivery.create({
      data: { provider: "github", deliveryId, eventType: event },
    });
  } catch (cause) {
    const code = (cause as { code?: string })?.code;
    if (code === "P2002") {
      return ok({ ok: true, duplicate: true });
    }
    return bad(500, "delivery record write failed");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return bad(400, "body is not JSON");
  }

  if (event === "installation") {
    const parsed = installationPayloadSchema.safeParse(payload);
    if (!parsed.success) return bad(400, `invalid installation payload: ${parsed.error.message}`);
    const result = await handleInstallationEvent(
      parsed.data.action satisfies InstallationAction,
      parsed.data.installation.id,
    );
    return ok({ ok: true, applied: result.applied, note: result.note });
  }

  if (event === "installation_repositories") {
    const parsed = repositoriesPayloadSchema.safeParse(payload);
    if (!parsed.success) return bad(400, `invalid repositories payload: ${parsed.error.message}`);
    const action = parsed.data.action satisfies RepositoriesAction;
    const repos = action === "added" ? parsed.data.repositories_added : parsed.data.repositories_removed;
    const result = await handleRepositoriesEvent(action, parsed.data.installation.id, repos ?? []);
    return ok({ ok: true, applied: result.applied, note: result.note });
  }

  // Unsubscribed events should never arrive (App settings only ask for
  // `installation` and `installation_repositories`). 200 the unknown
  // event so GitHub doesn't retry needlessly.
  return ok({ ok: true, ignored: event });
}
