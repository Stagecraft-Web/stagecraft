import { readPage } from "@/lib/content";
import { Editor } from "./Editor";

export default async function AdminPage() {
  const data = await readPage("home");
  return <Editor initialData={data} />;
}
