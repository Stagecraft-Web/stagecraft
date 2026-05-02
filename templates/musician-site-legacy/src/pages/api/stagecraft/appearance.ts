export const prerender = false;

import type { APIRoute } from "astro";
import fs from "node:fs/promises";
import path from "node:path";
import { appearanceSchema } from "../../../lib/schemas";

/**
 * Local-dev save endpoint for the Appearance sidebar.
 *
 * When Keystatic is in `local` storage mode we write straight to the
 * filesystem — the sidebar POSTs the serialised JSON, this route validates
 * it against `appearanceSchema` (same validation used elsewhere) and
 * writes it to `src/content/config/appearance.json`.
 *
 * Deliberately restricted to `import.meta.env.DEV` so that, even in a
 * misconfigured prod deploy, an attacker can't use this route to overwrite
 * content files. In GitHub mode the sidebar bypasses this route entirely
 * and commits straight to GitHub; it's only for local dev parity.
 */

const APPEARANCE_PATH = "src/content/config/appearance.json";

export const POST: APIRoute = async ({ request }) => {
  if (!import.meta.env.DEV) {
    return json({ error: "Not available in production builds." }, 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  // Validate: the shape the sidebar sent must round-trip through our Zod
  // schema. If it doesn't parse, we refuse to write — saves a broken file
  // that would fail content validation later.
  const parsed = appearanceSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return json({ error: `Validation failed: ${msg}` }, 400);
  }

  try {
    // Astro's process.cwd() at dev time is the package root. Resolve absolute
    // to avoid any confusion if the server is ever started from elsewhere.
    const fullPath = path.resolve(process.cwd(), APPEARANCE_PATH);
    const jsonString = JSON.stringify(body, null, 2) + "\n";
    await fs.writeFile(fullPath, jsonString, "utf-8");
    return json({ success: true });
  } catch (err) {
    console.error("[stagecraft/appearance] write failed:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
