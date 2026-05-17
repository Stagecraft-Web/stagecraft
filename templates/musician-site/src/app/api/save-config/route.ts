import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import {
  writeAppearance,
  writeHeaderConfig,
  writeSiteConfig,
} from "@/lib/content";
import { PublishError, publish, type PublishTarget } from "@/lib/publish";
import {
  appearanceSchema,
  headerConfigSchema,
  siteConfigSchema,
} from "@/lib/site-config-types";

/**
 * POST /api/save-config — persist one of the singletons (site, header,
 * appearance). The body discriminator identifies which.
 *
 * Always writes to disk first so the dev preview reflects the change
 * immediately, then publishes through the broker → GitHub path when
 * configured. A publish failure surfaces as a warning rather than rolling
 * back the local save — same convention as page create/delete.
 */

const requestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("site-config"), data: siteConfigSchema }),
  z.object({ kind: z.literal("header-config"), data: headerConfigSchema }),
  z.object({ kind: z.literal("appearance"), data: appearanceSchema }),
]);

function err(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return err(401, "unauthorized");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err(400, "Body must be JSON");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return err(400, parsed.error.message);
  }

  // Write to disk synchronously so the dev preview reflects the change.
  // Each branch corresponds to one Singleton; the discriminator narrows the
  // data type so .data is statically typed inside the switch.
  let target: PublishTarget;
  switch (parsed.data.kind) {
    case "site-config":
      await writeSiteConfig(parsed.data.data);
      target = { kind: "site-config", data: parsed.data.data };
      break;
    case "header-config":
      await writeHeaderConfig(parsed.data.data);
      target = { kind: "header-config", data: parsed.data.data };
      break;
    case "appearance":
      await writeAppearance(parsed.data.data);
      target = { kind: "appearance", data: parsed.data.data };
      break;
  }

  try {
    const result = await publish({
      targets: [target],
      authorEmail: session.email,
    });
    return NextResponse.json({
      ok: true,
      mode: result.mode,
      commitSha: result.commitSha,
    });
  } catch (cause) {
    if (cause instanceof PublishError) {
      return NextResponse.json({
        ok: true,
        mode: "local",
        commitSha: null,
        publishWarning: cause.message,
      });
    }
    throw cause;
  }
}
