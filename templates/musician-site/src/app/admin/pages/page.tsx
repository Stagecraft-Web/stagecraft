import { getSession } from "@/lib/auth";
import { listPageSummaries } from "@/lib/content";

import { AdminShell, AdminPanel } from "@/components/admin/AdminShell";

import { PagesPanel } from "./PagesPanel";

export default async function AdminPagesIndex() {
  const [session, pages] = await Promise.all([getSession(), listPageSummaries()]);
  return (
    <AdminShell activeSection="pages" email={session?.email ?? ""}>
      <AdminPanel
        title="Pages"
        description="Every URL on your site lives here. Click a page to edit it in the visual editor; add a new one to start a blank page; mark one as the splash to take over '/'."
      >
        <PagesPanel initialPages={pages} />
      </AdminPanel>
    </AdminShell>
  );
}
