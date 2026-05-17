import { getSession } from "@/lib/auth";
import { listPageSummaries, readHeaderConfig } from "@/lib/content";

import { AdminShell } from "@/components/admin/AdminShell";

import { NavigationForm } from "./NavigationForm";

export default async function AdminNavigationPage() {
  const [session, config, pages] = await Promise.all([
    getSession(),
    readHeaderConfig(),
    listPageSummaries(),
  ]);
  return (
    <AdminShell activeSection="navigation" email={session?.email ?? ""}>
      <NavigationForm initial={config} availablePages={pages} />
    </AdminShell>
  );
}
