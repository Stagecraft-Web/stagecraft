import { NextResponse } from "next/server";

import { writePage, type PageData } from "@/lib/content";

type SaveBody = { slug: string; data: PageData };

export async function POST(request: Request) {
  const body = (await request.json()) as SaveBody;

  if (!body.slug || !body.data) {
    return NextResponse.json({ error: "missing slug or data" }, { status: 400 });
  }

  await writePage(body.slug, body.data);
  return NextResponse.json({ ok: true });
}
