/**
 * GET / PUT / DELETE one item in any collection (ADR-009 PR 4).
 *
 * The slug pair (`collectionSlug`, `itemSlug`) addresses the file at
 * `src/content/collections/<collectionSlug>/items/<itemSlug>.json`.
 *
 * The wrapper layer (`@/lib/content`) keeps the legacy pages /
 * singletons API working; this generic route is for the schema- and
 * item-editor surfaces that consume any collection by id.
 */

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import {
  buildItemFileSchema,
  generateItemId,
  itemSlugSchema,
  readCollectionDef,
  readItem,
  slugSchema,
  writeItem,
  type Item,
} from "@/lib/collections";
import { __resetBootstrapCacheForTests } from "@/lib/content";
import { PublishError, publish } from "@/lib/publish";

function err(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

type Ctx = { params: Promise<{ slug: string; itemSlug: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  void __resetBootstrapCacheForTests; // silence unused import in non-test paths
  const session = await getSession();
  if (!session) return err(401, "unauthorized");

  const { slug: collectionSlug, itemSlug } = await ctx.params;
  const parsedCollectionSlug = slugSchema.safeParse(collectionSlug);
  const parsedItemSlug = itemSlugSchema.safeParse(itemSlug);
  if (!parsedCollectionSlug.success || !parsedItemSlug.success) {
    return err(400, "Invalid slug");
  }

  const def = await readCollectionDef(parsedCollectionSlug.data);
  if (!def) return err(404, `Collection "${parsedCollectionSlug.data}" not found`);

  const item = await readItem(parsedCollectionSlug.data, parsedItemSlug.data, def);
  if (!item) return err(404, "Item not found");

  return NextResponse.json({ ok: true, item, def });
}

export async function PUT(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return err(401, "unauthorized");

  const { slug: collectionSlug, itemSlug } = await ctx.params;
  const parsedCollectionSlug = slugSchema.safeParse(collectionSlug);
  const parsedItemSlug = itemSlugSchema.safeParse(itemSlug);
  if (!parsedCollectionSlug.success || !parsedItemSlug.success) {
    return err(400, "Invalid slug");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err(400, "Body must be JSON");
  }

  const def = await readCollectionDef(parsedCollectionSlug.data);
  if (!def) return err(404, `Collection "${parsedCollectionSlug.data}" not found`);

  // Build the per-collection Zod schema from `def.fields` and run the
  // incoming item through it. This is where required-field / option /
  // mime-filter validation actually happens — the publish layer only
  // does the structural shell check.
  const fileSchema = buildItemFileSchema(def.fields);
  const valuesShape = body && typeof body === "object" && "values" in body
    ? (body as { values: unknown }).values
    : undefined;
  const existing = await readItem(parsedCollectionSlug.data, parsedItemSlug.data, def);

  let validated: { id: string; createdAt: string; updatedAt: string; values: Item["values"] };
  try {
    validated = fileSchema.parse({
      id: existing?.id ?? generateItemId(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      values: valuesShape,
    });
  } catch (cause) {
    return err(400, `Validation failed: ${String(cause)}`);
  }

  const draft: Item = { ...validated, slug: parsedItemSlug.data };
  await writeItem(parsedCollectionSlug.data, parsedItemSlug.data, draft, def);
  // Re-read so the response (and publish target) carries the
  // canonical `updatedAt` the store just stamped.
  const saved = await readItem(parsedCollectionSlug.data, parsedItemSlug.data, def);
  if (!saved) return err(500, "Item disappeared between write and read");

  try {
    const result = await publish({
      targets: [
        {
          kind: "collection-item",
          collectionSlug: parsedCollectionSlug.data,
          itemSlug: parsedItemSlug.data,
          data: {
            id: saved.id,
            createdAt: saved.createdAt,
            updatedAt: saved.updatedAt,
            values: saved.values,
          },
        },
      ],
      authorEmail: session.email,
      commitSubject: `Update ${parsedCollectionSlug.data}/${parsedItemSlug.data}`,
    });
    return NextResponse.json({
      ok: true,
      item: saved,
      mode: result.mode,
      commitSha: result.commitSha,
    });
  } catch (cause) {
    if (cause instanceof PublishError) {
      return NextResponse.json({
        ok: true,
        item: saved,
        mode: "local",
        commitSha: null,
        publishWarning: cause.message,
      });
    }
    throw cause;
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session) return err(401, "unauthorized");

  const { slug: collectionSlug, itemSlug } = await ctx.params;
  const parsedCollectionSlug = slugSchema.safeParse(collectionSlug);
  const parsedItemSlug = itemSlugSchema.safeParse(itemSlug);
  if (!parsedCollectionSlug.success || !parsedItemSlug.success) {
    return err(400, "Invalid slug");
  }

  const def = await readCollectionDef(parsedCollectionSlug.data);
  if (!def) return err(404, `Collection "${parsedCollectionSlug.data}" not found`);

  const existing = await readItem(parsedCollectionSlug.data, parsedItemSlug.data, def);
  if (!existing) return err(404, "Item not found");

  const { deleteItem } = await import("@/lib/collections");
  await deleteItem(parsedCollectionSlug.data, parsedItemSlug.data);

  try {
    const result = await publish({
      targets: [
        {
          kind: "delete-collection-item",
          collectionSlug: parsedCollectionSlug.data,
          itemSlug: parsedItemSlug.data,
        },
      ],
      authorEmail: session.email,
      commitSubject: `Delete ${parsedCollectionSlug.data}/${parsedItemSlug.data}`,
    });
    return NextResponse.json({ ok: true, mode: result.mode, commitSha: result.commitSha });
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
