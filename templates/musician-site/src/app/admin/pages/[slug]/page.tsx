import { notFound } from "next/navigation";

import { getSession } from "@/lib/auth";
import { readPageOrNull } from "@/lib/content";
import { pageSlugSchema } from "@/lib/site-config-types";

import { Editor } from "./Editor";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function AdminEditPage({ params }: Props) {
  const { slug: raw } = await params;
  const parsed = pageSlugSchema.safeParse(raw);
  if (!parsed.success) notFound();
  const slug = parsed.data;

  const [data, session] = await Promise.all([readPageOrNull(slug), getSession()]);
  if (!data) notFound();

  return <Editor initialData={data} pageSlug={slug} email={session?.email ?? ""} />;
}
