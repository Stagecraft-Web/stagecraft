import { getSession } from "@/lib/auth";
import { readPage } from "@/lib/content";
import { Editor } from "./Editor";

export default async function AdminPage() {
  const pageSlug = "home";
  const [data, session] = await Promise.all([readPage(pageSlug), getSession()]);
  return <Editor initialData={data} pageSlug={pageSlug} email={session?.email ?? ""} />;
}
